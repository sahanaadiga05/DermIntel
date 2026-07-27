import { buildAliasIndex, getLookupKey } from "./ingredient-normalizer.js";

function levenshtein(a = "", b = "") {
  const matrix = Array.from({ length: b.length + 1 }, () => []);

  for (let i = 0; i <= b.length; i += 1) {
    matrix[i][0] = i;
  }

  for (let j = 0; j <= a.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export function createIngredientMatcher(ingredientCatalog = []) {
  const aliasIndex = buildAliasIndex(ingredientCatalog);
  const ingredientEntries = ingredientCatalog.flatMap((ingredient) => [
    { value: ingredient.name, ingredient, matchType: "exact" },
    ...(ingredient.aliases || []).map((alias) => ({ value: alias, ingredient, matchType: "alias" }))
  ]);

  return function matchIngredient(rawName = "") {
    const lookupKey = getLookupKey(rawName);
    if (!lookupKey) {
      return { ingredient: null, matchType: "unknown", normalizedName: rawName };
    }

    const exactMatch = ingredientCatalog.find((ingredient) => getLookupKey(ingredient.name) === lookupKey);
    if (exactMatch) {
      return { ingredient: exactMatch, matchType: "exact", normalizedName: exactMatch.name, sourceName: rawName };
    }

    const aliasMatch = aliasIndex.get(lookupKey);
    if (aliasMatch) {
      const matchType = getLookupKey(aliasMatch.name) === lookupKey ? "exact" : "alias";
      return { ingredient: aliasMatch, matchType, normalizedName: aliasMatch.name, sourceName: rawName };
    }

    let bestEntry = null;
    let bestDistance = Infinity;

    for (const entry of ingredientEntries) {
      const distance = levenshtein(lookupKey, getLookupKey(entry.value));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestEntry = entry;
      }
    }

    const maxDistance = Math.max(1, Math.floor(lookupKey.length * 0.18));
    if (bestEntry && bestDistance <= maxDistance) {
      return {
        ingredient: bestEntry.ingredient,
        matchType: bestEntry.matchType === "exact" ? "fuzzy" : `fuzzy-${bestEntry.matchType}`,
        normalizedName: bestEntry.ingredient.name,
        sourceName: rawName
      };
    }

    return { ingredient: null, matchType: "unknown", normalizedName: rawName, sourceName: rawName };
  };
}
