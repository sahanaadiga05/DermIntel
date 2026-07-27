import { createIngredientCandidate } from "./ingredient-candidate.js";

const OPENAI_MODEL = process.env.OPENAI_EXTRACTION_MODEL || "gpt-4.1-mini";
const MISTRAL_MODEL = process.env.MISTRAL_EXTRACTION_MODEL || "mistral-large-latest";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const MISTRAL_BASE_URL = (process.env.MISTRAL_BASE_URL || "https://api.mistral.ai").replace(/\/+$/, "");
const MAX_PAGE_TEXT_CHARS = 18000;
const MAX_CANDIDATE_TEXT_CHARS = 1200;

function normalizeProvider(value = "") {
  return String(value || "").trim().toLowerCase();
}

function resolveAiProvider() {
  const explicitProvider = normalizeProvider(process.env.AI_EXTRACTION_PROVIDER || process.env.AI_PROVIDER);

  if (explicitProvider === "mistral" && process.env.MISTRAL_API_KEY) {
    return {
      provider: "mistral",
      apiKey: process.env.MISTRAL_API_KEY,
      model: MISTRAL_MODEL,
      baseUrl: MISTRAL_BASE_URL
    };
  }

  if (explicitProvider === "openai" && process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: OPENAI_MODEL,
      baseUrl: OPENAI_BASE_URL
    };
  }

  if (process.env.MISTRAL_API_KEY) {
    return {
      provider: "mistral",
      apiKey: process.env.MISTRAL_API_KEY,
      model: MISTRAL_MODEL,
      baseUrl: MISTRAL_BASE_URL
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      provider: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: OPENAI_MODEL,
      baseUrl: OPENAI_BASE_URL
    };
  }

  return null;
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function extractFirstJsonObject(value = "") {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return null;
  }

  const direct = safeJsonParse(normalized);
  if (direct) {
    return direct;
  }

  const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return safeJsonParse(fencedMatch[1].trim());
  }

  const objectMatch = normalized.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0]) {
    return safeJsonParse(objectMatch[0]);
  }

  return null;
}

function buildOpenAiRequestBody({ model, systemPrompt, userPrompt, schemaName, schema }) {
  return {
    model,
    temperature: 0,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: schemaName,
        schema
      }
    },
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: systemPrompt
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: userPrompt
          }
        ]
      }
    ]
  };
}

function parseOpenAiPayload(payload = {}) {
  const content = payload.output?.[0]?.content || payload.content || [];
  for (const item of content) {
    if (item.type === "output_text" || item.type === "text") {
      const parsed = extractFirstJsonObject(item.text || item.value || "");
      if (parsed) {
        return parsed;
      }
    }
  }

  if (payload.output_text) {
    return extractFirstJsonObject(payload.output_text);
  }

  return null;
}

function buildMistralRequestBody({ model, systemPrompt, userPrompt }) {
  return {
    model,
    temperature: 0,
    response_format: {
      type: "json_object"
    },
    messages: [
      {
        role: "system",
        content: `${systemPrompt}\n\nAlways return valid JSON only.`
      },
      {
        role: "user",
        content: userPrompt
      }
    ]
  };
}

function parseMistralPayload(payload = {}) {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return extractFirstJsonObject(content);
  }

  if (Array.isArray(content)) {
    for (const item of content) {
      if (typeof item?.text === "string") {
        const parsed = extractFirstJsonObject(item.text);
        if (parsed) {
          return parsed;
        }
      }
    }
  }

  return null;
}

async function callAiJson({ systemPrompt, userPrompt, schemaName, schema }) {
  const providerConfig = resolveAiProvider();
  if (!providerConfig) {
    return null;
  }

  try {
    if (providerConfig.provider === "openai") {
      const response = await fetch(`${providerConfig.baseUrl}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${providerConfig.apiKey}`
        },
        body: JSON.stringify(
          buildOpenAiRequestBody({
            model: providerConfig.model,
            systemPrompt,
            userPrompt,
            schemaName,
            schema
          })
        )
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json();
      const parsed = parseOpenAiPayload(payload);
      return parsed
        ? {
            provider: providerConfig.provider,
            model: providerConfig.model,
            parsed
          }
        : null;
    }

    const response = await fetch(`${providerConfig.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${providerConfig.apiKey}`
      },
      body: JSON.stringify(
        buildMistralRequestBody({
          model: providerConfig.model,
          systemPrompt,
          userPrompt
        })
      )
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const parsed = parseMistralPayload(payload);
    return parsed
      ? {
          provider: providerConfig.provider,
          model: providerConfig.model,
          parsed
        }
      : null;
  } catch (_error) {
    return null;
  }
}

function ingredientSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      ingredients: {
        type: "array",
        items: {
          type: "string"
        }
      }
    },
    required: ["ingredients"]
  };
}

function candidateSelectionSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      selectedIndexes: {
        type: "array",
        items: {
          type: "integer"
        }
      },
      reason: {
        type: "string"
      }
    },
    required: ["selectedIndexes", "reason"]
  };
}

function normalizeIngredients(value) {
  return Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
}

function serializeCandidates(candidates = []) {
  return candidates
    .slice(0, 8)
    .map((candidate, index) => {
      const content = String(candidate.rawExtractedIngredients || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, MAX_CANDIDATE_TEXT_CHARS);

      return [
        `Candidate ${index}`,
        `Stage: ${candidate.stage || "unknown"}`,
        `Method: ${candidate.extractionMethod || "unknown"}`,
        `Source label: ${candidate.ingredientSource || candidate.sourceWebsite || "unknown"}`,
        `Content: ${content}`
      ].join("\n");
    })
    .join("\n\n");
}

export async function extractIngredientsWithAi({ pageText = "", sourceUrl = "", sourceWebsite = "", product = null }) {
  if (!pageText) {
    return null;
  }

  const result = await callAiJson({
    systemPrompt: "Extract ONLY the complete official INCI ingredient list from the provided product page text. Ignore benefits, FAQs, usage instructions, ratings, claims, reviews, and marketing. Never guess. If no verified ingredient list exists, return {\"ingredients\": []}.",
    userPrompt: pageText.slice(0, MAX_PAGE_TEXT_CHARS),
    schemaName: "ingredient_extraction",
    schema: ingredientSchema()
  });

  const ingredients = normalizeIngredients(result?.parsed?.ingredients);
  if (!ingredients.length) {
    return null;
  }

  return createIngredientCandidate({
    sourceUrl,
    sourceWebsite,
    stage: "ai-fallback",
    extractionMethod: "ai-structured-output",
    ingredientSource: result.provider,
    rawExtractedIngredients: ingredients.join(", "),
    metadata: {
      provider: result.provider,
      model: result.model,
      sourceBlock: "clean-page-text"
    },
    product
  });
}

export async function prioritizeIngredientCandidatesWithAi({ candidates = [], pageText = "" } = {}) {
  if (!Array.isArray(candidates) || candidates.length < 2) {
    return candidates;
  }

  const candidatePrompt = serializeCandidates(candidates);
  if (!candidatePrompt) {
    return candidates;
  }

  const result = await callAiJson({
    systemPrompt: "You are validating scraped cosmetic product content. Return JSON only. Select the zero-based candidate indexes that contain a full INCI ingredient list. Reject hero ingredients, key ingredients, benefits, claims, FAQs, usage instructions, and partial ingredient callouts. If none are valid full ingredient lists, return an empty array.",
    userPrompt: [
      pageText ? `Page text excerpt:\n${pageText.slice(0, 4000)}` : "",
      "Candidate blocks:",
      candidatePrompt,
      'Return JSON in the form {"selectedIndexes": [..], "reason": "..."}.'
    ].filter(Boolean).join("\n\n"),
    schemaName: "ingredient_candidate_selection",
    schema: candidateSelectionSchema()
  });

  const selectedIndexes = Array.isArray(result?.parsed?.selectedIndexes)
    ? [...new Set(result.parsed.selectedIndexes
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value < candidates.length))]
    : [];

  if (!selectedIndexes.length) {
    return candidates;
  }

  const selectedSet = new Set(selectedIndexes);
  const reason = String(result?.parsed?.reason || "").trim();
  const selected = selectedIndexes.map((index) => {
    const candidate = candidates[index];
    return {
      ...candidate,
      metadata: {
        ...(candidate.metadata || {}),
        aiSelection: {
          provider: result.provider,
          model: result.model,
          selected: true,
          reason
        }
      }
    };
  });
  const remainder = candidates.filter((_, index) => !selectedSet.has(index));

  return [...selected, ...remainder];
}
