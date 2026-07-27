import { compareIngredientLists, verifyIngredientCandidate } from "../lib/url-analysis/ingredient-verifier.js";

export async function verifyResolvedIngredients(candidate, options = {}) {
  return verifyIngredientCandidate(candidate, options);
}

export function chooseBestIngredientSource(candidates = []) {
  return compareIngredientLists(candidates);
}
