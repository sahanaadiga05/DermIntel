const MARKETING_NORMALIZATION_RULES = [
  { pattern: /\bsalicylic\b/gi, replacements: ["salicylic acid"] },
  { pattern: /\bniacinamide serum\b/gi, replacements: ["niacinamide"] },
  { pattern: /\bvit\s*e\b/gi, replacements: ["tocopherol"] },
  { pattern: /\bvitamin e\b/gi, replacements: ["tocopherol"] },
  { pattern: /\bcica\b/gi, replacements: ["centella asiatica extract"] },
  { pattern: /\btreha hyaluronic acid\b/gi, replacements: ["trehalose", "sodium hyaluronate"] },
  { pattern: /\brice water\b/gi, replacements: ["oryza sativa extract"] },
  { pattern: /\baloe\b/gi, replacements: ["aloe barbadensis leaf juice"] },
  { pattern: /\bgreen tea\b/gi, replacements: ["camellia sinensis leaf extract"] },
  { pattern: /\bazelaic\b/gi, replacements: ["azelaic acid"] }
];

function normalizeLookupValue(value = "") {
  return value
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+(\.\d+)?%\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function normalizeIngredientToken(token = "") {
  return token
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^ingredients?\s*:?/i, "")
    .replace(/^full ingredients?\s*:?/i, "")
    .replace(/^inci\s*:?/i, "")
    .replace(/^composition\s*:?/i, "")
    .trim();
}

export function expandMarketingIngredient(rawToken = "") {
  const normalized = normalizeIngredientToken(rawToken);

  for (const rule of MARKETING_NORMALIZATION_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.replacements;
    }
  }

  return [normalized];
}

export function buildAliasIndex(ingredientCatalog = []) {
  const index = new Map();

  for (const ingredient of ingredientCatalog) {
    const values = [ingredient.name, ...(ingredient.aliases || [])];
    for (const value of values) {
      index.set(normalizeLookupValue(value), ingredient);
    }
  }

  return index;
}

export function getLookupKey(value = "") {
  return normalizeLookupValue(value);
}

export function splitAndNormalizeIngredients(ingredientsText = "") {
  return ingredientsText
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .flatMap((item) => expandMarketingIngredient(item))
    .map((item) => normalizeIngredientToken(item))
    .filter(Boolean);
}
