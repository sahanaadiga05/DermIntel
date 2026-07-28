import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanOcrIngredientTextWithAi,
  filterAiIngredientsByOcrText,
  normalizeAndSelectImages,
  rankImageCandidates,
  scoreOcrIngredientText,
  searchProductImagesForIngredients,
  selectBestIngredientOcrResult
} from "../src/services/product-image-ingredient-fallback.js";

const verifiedOcrText = [
  "Ingredients: Aqua",
  "Glycerin",
  "Niacinamide",
  "Panthenol",
  "Cetearyl Alcohol",
  "Sodium Benzoate",
  "Citric Acid",
  "Xanthan Gum",
  "Tocopherol"
].join(", ");

const shorterOcrText = "Ingredients: Aqua, Glycerin, Fragrance";

test("generic image normalization keeps opaque CDN product image URLs", () => {
  const images = normalizeAndSelectImages(
    [
      {
        url: "https://cdn.shopify.com/s/files/1/0789/1234/files/label-image.webp?v=1712345678",
        source: "network-response",
        width: 1400,
        height: 1400
      },
      {
        url: "https://example.com/assets/logo.svg",
        source: "rendered-dom",
        alt: "Site logo",
        className: "logo",
        width: 240,
        height: 80
      }
    ],
    "https://brand.example/products/cleanser"
  );

  assert.equal(images.length, 1);
  assert.match(images[0].url, /label-image\.webp/);
  assert.equal(images[0].source, "network-response");
});

test("generic image normalization extracts JSON-encoded gallery image attributes", () => {
  const images = normalizeAndSelectImages(
    [
      {
        url: '{"https://cdn.example.com/images/I/front-pack._SX38_SY50_.jpg":[38,50],"https://cdn.example.com/images/I/back-ingredients-label._SX38_SY50_.jpg":[38,50]}',
        source: "rendered-dom",
        sourceDetail: "data-a-dynamic-image",
        alt: "JSON dynamic gallery images"
      }
    ],
    "https://market.example.com/example-product/p/B000000"
  );

  assert.ok(images.length >= 2);
  assert.ok(images.some((image) => image.url.includes("front-pack")));
  assert.ok(images.some((image) => image.url.includes("back-ingredients-label")));
  assert.ok(images.some((image) => image.url.includes("back-ingredients-label") && image.url.endsWith(".jpg")));
});
test("generic image normalization prefers highest resolution variants", () => {
  const images = normalizeAndSelectImages(
    [
      {
        url: "https://images.examplecdn.com/product/cleanser-back.jpg?width=160&quality=60",
        source: "rendered-dom",
        alt: "Back ingredient label",
        width: 160,
        height: 160
      }
    ],
    "https://brand.example/products/cleanser"
  );

  assert.ok(images.length >= 1);
  assert.match(images[0].url, /width=1600/);
  assert.match(images[0].url, /quality=95/);
  assert.ok(images[0].resolution >= 1600);
});

test("product image ranking prefers back-label and ingredient images", () => {
  const ranked = rankImageCandidates([
    {
      url: "https://cdn.example.com/front-hero.jpg",
      alt: "Front pack lifestyle banner",
      className: "hero banner",
      width: 1200,
      height: 900
    },
    {
      url: "https://cdn.example.com/product-back-ingredients-label.jpg",
      alt: "Back label with ingredients",
      className: "product-gallery-image",
      width: 1200,
      height: 900
    },
    {
      url: "https://cdn.example.com/logo.svg",
      alt: "Logo",
      className: "site-logo",
      width: 300,
      height: 80
    }
  ]);

  assert.equal(ranked[0].url, "https://cdn.example.com/product-back-ingredients-label.jpg");
  assert.ok(ranked[0].score > ranked[1].score);
});

test("OCR ingredient scoring detects ingredient-label text from keywords and comma lists", () => {
  const ingredientScore = scoreOcrIngredientText(verifiedOcrText);
  const marketingScore = scoreOcrIngredientText("Brightens skin. Makes skin glow. Dermatologically tested. Buy one get one.");

  assert.equal(ingredientScore.isIngredientText, true);
  assert.ok(ingredientScore.ingredientLikeCount >= 8);
  assert.ok(ingredientScore.score > marketingScore.score);
  assert.equal(marketingScore.isIngredientText, false);
});

test("best OCR result selects the most complete ingredient image", () => {
  const best = selectBestIngredientOcrResult([
    {
      image: { url: "https://cdn.example.com/front.jpg" },
      provider: "test-ocr",
      rawText: "Oil control face wash with salicylic acid",
      extractedIngredientsText: "Oil control face wash with salicylic acid"
    },
    {
      image: { url: "https://cdn.example.com/key-ingredients.jpg" },
      provider: "test-ocr",
      rawText: shorterOcrText,
      extractedIngredientsText: shorterOcrText
    },
    {
      image: { url: "https://cdn.example.com/back-label.jpg" },
      provider: "test-ocr",
      rawText: verifiedOcrText,
      extractedIngredientsText: verifiedOcrText
    }
  ]);

  assert.equal(best.image.url, "https://cdn.example.com/back-label.jpg");
  assert.ok(best.ingredientLikeCount >= 8);
});

test("image fallback reports the exact Playwright zero-image collection reason", async () => {
  const emptyImages = [];
  Object.defineProperty(emptyImages, "collectionDebug", {
    enumerable: false,
    value: {
      pageTitle: "Security check",
      currentUrl: "https://example.com/product",
      reachedProductPage: true,
      captchaOrAntiBotDetected: true,
      selectorsChecked: ["[class*='thumb' i]"],
      inspectedWindowVariables: ["__NEXT_DATA__"],
      zeroImageReason: "Playwright reached https://example.com/product, but the page appears blocked by CAPTCHA or anti-bot protection."
    }
  });

  const result = await searchProductImagesForIngredients({
    inputUrl: "https://example.com/product",
    website: { websiteLabel: "Example" },
    product: { brand: "Example", name: "Cleanser" },
    collectImagesFn: async () => emptyImages
  });

  assert.equal(result.candidates.length, 0);
  assert.match(result.report.lastReason, /CAPTCHA|anti-bot/i);
  assert.equal(result.report.imageCollectionDebug.captchaOrAntiBotDetected, true);
  assert.deepEqual(result.report.imageCollectionDebug.inspectedWindowVariables, ["__NEXT_DATA__"]);
});
test("image fallback OCRs every collected image before choosing the verified ingredient label", async () => {
  const images = [
    { url: "https://cdn.example.com/front.jpg", alt: "Front pack", className: "product-gallery" },
    { url: "https://cdn.example.com/key-ingredients.jpg", alt: "Key ingredients", className: "product-gallery" },
    { url: "https://cdn.example.com/back-label.jpg", alt: "Back ingredients label", className: "product-gallery" }
  ];
  const ocrCalls = [];

  const result = await searchProductImagesForIngredients({
    inputUrl: "https://example.com/product",
    website: { websiteLabel: "Example" },
    product: { brand: "Example", name: "Cleanser" },
    collectImagesFn: async () => images,
    ocrFn: async ({ imageUrl }) => {
      ocrCalls.push(imageUrl);
      if (imageUrl.includes("back-label")) {
        return { provider: "test-ocr", rawText: verifiedOcrText, extractedIngredientsText: verifiedOcrText };
      }
      if (imageUrl.includes("key-ingredients")) {
        return { provider: "test-ocr", rawText: shorterOcrText, extractedIngredientsText: shorterOcrText };
      }
      return { provider: "test-ocr", rawText: "Front of pack cleanser image", extractedIngredientsText: "Front of pack cleanser image" };
    },
    cleanOcrTextFn: async ({ rawText }) => rawText
  });

  assert.deepEqual(ocrCalls.sort(), images.map((image) => image.url).sort());
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].verified, true);
  assert.equal(result.candidates[0].ingredientCount, 9);
  assert.equal(result.candidates[0].metadata.imageUrl, "https://cdn.example.com/back-label.jpg");
  assert.equal(result.candidates[0].extractionMethod, "product-image-ocr:test-ocr");
  assert.equal(result.candidates[0].sourceKind, "COMMUNITY");
});

test("image fallback keeps existing no-ingredients behavior when OCR text is not verifiable", async () => {
  const result = await searchProductImagesForIngredients({
    inputUrl: "https://example.com/product",
    website: { websiteLabel: "Example" },
    product: { brand: "Example", name: "Cleanser" },
    collectImagesFn: async () => [
      { url: "https://cdn.example.com/front.jpg", alt: "Front pack", className: "product-gallery" },
      { url: "https://cdn.example.com/routine.jpg", alt: "Routine lifestyle", className: "product-gallery" }
    ],
    ocrFn: async ({ imageUrl }) => ({
      provider: "test-ocr",
      rawText: imageUrl.includes("routine") ? "Use daily for glowing skin" : "Front cleanser packaging",
      extractedIngredientsText: imageUrl.includes("routine") ? "Use daily for glowing skin" : "Front cleanser packaging"
    }),
    cleanOcrTextFn: async ({ rawText }) => rawText
  });

  assert.equal(result.candidates.length, 0);
  assert.match(result.report.lastReason, /none contained ingredient-label text/i);
});

test("AI OCR cleanup cannot add ingredients that are not present in OCR text", async () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const originalFetch = global.fetch;
  process.env.OPENAI_API_KEY = "test-openai-key";
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                ingredients: ["Water", "Glycerin", "Niacinamide", "Retinol"]
              })
            }
          }
        ]
      };
    }
  });

  try {
    const cleaned = await cleanOcrIngredientTextWithAi({
      rawText: "Ingredients: Water, Glycer1n, N1acinam1de",
      product: { brand: "Example", name: "Cleanser" }
    });

    assert.match(cleaned, /Water/);
    assert.match(cleaned, /Glycerin/);
    assert.match(cleaned, /Niacinamide/);
    assert.doesNotMatch(cleaned, /Retinol/);
  } finally {
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
    global.fetch = originalFetch;
  }
});

test("AI ingredient support filter keeps OCR spelling corrections and rejects unsupported additions", () => {
  const filtered = filterAiIngredientsByOcrText(
    ["Water", "Glycerin", "Niacinamide", "Retinol"],
    "Ingredients: Water, Glycer1n, N1acinam1de"
  );

  assert.deepEqual(filtered, ["Water", "Glycerin", "Niacinamide"]);
});
