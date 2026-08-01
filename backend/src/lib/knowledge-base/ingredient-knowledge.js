import { ingredientKnowledgeOverrides } from "../../data/ingredient-knowledge-overrides.js";

function normalizeTextValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLookupKey(value = "") {
  return normalizeTextValue(value)
    .toLowerCase()
    .replace(/[\u2122\u00AE\u00A9]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+(?:\.\d+)?%\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTextArray(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values
    .map((value) => {
      if (typeof value === "string") {
        return value.trim();
      }

      if (value && typeof value === "object") {
        return normalizeTextValue(value.alias || value.label || value.name || value.url || value.reference || "");
      }

      return "";
    })
    .filter(Boolean))];
}

function normalizeReferenceList(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed ? { citation: trimmed } : null;
      }

      if (value && typeof value === "object") {
        const title = normalizeTextValue(value.title || "");
        const citation = normalizeTextValue(value.citation || title || value.reference || value.url || "");
        const url = normalizeTextValue(value.url || "");
        const source = normalizeTextValue(value.source || "");
        const evidenceType = normalizeTextValue(value.evidenceType || "");

        if (!citation && !url) {
          return null;
        }

        return {
          ...(title ? { title } : {}),
          ...(citation ? { citation } : {}),
          ...(url ? { url } : {}),
          ...(source ? { source } : {}),
          ...(evidenceType ? { evidenceType } : {})
        };
      }

      return null;
    })
    .filter(Boolean);
}

function splitPurposeIntoFunctions(value = "") {
  const normalized = normalizeTextValue(value)
    .replace(/[\u2013\u2014]/g, "|")
    .replace(/[\uFFFD\u2022]/g, "|")
    .replace(/\s*\/\s*/g, "|")
    .replace(/\s+\|\s+/g, "|")
    .replace(/\s+-\s+/g, "|");

  if (!normalized) {
    return [];
  }

  return [...new Set(normalized
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean))];
}

function normalizeEvidenceLevel(value) {
  const normalized = normalizeTextValue(value).toUpperCase();
  return normalized || null;
}

function getOverrideForIngredient(name = "") {
  const key = normalizeLookupKey(name);

  return ingredientKnowledgeOverrides[key] || null;
}

export function ensureStructuredIngredientKnowledge(rawIngredient = {}) {
  const aliases = normalizeTextArray(rawIngredient.aliases);
  const purpose = normalizeTextValue(rawIngredient.purpose || rawIngredient.displayPurpose || "Unknown") || "Unknown";
  const displayPurpose = normalizeTextValue(rawIngredient.displayPurpose || rawIngredient.purpose || purpose) || "Unknown";
  const suitableSkinTypes = normalizeTextArray(rawIngredient.suitableSkinTypes || rawIngredient.skinTypes);
  const avoidSkinTypes = normalizeTextArray(rawIngredient.avoidSkinTypes);
  const functions = normalizeTextArray(rawIngredient.functions);
  const helps = normalizeTextArray(rawIngredient.helps);
  const avoidFor = normalizeTextArray(rawIngredient.avoidFor);
  const tags = normalizeTextArray(rawIngredient.tags);
  const riskFlags = normalizeTextArray(rawIngredient.riskFlags);
  const benefits = Array.isArray(rawIngredient.benefits) ? rawIngredient.benefits : [];
  const sideEffects = Array.isArray(rawIngredient.sideEffects) ? rawIngredient.sideEffects : [];

  return {
    ...rawIngredient,
    inciName: normalizeTextValue(rawIngredient.inciName || rawIngredient.name),
    aliases,
    purpose,
    displayPurpose,
    functions: functions.length ? functions : splitPurposeIntoFunctions(displayPurpose),
    helps,
    skinTypes: suitableSkinTypes,
    suitableSkinTypes,
    avoidFor,
    avoidSkinTypes,
    tags,
    riskFlags,
    evidenceLevel: normalizeEvidenceLevel(rawIngredient.evidenceLevel),
    references: normalizeReferenceList(rawIngredient.references),
    benefits,
    sideEffects,
    comedogenicRating: Number(rawIngredient.comedogenicRating ?? 0),
    irritationScore: Number(rawIngredient.irritationScore ?? 0),
    simpleExplanation: normalizeTextValue(rawIngredient.simpleExplanation || "Ingredient knowledge base entry is incomplete.") || "Ingredient knowledge base entry is incomplete."
  };
}

export function buildSeedIngredientKnowledge(seedIngredient = {}) {
  const override = getOverrideForIngredient(seedIngredient.name || seedIngredient.inciName || "");
  return ensureStructuredIngredientKnowledge({
    ...seedIngredient,
    ...(override || {})
  });
}

export function buildIngredientCreateData(seedIngredient = {}) {
  const ingredient = buildSeedIngredientKnowledge(seedIngredient);

  return {
    name: ingredient.inciName || ingredient.name,
    scientificName: normalizeTextValue(ingredient.scientificName) || null,
    purpose: ingredient.purpose,
    displayPurpose: ingredient.displayPurpose,
    riskLevel: ingredient.riskLevel || "LOW",
    benefits: ingredient.benefits,
    sideEffects: ingredient.sideEffects,
    suitableSkinTypes: ingredient.suitableSkinTypes,
    avoidSkinTypes: ingredient.avoidSkinTypes,
    functions: ingredient.functions,
    helps: ingredient.helps,
    avoidFor: ingredient.avoidFor,
    tags: ingredient.tags,
    riskFlags: ingredient.riskFlags,
    evidenceLevel: ingredient.evidenceLevel,
    references: ingredient.references,
    comedogenicRating: ingredient.comedogenicRating,
    irritationScore: ingredient.irritationScore,
    simpleExplanation: ingredient.simpleExplanation
  };
}