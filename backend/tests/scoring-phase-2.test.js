import assert from "node:assert/strict";
import test from "node:test";
import { analyzeFormula } from "../src/lib/scoring.js";

const acneProfile = {
  skinType: "OILY",
  skinSensitivity: "SLIGHTLY_SENSITIVE",
  primarySkinConcerns: ["ACNE", "PIGMENTATION"],
  primarySkincareGoals: ["OIL_CONTROL", "BRIGHTENING"],
  cosmeticAllergies: ["NONE"],
  avoidIngredients: ["NONE"]
};

const sensitiveProfile = {
  skinType: "SENSITIVE",
  skinSensitivity: "VERY_SENSITIVE",
  primarySkinConcerns: ["REDNESS", "DRYNESS"],
  primarySkincareGoals: ["BARRIER_REPAIR", "REDUCE_REDNESS"],
  cosmeticAllergies: ["FRAGRANCE"],
  avoidIngredients: ["FRAGRANCE"]
};

test("phase-2 scoring rewards evidence-backed acne and oil-control ingredients", async () => {
  const result = await analyzeFormula({
    profile: acneProfile,
    productName: "",
    ingredientsText: "Water, Niacinamide, Salicylic Acid, Zinc PCA, Glycerin, Panthenol, Sodium Benzoate, Citric Acid"
  });

  assert.equal(result.status, "VERIFIED_INGREDIENTS_FOUND");
  assert.equal(result.verifiedIngredients, true);
  assert.ok(result.suitabilityScore >= 70);
  assert.ok(result.overallScore >= 70);
  assert.ok(result.pros.some((entry) => /niacinamide|salicylic acid|zinc pca/i.test(entry)));
  assert.ok(result.strengths.some((entry) => /niacinamide|salicylic acid|zinc pca/i.test(entry)));

  const niacinamideRow = result.ingredientBreakdown.find((entry) => entry.name === "niacinamide");
  assert.ok(niacinamideRow);
  assert.equal(niacinamideRow.suitability, "Good Match");
});

test("phase-2 scoring penalizes fragrance-heavy sensitive-skin conflicts deterministically", async () => {
  const result = await analyzeFormula({
    profile: sensitiveProfile,
    productName: "",
    ingredientsText: "Water, Glycerin, Fragrance, Alcohol Denat, Menthol, Cocamidopropyl Betaine, Sodium Benzoate, Citric Acid"
  });

  assert.equal(result.status, "VERIFIED_INGREDIENTS_FOUND");
  assert.ok(result.suitabilityScore < 60);
  assert.ok(result.safetyScore < 85);
  assert.ok(result.cons.some((entry) => /fragrance|sensitive|allergy/i.test(entry)));
  assert.ok(result.weaknesses.some((entry) => /fragrance|alcohol denat|menthol/i.test(entry)));

  const fragranceRow = result.ingredientBreakdown.find((entry) => entry.name === "fragrance");
  assert.ok(fragranceRow);
  assert.equal(fragranceRow.suitability, "Low Match");
});
