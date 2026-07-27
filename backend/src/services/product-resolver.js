import { getCachedProductMetadata, setCachedProductMetadata } from "../lib/cache-manager.js";
import { extractProductInfo } from "../lib/ingredient-extractor.js";
import { fetchDynamicHtml, fetchPageWithStrategies } from "../lib/url-analysis/page-fetcher.js";
import { detectSourceWebsite, isSearchEngineUrl } from "../lib/url-analysis/url-detector.js";
import { enrichProductIdentity } from "../lib/url-analysis/search-utils.js";
import { detectBrand, detectCategory, normalizeProductName, slugToTitle } from "../lib/product-normalizer.js";
import { logUrlAnalysis } from "../lib/url-analysis/logger.js";

function createStep(label, state, details = "") {
  return { label, state, details };
}

function buildBaseProduct(website, fallbackName) {
  return enrichProductIdentity({
    name: normalizeProductName(fallbackName || "Linked Product"),
    brand: detectBrand(fallbackName, website.hostname),
    category: detectCategory(fallbackName, website.parsedUrl.pathname),
    image: "",
    description: ""
  });
}

function formatProductSummary(product = {}) {
  const parts = [];

  if (product.brand) {
    parts.push(`Brand: ${product.brand}`);
  }

  if (product.name) {
    parts.push(`Product: ${product.name}`);
  }

  if (product.variant) {
    parts.push(`Variant: ${product.variant}`);
  }

  if (product.size) {
    parts.push(`Size: ${product.size}`);
  }

  return parts.join(" | ");
}

export function shouldRetryWithDynamicFetch({ fetched, retailerCandidates = [], retailerIngredients = "" } = {}) {
  return Boolean(
    fetched?.ok &&
    fetched.extractionMethod === "html" &&
    (!retailerIngredients || !retailerIngredients.trim()) &&
    (!Array.isArray(retailerCandidates) || retailerCandidates.length === 0)
  );
}

export function hasIngredientUsefulMetadataCache(metadataCache) {
  return Boolean(
    metadataCache?.fetched?.ok ||
    (Array.isArray(metadataCache?.retailerCandidates) && metadataCache.retailerCandidates.length > 0) ||
    (typeof metadataCache?.retailerIngredients === "string" && metadataCache.retailerIngredients.trim())
  );
}

function canReextractFromCachedHtml(metadataCache) {
  return Boolean(metadataCache?.fetched?.ok && metadataCache.fetched.html);
}

async function extractResolvedProductData({ html, fallbackName, inputUrl, sourceUrl, website, baseProduct }) {
  const extracted = await extractProductInfo(html, fallbackName, {
    brandHint: baseProduct.brand,
    categoryHint: baseProduct.category,
    sourceUrl,
    sourceWebsite: website.websiteLabel
  });

  const product = enrichProductIdentity({
    name: extracted.name || baseProduct.name,
    canonicalName: extracted.canonicalName || baseProduct.canonicalName || extracted.name || baseProduct.name,
    brand: extracted.brand || baseProduct.brand,
    category: extracted.category || baseProduct.category,
    sku: extracted.sku || baseProduct.sku || "",
    image: extracted.image || "",
    description: extracted.description || "",
    sourceDomain: website.hostname
  });

  return {
    product,
    retailerIngredients: extracted.ingredients || "",
    retailerCandidates: (extracted.ingredientCandidates || []).map((candidate) => ({
      ...candidate,
      sourceUrl: sourceUrl || inputUrl,
      sourceWebsite: website.websiteLabel,
      product
    }))
  };
}

export async function resolveProductMetadata(inputUrl, context = {}) {
  let website;
  try {
    website = detectSourceWebsite(inputUrl);
  } catch (_error) {
    const error = new Error("Please paste a valid product URL.");
    error.statusCode = 400;
    error.processingTrace = [createStep("Detecting website", "failed", "The pasted text is not a valid URL.")];
    throw error;
  }

  if (isSearchEngineUrl(website.parsedUrl)) {
    const error = new Error("Please paste the actual product page URL, not a Google or search-results link.");
    error.statusCode = 400;
    error.processingTrace = [createStep("Detecting website", "failed", "Search-result pages are not product pages.")];
    throw error;
  }

  const metadataCache = await getCachedProductMetadata(inputUrl);
  const fallbackName = slugToTitle(website.parsedUrl.pathname.split("/").filter(Boolean).pop() || "");

  if (canReextractFromCachedHtml(metadataCache)) {
    const resolved = await extractResolvedProductData({
      html: metadataCache.fetched.html,
      fallbackName,
      inputUrl,
      sourceUrl: metadataCache.fetched.finalUrl || inputUrl,
      website,
      baseProduct: metadataCache.product || buildBaseProduct(website, fallbackName)
    });

    return {
      ...metadataCache,
      product: resolved.product,
      retailerIngredients: resolved.retailerIngredients,
      retailerCandidates: resolved.retailerCandidates,
      website,
      processingTrace: [
        createStep("Detecting website", "completed", `Detected ${website.websiteLabel} (${website.hostname}).`),
        createStep("Parsing retailer page", "completed", `Loaded cached page HTML and re-extracted product metadata. ${formatProductSummary(resolved.product)}`)
      ],
      traceId: context.traceId,
      cacheHit: true
    };
  }

  if (hasIngredientUsefulMetadataCache(metadataCache)) {
    return {
      ...metadataCache,
      website,
      processingTrace: [
        createStep("Detecting website", "completed", `Detected ${website.websiteLabel} (${website.hostname}).`),
        createStep("Parsing retailer page", "completed", `Loaded cached product metadata. ${formatProductSummary(metadataCache.product)}`)
      ],
      traceId: context.traceId,
      cacheHit: true
    };
  }

  const processingTrace = [
    createStep("Detecting website", "completed", `Detected ${website.websiteLabel} (${website.hostname}).`),
    createStep("Parsing retailer page", "in_progress", "Fetching the retailer page and extracting product metadata.")
  ];
  let fetched = await fetchPageWithStrategies(inputUrl, {
    staticTimeoutMs: 5000,
    dynamicTimeoutMs: 8000,
    retries: 1
  });
  let product = metadataCache?.product || buildBaseProduct(website, fallbackName);
  let retailerIngredients = "";
  let retailerCandidates = [];

  if (fetched.ok) {
    let resolved = await extractResolvedProductData({
      html: fetched.html,
      fallbackName,
      inputUrl,
      sourceUrl: fetched.finalUrl || inputUrl,
      website,
      baseProduct: product
    });

    product = resolved.product;
    retailerIngredients = resolved.retailerIngredients;
    retailerCandidates = resolved.retailerCandidates;

    if (shouldRetryWithDynamicFetch({ fetched, retailerCandidates, retailerIngredients })) {
      const dynamicFetched = await fetchDynamicHtml(inputUrl, { timeoutMs: 8000 });
      if (dynamicFetched.ok) {
        const dynamicResolved = await extractResolvedProductData({
          html: dynamicFetched.html,
          fallbackName,
          inputUrl,
          sourceUrl: dynamicFetched.finalUrl || inputUrl,
          website,
          baseProduct: product
        });

        if (dynamicResolved.retailerCandidates.length > 0 || (dynamicResolved.retailerIngredients || "").trim()) {
          fetched = {
            ...dynamicFetched,
            extractionMethod: "playwright",
            attempts: [
              ...(fetched.attempts || []),
              {
                method: dynamicFetched.method,
                mode: dynamicFetched.mode,
                ok: dynamicFetched.ok,
                status: dynamicFetched.status,
                statusCode: dynamicFetched.statusCode,
                responseTime: dynamicFetched.responseTime,
                finalUrl: dynamicFetched.finalUrl,
                errorMessage: dynamicFetched.errorMessage || null
              }
            ]
          };
          product = dynamicResolved.product;
          retailerIngredients = dynamicResolved.retailerIngredients;
          retailerCandidates = dynamicResolved.retailerCandidates;
          processingTrace.push(
            createStep(
              "Dynamic ingredient retry",
              "completed",
              `Static HTML had no ingredient candidates, so DermIntel retried with a rendered page and found ${retailerCandidates.length} candidate block${retailerCandidates.length === 1 ? "" : "s"}.`
            )
          );
        } else {
          processingTrace.push(
            createStep(
              "Dynamic ingredient retry",
              "failed",
              "Static HTML had no ingredient candidates, and the rendered page still did not expose a usable ingredient block."
            )
          );
        }
      } else {
        processingTrace.push(
          createStep(
            "Dynamic ingredient retry",
            "failed",
            dynamicFetched.errorMessage || "Rendered retry could not fetch the page."
          )
        );
      }
    }

    processingTrace[processingTrace.length - (processingTrace.at(-1)?.label === "Dynamic ingredient retry" ? 2 : 1)] = createStep(
      "Parsing retailer page",
      "completed",
      `Product page parsed. ${formatProductSummary(product)}`
    );
  } else {
    processingTrace[processingTrace.length - 1] = createStep(
      "Parsing retailer page",
      "failed",
      fetched.errorMessage || "Unable to fetch the retailer page."
    );
  }

  const result = {
    website,
    fetched,
    product,
    retailerIngredients,
    retailerCandidates,
    processingTrace,
    traceId: context.traceId
  };

  await setCachedProductMetadata(inputUrl, {
    fetched: fetched.ok
      ? {
          ok: true,
          html: fetched.html,
          finalUrl: fetched.finalUrl,
          extractionMethod: fetched.extractionMethod,
          status: fetched.status,
          statusCode: fetched.statusCode,
          attempts: fetched.attempts || []
        }
      : null,
    product,
    retailerIngredients,
    retailerCandidates
  });

  logUrlAnalysis("product-resolver-finished", {
    traceId: context.traceId,
    inputUrl,
    website: website.websiteLabel,
    productName: product.name,
    candidateCount: retailerCandidates.length
  });

  return result;
}
