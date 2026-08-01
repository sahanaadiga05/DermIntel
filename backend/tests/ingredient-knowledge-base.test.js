import assert from "node:assert/strict";
import test from "node:test";
import { buildIngredientCreateData, buildSeedIngredientKnowledge, ensureStructuredIngredientKnowledge } from "../src/lib/knowledge-base/ingredient-knowledge.js";
import { getIngredientKnowledgeBase } from "../src/lib/knowledge-base/ingredient-repository.js";
import { ingredientCatalog } from "../src/data/mock-data.js";

test("ensureStructuredIngredientKnowledge expands a legacy ingredient into the richer phase-1 shape", () => {
  const ingredient = ensureStructuredIngredientKnowledge({
    name: "niacinamide",
    aliases: ["Vitamin B3", { alias: "Nicotinamide" }],
    purpose: "Barrier Repair - Brightening",
    suitableSkinTypes: ["OILY", "COMBINATION", "SENSITIVE"],
    avoidSkinTypes: [],
    comedogenicRating: 0,
    irritationScore: 1,
    riskFlags: ["low-irritant-potential"],
    simpleExplanation: "Supports the skin barrier and helps visibly improve uneven tone."
  });

  assert.equal(ingredient.inciName, "niacinamide");
  assert.deepEqual(ingredient.aliases, ["Vitamin B3", "Nicotinamide"]);
  assert.deepEqual(ingredient.functions, ["Barrier Repair", "Brightening"]);
  assert.deepEqual(ingredient.skinTypes, ["OILY", "COMBINATION", "SENSITIVE"]);
  assert.deepEqual(ingredient.references, []);
  assert.equal(ingredient.evidenceLevel, null);
});

test("buildSeedIngredientKnowledge applies curated phase-1 scientific overrides to starter ingredients", () => {
  const niacinamideSeed = ingredientCatalog.find((ingredient) => ingredient.name === "niacinamide");
  const enriched = buildSeedIngredientKnowledge(niacinamideSeed);

  assert.ok(enriched.aliases.includes("Nicotinamide"));
  assert.ok(enriched.functions.includes("Sebum Control"));
  assert.ok(enriched.helps.includes("PIGMENTATION"));
  assert.equal(enriched.evidenceLevel, "HIGH");
  assert.ok(enriched.references.length >= 2);
});

test("buildIngredientCreateData preserves old fields while adding structured knowledge fields", () => {
  const createData = buildIngredientCreateData({
    name: "glycerin",
    purpose: "Humectant",
    suitableSkinTypes: ["DRY", "OILY"],
    avoidSkinTypes: [],
    functions: ["Hydration"],
    helps: ["DRYNESS", "DEHYDRATION"],
    avoidFor: [],
    tags: ["hydrating"],
    riskFlags: [],
    evidenceLevel: "High",
    references: [{ citation: "Example reference", url: "https://example.test/reference" }],
    comedogenicRating: 0,
    irritationScore: 0,
    simpleExplanation: "Draws water into the outer skin layers."
  });

  assert.equal(createData.name, "glycerin");
  assert.equal(createData.purpose, "Humectant");
  assert.deepEqual(createData.functions, ["Humectant", "Barrier Support", "Skin Conditioning"]);
  assert.deepEqual(createData.helps, ["HYDRATION", "DEHYDRATION", "DRYNESS", "BARRIER_REPAIR"]);
  assert.equal(createData.evidenceLevel, "HIGH");
  assert.equal(createData.references.length, 2);
});

test("getIngredientKnowledgeBase exposes curated structured fields for source-backed seed ingredients", async () => {
  const catalog = await getIngredientKnowledgeBase();
  const niacinamide = catalog.find((ingredient) => ingredient.name === "niacinamide");
  const fragrance = catalog.find((ingredient) => ingredient.name === "fragrance");
  const phenoxyethanol = catalog.find((ingredient) => ingredient.name === "phenoxyethanol");
  const tocopherol = catalog.find((ingredient) => ingredient.name === "tocopherol");

  assert.ok(niacinamide);
  assert.equal(niacinamide.inciName, "niacinamide");
  assert.ok(niacinamide.functions.includes("Brightening"));
  assert.ok(niacinamide.helps.includes("EXCESS_OIL"));
  assert.ok(Array.isArray(niacinamide.references));
  assert.ok(niacinamide.references.some((reference) => /pubmed/i.test(reference.url)));

  assert.ok(fragrance);
  assert.equal(fragrance.evidenceLevel, "HIGH");
  assert.ok(fragrance.avoidFor.includes("FRAGRANCE_ALLERGY"));
  assert.ok(fragrance.references.some((reference) => /dermnet/i.test(reference.url)));

  assert.ok(phenoxyethanol);
  assert.equal(phenoxyethanol.evidenceLevel, "HIGH");
  assert.ok(phenoxyethanol.avoidFor.includes("PRESERVATIVE_ALLERGY"));
  assert.ok(phenoxyethanol.references.some((reference) => /31588615/.test(reference.url)));

  assert.ok(tocopherol);
  assert.ok(tocopherol.functions.includes("Antioxidant"));
  assert.ok(tocopherol.references.some((reference) => /30235959/.test(reference.url)));
});

test("phase-1 structured knowledge coverage stays complete for every seeded ingredient", () => {
  const uncovered = ingredientCatalog
    .map((ingredient) => ({
      name: ingredient.name,
      structured: buildSeedIngredientKnowledge(ingredient)
    }))
    .filter(({ structured }) => !structured.functions.length || !structured.evidenceLevel || !structured.references.length);

  assert.deepEqual(uncovered, []);
});
