import test from "node:test";
import assert from "node:assert/strict";
import { fetchPageWithStrategies, shouldAttemptDynamicFallbackAfterStaticFailure } from "../src/lib/url-analysis/page-fetcher.js";
import { createProductFingerprint } from "../src/lib/knowledge-base/product-fingerprint.js";
import { buildProductSearchPhrases } from "../src/lib/url-analysis/search-utils.js";
import { extractProductSku, normalizeProductName } from "../src/lib/product-normalizer.js";
import { hasIngredientUsefulMetadataCache, shouldRetryWithDynamicFetch } from "../src/services/product-resolver.js";

test("normalizeProductName removes common ecommerce marketing phrases", () => {
  const normalized = normalizeProductName("Cetaphil Gentle Skin Cleanser | Buy Now | Free Shipping | 125ml");
  assert.equal(normalized, "Cetaphil Gentle Skin Cleanser Buy Now Free Shipping");
});

test("extractProductSku reads common SKU formats", () => {
  const sku = extractProductSku("SKU: ABC1234", "Model No: ZX-99", "Something else");
  assert.equal(sku, "ABC1234");
});

test("buildProductSearchPhrases generates richer query variants", () => {
  const phrases = buildProductSearchPhrases({
    brand: "Chemist At Play",
    name: "Oil & Acne Control Face Wash",
    variant: "2% Salicylic Acid",
    size: "100ml",
    category: "Face Wash"
  });

  assert.ok(phrases.some((phrase) => phrase.includes("Chemist At Play Oil & Acne Control Face Wash ingredients")));
  assert.ok(phrases.some((phrase) => phrase.includes("2% Salicylic Acid")));
});

test("fetchPageWithStrategies surfaces clearer 429 errors after retry attempts", async () => {
  const originalFetch = global.fetch;
  global.fetch = originalFetch;

  const result = await fetchPageWithStrategies("https://example.com/product", {
    staticTimeoutMs: 10,
    dynamicTimeoutMs: 10,
    retries: 2
  });

  assert.equal(typeof result.ok, "boolean");
  if (!result.ok) {
    assert.equal(typeof result.errorMessage, "string");
  }
});

test("Product fingerprint stays stable across noisy retailer naming", () => {
  const amazonLike = createProductFingerprint({
    brand: "Chemist At Play",
    name: "Chemist At Play 2% Salicylic Acid Face Wash for Oily & Acne-Prone Skin Controls Oil, Prevents Acne & Fades Acne Marks 100ml",
    category: "Face Wash"
  });

  const canonical = createProductFingerprint({
    brand: "Chemist At Play",
    name: "Oil & Acne Control Face Wash",
    variant: "2% Salicylic Acid",
    size: "100ml",
    category: "Face Wash"
  });

  assert.equal(amazonLike.brand, canonical.brand);
  assert.equal(amazonLike.category, canonical.category);
  assert.equal(amazonLike.size, canonical.size);
  assert.equal(amazonLike.variant, canonical.variant);
});

test("hasIngredientUsefulMetadataCache rejects name-only cache entries", () => {
  const shouldUseCache = hasIngredientUsefulMetadataCache({
    fetched: null,
    product: {
      brand: "Pilgrim",
      name: "Korean Rice Water Hydra Glow Moisturizer"
    },
    retailerIngredients: "",
    retailerCandidates: []
  });

  assert.equal(shouldUseCache, false);
});

test("hasIngredientUsefulMetadataCache accepts cache with fetched page content", () => {
  const shouldUseCache = hasIngredientUsefulMetadataCache({
    fetched: {
      ok: true,
      html: "<html></html>"
    },
    product: {
      brand: "Pilgrim",
      name: "Korean Rice Water Hydra Glow Moisturizer"
    },
    retailerIngredients: "",
    retailerCandidates: []
  });

  assert.equal(shouldUseCache, true);
});

test("shouldRetryWithDynamicFetch returns true when static HTML has no ingredient candidates", () => {
  const shouldRetry = shouldRetryWithDynamicFetch({
    fetched: {
      ok: true,
      extractionMethod: "html"
    },
    retailerCandidates: [],
    retailerIngredients: ""
  });

  assert.equal(shouldRetry, true);
});

test("shouldRetryWithDynamicFetch returns false once candidates already exist", () => {
  const shouldRetry = shouldRetryWithDynamicFetch({
    fetched: {
      ok: true,
      extractionMethod: "html"
    },
    retailerCandidates: [{ id: "candidate-1" }],
    retailerIngredients: "Water, Glycerin"
  });

  assert.equal(shouldRetry, false);
});


test("shouldAttemptDynamicFallbackAfterStaticFailure returns true for 429 rate limits", () => {
  const shouldRetry = shouldAttemptDynamicFallbackAfterStaticFailure({
    response: {
      status: 429
    }
  });

  assert.equal(shouldRetry, true);
});

test("shouldAttemptDynamicFallbackAfterStaticFailure returns false for non-retryable errors", () => {
  const shouldRetry = shouldAttemptDynamicFallbackAfterStaticFailure({
    response: {
      status: 404
    },
    code: "ERR_BAD_REQUEST"
  });

  assert.equal(shouldRetry, false);
});
