import { normalizeIngredientCandidate } from "../../services/ingredient-normalizer.js";
import { finalizeIngredientCandidate } from "../pipeline/ingredient-candidate.js";
import { getLookupKey } from "../formula-analysis/ingredient-normalizer.js";

const MARKETING_KEYWORDS = [
  "benefits",
  "why you'll love it",
  "why we love it",
  "hero ingredients",
  "good to know",
  "key ingredients",
  "how to use",
  "about this item",
  "product details",
  "description"
];
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const SENTENCE_PATTERN = /(?:\.|!|\?|:).{10,}/;
const PERCENT_ONLY_PATTERN = /^\s*\d+(?:\.\d+)?%\s*$/;

function clampConfidence(value) {
  return Math.max(0.05, Math.min(0.99, Number(value.toFixed(2))));
}

function splitRawTokens(ingredientsText = "") {
  return ingredientsText
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function looksLikeSentence(token = "") {
  return token.split(/\s+/).length > 8 || SENTENCE_PATTERN.test(token);
}

function containsMarketingWord(token = "") {
  const lowered = token.toLowerCase();
  return MARKETING_KEYWORDS.some((keyword) => lowered.includes(keyword));
}

function buildVerificationConfidence({ extractionMethod = "", sourceWebsite = "", brand = "", ingredientRows = [] }) {
  let confidence = 0.38;
  const matchedCount = ingredientRows.filter((row) => row.ingredient).length;
  const unknownCount = ingredientRows.length - matchedCount;
  const matchRate = matchedCount / Math.max(ingredientRows.length, 1);
  const source = sourceWebsite.toLowerCase();
  const brandKey = brand.toLowerCase();

  if (extractionMethod.startsWith("official-site") || (brandKey && source.includes(brandKey))) {
    confidence += 0.32;
  } else if (extractionMethod.startsWith("trusted-database")) {
    confidence += 0.2;
  } else if (extractionMethod.startsWith("distributor")) {
    confidence += 0.15;
  } else if (extractionMethod.includes("dom") || extractionMethod.includes("next") || extractionMethod.includes("json")) {
    confidence += 0.14;
  } else if (extractionMethod === "openai-structured-output" || extractionMethod === "ai-structured-output") {
    confidence += 0.08;
  }

  if (matchRate >= 0.9) {
    confidence += 0.18;
  } else if (matchRate >= 0.75) {
    confidence += 0.12;
  } else if (matchRate >= 0.6) {
    confidence += 0.08;
  }

  confidence -= unknownCount * 0.05;
  return {
    confidenceScore: clampConfidence(confidence),
    matchedCount,
    unknownCount,
    matchRate
  };
}

export async function verifyIngredientCandidate(candidate, { productName = "", brand = "", minIngredientCount = 8 } = {}) {
  const normalizedCandidate = await normalizeIngredientCandidate(candidate);
  const rawTokens = splitRawTokens(normalizedCandidate.rawExtractedIngredients || "");
  const ingredientList = normalizedCandidate.canonicalIngredientList || [];
  const ingredientRows = normalizedCandidate.ingredientRows || [];
  const aliasMatchedCount = ingredientRows.filter((row) => row.matchType === "alias" || row.matchType === "synonym").length;
  const percentageOnlyCount = rawTokens.filter((token) => PERCENT_ONLY_PATTERN.test(token)).length;
  const sentenceLikeCount = rawTokens.filter(looksLikeSentence).length;
  const marketingTokenCount = rawTokens.filter((token) => containsMarketingWord(token) || EMOJI_PATTERN.test(token)).length;
  const matchedRows = ingredientRows.filter((row) => row.ingredient);
  const unknownCount = ingredientRows.length - matchedRows.length;
  const matchRate = matchedRows.length / Math.max(ingredientRows.length, 1);
  const supportSignals = {
    hasPreservative: matchedRows.some((row) => row.ingredient.tags?.includes("preservative")),
    hasSolvent: matchedRows.some((row) => row.ingredient.tags?.includes("solvent") || row.ingredient.name === "water"),
    hasSurfactant: matchedRows.some((row) => row.ingredient.tags?.includes("surfactant")),
    hasEmulsifier: matchedRows.some((row) => row.ingredient.tags?.includes("emulsifier") || row.ingredient.name.includes("alcohol")),
    hasBotanical: matchedRows.some((row) => row.ingredient.name.includes("extract") || row.ingredient.name.includes("juice"))
  };

  let verification = null;

  if (ingredientList.length < minIngredientCount) {
    verification = {
      verified: false,
      ingredientsText: ingredientList.join(", "),
      ingredientList,
      ingredientCount: ingredientList.length,
      matchedCount: matchedRows.length,
      unknownCount,
      aliasMatchedCount,
      matchRate: Number(matchRate.toFixed(2)),
      confidenceScore: 0,
      reason: `Ingredient list is too short to trust. Found ${ingredientList.length} ingredients, but at least ${minIngredientCount} are required.`,
      rule: "MIN_INGREDIENT_COUNT"
    };
  } else if (percentageOnlyCount >= Math.ceil(rawTokens.length * 0.5)) {
    verification = {
      verified: false,
      ingredientsText: ingredientList.join(", "),
      ingredientList,
      ingredientCount: ingredientList.length,
      matchedCount: matchedRows.length,
      unknownCount,
      aliasMatchedCount,
      matchRate: Number(matchRate.toFixed(2)),
      confidenceScore: 0.08,
      reason: "The extracted text looks like percentage claims, not a full ingredient list.",
      rule: "PERCENTAGE_ONLY"
    };
  } else if (sentenceLikeCount >= 2 || sentenceLikeCount >= Math.ceil(rawTokens.length * 0.3)) {
    verification = {
      verified: false,
      ingredientsText: ingredientList.join(", "),
      ingredientList,
      ingredientCount: ingredientList.length,
      matchedCount: matchedRows.length,
      unknownCount,
      aliasMatchedCount,
      matchRate: Number(matchRate.toFixed(2)),
      confidenceScore: 0.1,
      reason: "The extracted text contains sentence-style content instead of INCI entries.",
      rule: "SENTENCE_CONTENT"
    };
  } else if (marketingTokenCount >= 2 || marketingTokenCount >= Math.ceil(rawTokens.length * 0.25)) {
    verification = {
      verified: false,
      ingredientsText: ingredientList.join(", "),
      ingredientList,
      ingredientCount: ingredientList.length,
      matchedCount: matchedRows.length,
      unknownCount,
      aliasMatchedCount,
      matchRate: Number(matchRate.toFixed(2)),
      confidenceScore: 0.1,
      reason: "The extracted section looks like marketing copy, not a verified INCI ingredient list.",
      rule: "MARKETING_COPY"
    };
  } else if (matchRate < 0.55) {
    verification = {
      verified: false,
      ingredientsText: ingredientList.join(", "),
      ingredientList,
      ingredientCount: ingredientList.length,
      matchedCount: matchedRows.length,
      unknownCount,
      aliasMatchedCount,
      matchRate: Number(matchRate.toFixed(2)),
      confidenceScore: 0.2,
      reason: `Only ${Math.round(matchRate * 100)}% of entries matched known INCI ingredients.`,
      rule: "LOW_INCI_MATCH"
    };
  } else if (!supportSignals.hasSolvent && !supportSignals.hasPreservative && !supportSignals.hasSurfactant && !supportSignals.hasEmulsifier && !supportSignals.hasBotanical) {
    verification = {
      verified: false,
      ingredientsText: ingredientList.join(", "),
      ingredientList,
      ingredientCount: ingredientList.length,
      matchedCount: matchedRows.length,
      unknownCount,
      aliasMatchedCount,
      matchRate: Number(matchRate.toFixed(2)),
      confidenceScore: 0.22,
      reason: "The list lacks the supporting INCI signals expected in a complete cosmetic formula.",
      rule: "MISSING_SUPPORT_SIGNALS"
    };
  } else {
    const confidence = buildVerificationConfidence({
      extractionMethod: normalizedCandidate.extractionMethod || "",
      sourceWebsite: normalizedCandidate.sourceWebsite || "",
      brand,
      ingredientRows
    });

    verification = {
      verified: true,
      ingredientsText: ingredientList.join(", "),
      ingredientList,
      ingredientCount: ingredientList.length,
      matchedCount: confidence.matchedCount,
      unknownCount: confidence.unknownCount,
      aliasMatchedCount,
      matchRate: Number(confidence.matchRate.toFixed(2)),
      confidenceScore: confidence.confidenceScore,
      reason: `Verified ${ingredientList.length} ingredients with ${Math.round(confidence.matchRate * 100)}% INCI match from ${normalizedCandidate.sourceWebsite || "the source page"}.`,
      rule: "PASSED"
    };
  }

  return finalizeIngredientCandidate(
    {
      ...normalizedCandidate,
      productName,
      brand,
      metadata: {
        ...(normalizedCandidate.metadata || {}),
        normalizedLookup: ingredientList.map((item) => getLookupKey(item))
      }
    },
    verification
  );
}

export async function verifyIngredientList({ ingredientsText = "", sourceWebsite = "", extractionMethod = "", productName = "", brand = "", minIngredientCount = 8 } = {}) {
  const candidate = {
    sourceUrl: "",
    sourceWebsite,
    stage: "manual",
    extractionMethod,
    ingredientSource: sourceWebsite,
    rawExtractedIngredients: ingredientsText,
    parsedIngredientList: [],
    metadata: {}
  };

  const verifiedCandidate = await verifyIngredientCandidate(candidate, {
    productName,
    brand,
    minIngredientCount
  });

  return verifiedCandidate.verification;
}

function getCandidateIngredientSet(candidate) {
  return new Set((candidate.ingredientList || []).map((item) => getLookupKey(item)).filter(Boolean));
}

export function compareIngredientLists(candidates = []) {
  if (candidates.length <= 1) {
    return candidates[0] || null;
  }

  let best = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    const normalized = getCandidateIngredientSet(candidate);
    let overlapScore = 0;

    for (const other of candidates) {
      if (other === candidate) {
        continue;
      }

      const otherSet = getCandidateIngredientSet(other);
      const overlapCount = [...normalized].filter((item) => otherSet.has(item)).length;
      overlapScore += overlapCount / Math.max(normalized.size, otherSet.size, 1);
    }

    const matchRateBoost = typeof candidate.matchRate === "number" ? candidate.matchRate * 0.18 : 0;
    const sourcePriority = candidate.extractionMethod?.startsWith("official-site")
      ? 0.1
      : candidate.extractionMethod?.startsWith("trusted-database")
        ? 0.07
        : candidate.extractionMethod?.startsWith("distributor")
          ? 0.04
          : candidate.extractionMethod === "openai-structured-output" || candidate.extractionMethod === "ai-structured-output"
            ? -0.05
            : 0;
    const rejectionPenalty = candidate.verified ? 0 : -1;
    const totalScore = overlapScore + (candidate.confidenceScore || 0) + matchRateBoost + sourcePriority + rejectionPenalty;

    if (totalScore > bestScore) {
      best = candidate;
      bestScore = totalScore;
    }
  }

  return best;
}

