import test from "node:test";
import assert from "node:assert/strict";
import { extractProductInfo } from "../src/lib/ingredient-extractor.js";
import { verifyIngredientCandidate } from "../src/lib/url-analysis/ingredient-verifier.js";

const domHtml = `
  <html>
    <head><title>Test Face Wash</title></head>
    <body>
      <section>
        <h2>Ingredients</h2>
        <div>
          Water, Glycerin, Niacinamide, Panthenol, Cetearyl Alcohol,
          Sodium Benzoate, Citric Acid, Xanthan Gum, Tocopherol
        </div>
      </section>
    </body>
  </html>
`;

const nextDataHtml = `
  <html>
    <body>
      <script id="__NEXT_DATA__" type="application/json">
        {"props":{"pageProps":{"product":{"name":"Hydra Gel","brand":"Test Brand","ingredients":"Water, Glycerin, Panthenol, Niacinamide, Sodium Benzoate, Citric Acid, Xanthan Gum, Tocopherol"}}}}
      </script>
    </body>
  </html>
`;

const nuxtHtml = `
  <html>
    <body>
      <script>
        window.__NUXT__ = { product: { name: "Barrier Calm Cleanser", brand: "Nuxt Brand", sku: "ABC1234", ingredients: "Water, Glycerin, Niacinamide, Panthenol, Cetearyl Alcohol, Sodium Benzoate, Citric Acid, Xanthan Gum, Tocopherol" } };
      </script>
    </body>
  </html>
`;

const ingredientTableHtml = `
  <html>
    <body>
      <section>
        <h2>Key Ingredients</h2>
        <div>Rice Water, Niacinamide, Ceramide</div>
      </section>
      <section>
        <h2>Ingredients</h2>
        <table>
          <tr><th>Ingredient</th><th>Ingredient Type</th><th>Source</th><th>Benefit</th></tr>
          <tr><td>Aqua (Water)</td><td>Water</td><td>Water</td><td>Solvent</td></tr>
          <tr><td>Niacinamide</td><td>Synthetic</td><td>Lab</td><td>Brightening</td></tr>
          <tr><td>Caprylic / Capric Triglyceride</td><td>Synthetic</td><td>Lab</td><td>Emollient</td></tr>
          <tr><td>Propanediol</td><td>Synthetic</td><td>Lab</td><td>Humectant</td></tr>
          <tr><td>Pentylene Glycol</td><td>Synthetic</td><td>Lab</td><td>Moisturizer</td></tr>
          <tr><td>Oryza Sativa (Rice) Water Extract</td><td>Natural</td><td>Rice</td><td>Moisturizer</td></tr>
          <tr><td>Phenoxyethanol</td><td>Synthetic</td><td>Lab</td><td>Preservative</td></tr>
          <tr><td>Sodium Benzoate</td><td>Synthetic</td><td>Lab</td><td>Preservative</td></tr>
          <tr><td>Potassium Sorbate</td><td>Synthetic</td><td>Lab</td><td>Preservative</td></tr>
        </table>
      </section>
    </body>
  </html>
`;

const ambiguousHtml = `
  <html>
    <head><title>Glow Cleanser</title></head>
    <body>
      <section>
        <h2>Key Ingredients</h2>
        <div>Niacinamide, Rice Water, Vitamin B5</div>
      </section>
      <section>
        <h2>Full Ingredients</h2>
        <div>
          Water, Glycerin, Niacinamide, Panthenol, Cocamidopropyl Betaine,
          Sodium Cocoyl Isethionate, Xanthan Gum, Sodium Benzoate, Citric Acid
        </div>
      </section>
    </body>
  </html>
`;

test("DOM-first extraction finds ingredient section before regex fallback", async () => {
  const extracted = await extractProductInfo(domHtml, "Test Face Wash", {
    sourceUrl: "http://localhost/product",
    sourceWebsite: "Generic Website"
  });

  assert.equal(extracted.ingredientCandidates[0].extractionMethod, "dom-heading");
  assert.match(extracted.ingredientCandidates[0].rawExtractedIngredients, /Niacinamide/);
});

test("DOM table extraction converts ingredient tables into full ingredient candidates", async () => {
  const extracted = await extractProductInfo(ingredientTableHtml, "Korean Rice Water Hydra Glow Moisturizer", {
    sourceUrl: "http://localhost/pilgrim-style-table",
    sourceWebsite: "Generic Website"
  });

  assert.equal(extracted.ingredientCandidates[0].extractionMethod, "dom-table");
  assert.match(extracted.ingredientCandidates[0].rawExtractedIngredients, /Caprylic \/ Capric Triglyceride/);
  assert.ok(extracted.ingredientCandidates[0].parsedIngredientList.length >= 8);
});

test("Deterministic ranking prefers full ingredients over key ingredients", async () => {
  const originalProvider = process.env.AI_EXTRACTION_PROVIDER;
  const originalMistralKey = process.env.MISTRAL_API_KEY;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  delete process.env.AI_EXTRACTION_PROVIDER;
  delete process.env.MISTRAL_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const extracted = await extractProductInfo(ambiguousHtml, "Glow Cleanser", {
      sourceUrl: "http://localhost/ambiguous-product",
      sourceWebsite: "Generic Website"
    });

    assert.match(extracted.ingredientCandidates[0].rawExtractedIngredients, /Cocamidopropyl Betaine/);
    assert.equal(extracted.ingredientCandidates[0].metadata.matchedHeading, "Full Ingredients");
  } finally {
    process.env.AI_EXTRACTION_PROVIDER = originalProvider;
    process.env.MISTRAL_API_KEY = originalMistralKey;
    process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
});

test("AI candidate ranking can prioritize the full ingredient block with Mistral", async () => {
  const originalProvider = process.env.AI_EXTRACTION_PROVIDER;
  const originalKey = process.env.MISTRAL_API_KEY;
  const originalModel = process.env.MISTRAL_EXTRACTION_MODEL;
  const originalFetch = global.fetch;

  process.env.AI_EXTRACTION_PROVIDER = "mistral";
  process.env.MISTRAL_API_KEY = "test-mistral-key";
  process.env.MISTRAL_EXTRACTION_MODEL = "mistral-large-latest";
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                selectedIndexes: [1],
                reason: "Candidate 1 is the full INCI list, while Candidate 0 is only a key-ingredient callout."
              })
            }
          }
        ]
      };
    }
  });

  try {
    const extracted = await extractProductInfo(ambiguousHtml, "Glow Cleanser", {
      sourceUrl: "http://localhost/ambiguous-product",
      sourceWebsite: "Generic Website"
    });

    assert.match(extracted.ingredientCandidates[0].rawExtractedIngredients, /Cocamidopropyl Betaine/);
    assert.equal(extracted.ingredientCandidates[0].metadata.aiSelection.provider, "mistral");
    assert.match(extracted.ingredientCandidates[0].metadata.aiSelection.reason, /full INCI list/i);
  } finally {
    process.env.AI_EXTRACTION_PROVIDER = originalProvider;
    process.env.MISTRAL_API_KEY = originalKey;
    process.env.MISTRAL_EXTRACTION_MODEL = originalModel;
    global.fetch = originalFetch;
  }
});

test("Structured extraction reads __NEXT_DATA__ ingredient payloads", async () => {
  const extracted = await extractProductInfo(nextDataHtml, "Hydra Gel", {
    sourceUrl: "http://localhost/product",
    sourceWebsite: "Generic Website"
  });

  assert.ok(
    extracted.ingredientCandidates.some((candidate) => candidate.extractionMethod === "__next_data__")
  );
});

test("Structured extraction reads __NUXT__ payloads and captures SKU", async () => {
  const extracted = await extractProductInfo(nuxtHtml, "Barrier Calm Cleanser", {
    sourceUrl: "http://localhost/product",
    sourceWebsite: "Generic Website"
  });

  assert.ok(
    extracted.ingredientCandidates.some((candidate) => candidate.extractionMethod === "__nuxt__")
  );
  assert.equal(extracted.brand, "Nuxt Brand");
  assert.equal(extracted.sku, "ABC1234");
});

test("Ingredient candidate verification preserves rejection reason and rule", async () => {
  const candidate = {
    sourceUrl: "http://localhost/product",
    sourceWebsite: "Generic Website",
    stage: "retailer-page",
    extractionMethod: "dom-heading",
    ingredientSource: "Ingredients",
    rawExtractedIngredients: "Niacinamide, Panthenol, Glycerin",
    parsedIngredientList: [],
    metadata: {}
  };

  const verified = await verifyIngredientCandidate(candidate, {
    productName: "Short List",
    brand: "Generic",
    minIngredientCount: 8
  });

  assert.equal(verified.verified, false);
  assert.equal(verified.verification.rule, "MIN_INGREDIENT_COUNT");
  assert.match(verified.rejectionReason, /too short to trust/i);
});
