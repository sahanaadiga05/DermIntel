import { getIngredientKnowledgeBase } from "../lib/knowledge-base/ingredient-repository.js";
import { getLookupKey, splitAndNormalizeIngredients } from "../lib/formula-analysis/ingredient-normalizer.js";

let FuseModule = null;
let attemptedFuseLoad = false;

const SYNONYM_MAP = {
  ha: ["sodium hyaluronate"],
  hyaluronic: ["hyaluronic acid"],
  hyaluronicacid: ["hyaluronic acid"],
  vitamine: ["tocopherol"],
  vitaminb5: ["panthenol"],
  vitb5: ["panthenol"],
  ricewater: ["oryza sativa extract"],
  cica: ["centella asiatica extract"],
  centella: ["centella asiatica extract"],
  salicylic: ["salicylic acid"],
  bha: ["salicylic acid"],
  aloe: ["aloe barbadensis leaf juice"]
};

async function getFuse() {
  if (!attemptedFuseLoad) {
    attemptedFuseLoad = true;
    try {
      FuseModule = await import("fuse.js");
    } catch (_error) {
      FuseModule = null;
    }
  }

  return FuseModule?.default || FuseModule || null;
}

function buildAliasMap(catalog = []) {
  const aliasMap = new Map();

  for (const ingredient of catalog) {
    const values = [ingredient.name, ...(ingredient.aliases || [])];
    for (const value of values) {
      aliasMap.set(getLookupKey(value), ingredient);
    }
  }

  for (const [key, values] of Object.entries(SYNONYM_MAP)) {
    aliasMap.set(key, values[0]);
  }

  return aliasMap;
}

function expandSynonym(token = "") {
  const key = getLookupKey(token);
  return SYNONYM_MAP[key] || [token];
}

export function normalizeIngredientListForScoring(ingredientsText = "") {
  return splitAndNormalizeIngredients(ingredientsText);
}

export async function normalizeIngredientCandidate(candidate = {}) {
  const catalog = await getIngredientKnowledgeBase();
  const aliasMap = buildAliasMap(catalog);
  const Fuse = await getFuse();
  const fuse = Fuse
    ? new Fuse(catalog, {
        keys: ["name", "aliases"],
        threshold: 0.2,
        ignoreLocation: true,
        includeScore: true
      })
    : null;

  const sourceTokens = candidate.parsedIngredientList?.length
    ? candidate.parsedIngredientList
    : splitAndNormalizeIngredients(candidate.rawExtractedIngredients || "");

  const normalizedRows = [];

  for (const rawToken of sourceTokens) {
    for (const expandedToken of expandSynonym(rawToken)) {
      const lookupKey = getLookupKey(expandedToken);
      const directMatch = aliasMap.get(lookupKey);

      if (directMatch && typeof directMatch === "object") {
        normalizedRows.push({
          rawName: rawToken,
          normalizedInput: expandedToken,
          canonicalName: directMatch.name,
          ingredient: directMatch,
          matchType: getLookupKey(directMatch.name) === lookupKey ? "exact" : "alias"
        });
        continue;
      }

      if (typeof directMatch === "string") {
        const ingredient = catalog.find((entry) => getLookupKey(entry.name) === getLookupKey(directMatch));
        if (ingredient) {
          normalizedRows.push({
            rawName: rawToken,
            normalizedInput: expandedToken,
            canonicalName: ingredient.name,
            ingredient,
            matchType: "synonym"
          });
          continue;
        }
      }

      const fuzzyMatch = fuse?.search(expandedToken, { limit: 1 })?.[0];
      if (fuzzyMatch?.item && (fuzzyMatch.score ?? 1) <= 0.2) {
        normalizedRows.push({
          rawName: rawToken,
          normalizedInput: expandedToken,
          canonicalName: fuzzyMatch.item.name,
          ingredient: fuzzyMatch.item,
          matchType: "fuzzy"
        });
        continue;
      }

      normalizedRows.push({
        rawName: rawToken,
        normalizedInput: expandedToken,
        canonicalName: expandedToken,
        ingredient: null,
        matchType: "unknown"
      });
    }
  }

  const canonicalIngredientList = [...new Map(normalizedRows.map((row) => {
    // Fuzzy matches are useful for safety scoring, but must never rename or
    // collapse distinct ingredients in the formula shown to the user.
    const outputName = row.matchType === "fuzzy" || row.matchType === "unknown"
      ? row.normalizedInput
      : row.canonicalName;
    return [getLookupKey(outputName), outputName];
  })).values()];

  return {
    ...candidate,
    parsedIngredientList: sourceTokens,
    ingredientRows: normalizedRows,
    canonicalIngredientList
  };
}
