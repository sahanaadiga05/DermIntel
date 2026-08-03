const OPENAI_EXPLANATION_MODEL = process.env.OPENAI_EXPLANATION_MODEL || "gpt-4.1-mini";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");

function truncate(value = "", maxLength = 900) {
  const text = String(value || "").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function toSentenceList(values = []) {
  if (!values.length) {
    return "this profile";
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function formatCodeLabel(value = "") {
  return String(value || "")
    .toLowerCase()
    .replaceAll("_", " ");
}

function buildProfilePoints(profile = {}) {
  const points = [];

  if (profile.skinType) {
    points.push(`Skin type: ${formatCodeLabel(profile.skinType)}`);
  }

  if (profile.skinSensitivity && profile.skinSensitivity !== "NOT_SENSITIVE") {
    points.push(`Sensitivity: ${formatCodeLabel(profile.skinSensitivity)}`);
  }

  if (Array.isArray(profile.concerns) && profile.concerns.length) {
    points.push(`Concerns: ${toSentenceList(profile.concerns.map(formatCodeLabel).slice(0, 3))}`);
  }

  if (Array.isArray(profile.goals) && profile.goals.length) {
    points.push(`Goals: ${toSentenceList(profile.goals.map(formatCodeLabel).slice(0, 3))}`);
  }

  if (Array.isArray(profile.avoidIngredients) && profile.avoidIngredients.length) {
    const avoids = profile.avoidIngredients
      .filter((entry) => entry !== "NONE" && entry !== "OTHER")
      .map(formatCodeLabel);

    if (avoids.length) {
      points.push(`Avoid ingredients: ${toSentenceList(avoids.slice(0, 3))}`);
    }
  }

  return points;
}

function buildFallbackExplanation({ result, profile }) {
  const strengths = result.strengths || [];
  const weaknesses = result.weaknesses || [];
  const profilePoints = buildProfilePoints(profile);
  const lines = [
    `${result.productName || "This formula"} scored ${result.score}/100 overall, with a safety score of ${result.safetyScore}/100 and a suitability score of ${result.suitabilityScore}/100.`
  ];

  lines.push(...profilePoints);

  lines.push(
    strengths.length
      ? `Main strengths: ${toSentenceList(strengths)}.`
      : "Main strengths: no single ingredient dominated the upside, but the formula still had enough supportive signals to score positively."
  );

  lines.push(
    weaknesses.length
      ? `Biggest tradeoffs: ${toSentenceList(weaknesses)}.`
      : "Biggest tradeoffs: no major ingredient-level tradeoffs stood out in the final score."
  );

  return lines.map((line) => `- ${line}`).join("\n");
}

function buildOpenAiRequestBody({ model, systemPrompt, userPrompt }) {
  return {
    model,
    temperature: 0.2,
    max_output_tokens: 220,
    text: {
      format: {
        type: "json_schema",
        name: "dermintel_explanation",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            explanation: {
              type: "string"
            }
          },
          required: ["explanation"]
        }
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

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function extractExplanation(payload = {}) {
  const outputText = payload.output_text || "";
  const parsedOutputText = safeJsonParse(outputText);
  if (parsedOutputText?.explanation) {
    return String(parsedOutputText.explanation).trim();
  }

  const content = payload.output?.[0]?.content || [];
  for (const item of content) {
    const raw = item.text || item.value || "";
    const parsed = safeJsonParse(raw);
    if (parsed?.explanation) {
      return String(parsed.explanation).trim();
    }
  }

  return "";
}

async function generateOpenAiExplanation({ result, profile }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const systemPrompt = [
    "You are DermIntel's explanation layer.",
    "The scores, verdict, strengths, and weaknesses are already computed by the backend.",
    "Do not recalculate, override, or reinterpret the numeric result.",
    "Return 3-6 short bullet points separated by newline characters.",
    "Do not mention hidden chain-of-thought, formulas, or implementation details.",
    "Do not use the | character.",
    "Keep the tone professional, helpful, and user-facing."
  ].join(" ");

  const userPrompt = JSON.stringify({
    instruction: "Explain the deterministic DermIntel result without changing any score or verdict. Use short bullet points, one fact per line, and never use the | character.",
    profile: {
      skinType: profile.skinType || null,
      skinSensitivity: profile.skinSensitivity || null,
      concerns: profile.concerns || [],
      goals: profile.goals || [],
      avoidIngredients: profile.avoidIngredients || []
    },
    result: {
      productName: result.productName,
      score: result.score,
      safetyScore: result.safetyScore,
      suitabilityScore: result.suitabilityScore,
      verdict: result.verdict,
      strengths: result.strengths || [],
      weaknesses: result.weaknesses || [],
      pros: (result.pros || []).slice(0, 4),
      cons: (result.cons || []).slice(0, 4)
    }
  });

  try {
    const response = await fetch(`${OPENAI_BASE_URL}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(
        buildOpenAiRequestBody({
          model: OPENAI_EXPLANATION_MODEL,
          systemPrompt,
          userPrompt
        })
      )
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const explanation = extractExplanation(payload);
    return explanation ? truncate(explanation, 900) : null;
  } catch (_error) {
    return null;
  }
}

export async function explainDeterministicResult({ result, profile }) {
  const openAiExplanation = await generateOpenAiExplanation({ result, profile });

  if (openAiExplanation) {
    return {
      explanation: openAiExplanation,
      explanationSource: "openai",
      explanationModel: OPENAI_EXPLANATION_MODEL
    };
  }

  return {
    explanation: buildFallbackExplanation({ result, profile }),
    explanationSource: "deterministic-fallback",
    explanationModel: null
  };
}

