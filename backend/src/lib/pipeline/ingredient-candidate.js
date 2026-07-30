import { randomUUID } from "node:crypto";
import { splitAndNormalizeIngredients } from "../formula-analysis/ingredient-normalizer.js";

function normalizeIngredientSeparators(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<\/(?:li|p|div|dd|tr)>/gi, ", ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+(?:&|\(and\)|and)\s+/gi, ", ")
    .replace(/[\r\n|•·▪◦]+/g, ", ")
    .replace(/(?:,\s*){2,}/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createIngredientCandidate({
  sourceUrl = "",
  sourceWebsite = "",
  stage = "unknown",
  extractionMethod = "unknown",
  ingredientSource = "",
  sourceKind = null,
  rawExtractedIngredients = "",
  metadata = {},
  product = null
} = {}) {
  const normalizedIngredients = normalizeIngredientSeparators(rawExtractedIngredients);
  const parsedIngredientList = splitAndNormalizeIngredients(normalizedIngredients);

  return {
    id: randomUUID(),
    sourceUrl,
    sourceWebsite,
    stage,
    extractionMethod,
    ingredientSource: ingredientSource || sourceWebsite || stage,
    sourceKind,
    rawExtractedIngredients: normalizedIngredients,
    parsedIngredientList,
    ingredientCount: parsedIngredientList.length,
    product,
    metadata,
    verification: null,
    rejectionReason: null,
    verified: false
  };
}

export function finalizeIngredientCandidate(candidate, verification) {
  return {
    ...candidate,
    verification,
    rejectionReason: verification?.verified ? null : verification?.reason || null,
    verified: Boolean(verification?.verified),
    ingredientsText: verification?.ingredientsText || candidate.rawExtractedIngredients,
    ingredientList: verification?.ingredientList || candidate.parsedIngredientList,
    matchRate: verification?.matchRate ?? null,
    matchedCount: verification?.matchedCount ?? 0,
    unknownCount: verification?.unknownCount ?? candidate.parsedIngredientList.length,
    aliasMatchedCount: verification?.aliasMatchedCount ?? 0,
    confidenceScore: verification?.confidenceScore ?? 0
  };
}

