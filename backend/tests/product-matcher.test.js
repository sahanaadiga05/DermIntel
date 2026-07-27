import test from "node:test";
import assert from "node:assert/strict";
import { matchProducts } from "../src/lib/url-analysis/product-matcher.js";

test("Chemist At Play official product matches a verbose retailer title semantically", () => {
  const matched = matchProducts(
    {
      brand: "Chemist At Play",
      name: "Chemist At Play 2% Salicylic Acid Face Wash for Oily & Acne-Prone Skin Controls Oil, Prevents Acne & Fades Acne Marks"
    },
    {
      brand: "Chemist At Play",
      name: "Oil & Acne Control Face Wash",
      description: "2% Salicylic Acid + Niacinamide cleanser for oily, acne-prone skin and post-acne marks."
    }
  );

  assert.equal(matched.accepted, true);
  assert.ok(matched.finalScore >= 85);
  assert.equal(matched.breakdown.brand, 100);
  assert.equal(matched.breakdown.productType, 100);
  assert.ok((matched.breakdown.activeIngredients ?? 0) >= 50);
  assert.ok((matched.breakdown.skinConcerns ?? 0) >= 75);
});

test("Short official title stays in the review window instead of hard-failing", () => {
  const matched = matchProducts(
    {
      brand: "Chemist At Play",
      name: "Chemist At Play 2% Salicylic Acid Face Wash for Oily & Acne-Prone Skin"
    },
    {
      brand: "Chemist At Play",
      name: "Oil & Acne Control Face Wash"
    }
  );

  assert.equal(matched.accepted, false);
  assert.equal(matched.shouldContinue, true);
  assert.ok(matched.finalScore >= 70);
  assert.ok(matched.finalScore < 85);
});

test("Minimalist cleanser titles match across cleaner official naming", () => {
  const matched = matchProducts(
    {
      brand: "Minimalist",
      name: "Minimalist 2% Salicylic Acid Face Cleanser For Oily & Acne Prone Skin"
    },
    {
      brand: "Minimalist",
      name: "Salicylic Acid + LHA 2% Cleanser",
      description: "Face wash for oily and acne-prone skin."
    }
  );

  assert.equal(matched.accepted, true);
  assert.ok(matched.finalScore >= 85);
});

test("Cetaphil cleanser matching handles skin-type phrasing differences", () => {
  const matched = matchProducts(
    {
      brand: "Cetaphil",
      name: "Cetaphil Gentle Skin Cleanser Dry to Normal Sensitive Skin"
    },
    {
      brand: "Cetaphil",
      name: "Gentle Skin Cleanser",
      description: "Hydrating face cleanser for dry to normal, sensitive skin."
    }
  );

  assert.equal(matched.accepted, true);
  assert.ok(matched.finalScore >= 85);
});

test("CeraVe moisturizer matching preserves barrier-support signals", () => {
  const matched = matchProducts(
    {
      brand: "CeraVe",
      name: "CeraVe Moisturizing Cream For Dry To Very Dry Skin"
    },
    {
      brand: "CeraVe",
      name: "Moisturizing Cream",
      description: "Ceramide moisturizer with hyaluronic acid for dry to very dry skin."
    }
  );

  assert.equal(matched.accepted, true);
  assert.ok(matched.finalScore >= 85);
});

test("The Ordinary serum titles match by brand and active ingredients", () => {
  const matched = matchProducts(
    {
      brand: "The Ordinary",
      name: "The Ordinary Niacinamide 10% + Zinc 1%"
    },
    {
      brand: "The Ordinary",
      name: "Niacinamide 10% + Zinc 1%",
      description: "High-strength serum featuring niacinamide and zinc PCA."
    }
  );

  assert.equal(matched.accepted, true);
  assert.ok(matched.finalScore >= 85);
  assert.ok((matched.breakdown.activeIngredients ?? 0) >= 80);
});
