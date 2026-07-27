import { extractProductInfo } from "../ingredient-extractor.js";
import { createCleanPageText } from "../pipeline/page-text.js";
import { extractIngredientsWithAi } from "../pipeline/ai-ingredient-extractor.js";
import { compareIngredientLists, verifyIngredientCandidate } from "./ingredient-verifier.js";
import { extractCoreProductName, extractProductSize, extractProductSku, extractProductVariant, normalizeProductName, tokenizeProductName } from "../product-normalizer.js";
import { fetchPageWithStrategies, fetchStaticHtml } from "./page-fetcher.js";
import { matchProducts } from "./product-matcher.js";

function decodeDuckDuckGoUrl(href = "") {
  const match = href.match(/uddg=([^&]+)/i);
  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }

  return href.startsWith("http") ? href : "";
}

function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === "ERR_CANCELED";
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    const error = signal.reason instanceof Error ? signal.reason : new Error("Request cancelled");
    error.name = "AbortError";
    throw error;
  }
}

function isLikelyListingPage(url = "", parsedProduct = {}) {
  const normalizedUrl = String(url).toLowerCase();
  const title = String(parsedProduct?.name || "").toLowerCase();
  const description = String(parsedProduct?.description || "").toLowerCase();
  const combined = title + " " + description;

  if (
    normalizedUrl.includes("/search") ||
    normalizedUrl.includes("?q=") ||
    normalizedUrl.includes("&q=") ||
    normalizedUrl.includes("search=") ||
    normalizedUrl.includes("/collections") ||
    normalizedUrl.includes("/collection") ||
    normalizedUrl.includes("/catalog")
  ) {
    return true;
  }

  return ["search results", "results found", "all products", "shop all", "collection"]
    .some((token) => combined.includes(token));
}

export function extractSearchResultUrls(html = "") {
  const urls = [];
  const matches = html.match(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi) || [];

  for (const match of matches) {
    const hrefMatch = match.match(/href=["']([^"']+)["']/i);
    const decoded = decodeDuckDuckGoUrl(hrefMatch?.[1] || "");
    if (decoded && !urls.includes(decoded)) {
      urls.push(decoded);
    }
  }

  return urls.filter((url) => /^https?:\/\//i.test(url));
}

export function hasStrongNameOverlap(left = "", right = "") {
  const leftTokens = tokenizeProductName(left);
  const rightTokens = tokenizeProductName(right);

  if (!leftTokens.length || !rightTokens.length) {
    return false;
  }

  const overlap = leftTokens.filter((token) => rightTokens.includes(token));
  return overlap.length >= Math.min(2, leftTokens.length, rightTokens.length);
}

export function enrichProductIdentity(product = {}) {
  const brand = product.brand || "";
  const category = product.category || "Product";
  const title = normalizeProductName(product.name || "");
  const description = product.description || "";
  const variant = product.variant || extractProductVariant(`${title} ${description}`, { brand, category });
  const size = product.size || extractProductSize(`${title} ${description}`);
  const canonicalName = normalizeProductName(product.canonicalName || extractCoreProductName(title, { brand, category }));
  const name = canonicalName || title;
  const sku = product.sku || extractProductSku(product.sku, description, title);

  return {
    ...product,
    name,
    canonicalName,
    variant,
    size,
    sku
  };
}

function buildIdentityQueryVariants(productInfo = {}) {
  const canonicalName = normalizeProductName(productInfo.canonicalName || productInfo.name || "");
  const name = normalizeProductName(productInfo.name || canonicalName);
  const brand = normalizeProductName(productInfo.brand || "");
  const variant = normalizeProductName(productInfo.variant || "");
  const size = normalizeProductName(productInfo.size || "");
  const category = normalizeProductName(productInfo.category || "");
  const sku = normalizeProductName(productInfo.sku || "");

  return [
    [brand, canonicalName].filter(Boolean).join(" ").trim(),
    [brand, name].filter(Boolean).join(" ").trim(),
    [brand, canonicalName, variant].filter(Boolean).join(" ").trim(),
    [brand, name, variant].filter(Boolean).join(" ").trim(),
    [brand, canonicalName, size].filter(Boolean).join(" ").trim(),
    [brand, variant, category].filter(Boolean).join(" ").trim(),
    [brand, canonicalName, category].filter(Boolean).join(" ").trim(),
    [brand, sku].filter(Boolean).join(" ").trim()
  ].filter(Boolean);
}

export function buildProductSearchPhrases(productInfo = {}) {
  const suffixes = [
    "ingredients",
    "INCI",
    "composition",
    "full ingredients",
    "product details"
  ];

  return [...new Set(buildIdentityQueryVariants(productInfo).flatMap((core) => suffixes.map((suffix) => `${core} ${suffix}`.trim())))].slice(0, 18);
}

export function buildSourceScopedQueries(productInfo = {}, { siteDomain = "", sourceLabel = "" } = {}) {
  const baseQueries = buildProductSearchPhrases(productInfo);
  const identityVariants = buildIdentityQueryVariants(productInfo);
  const scopedQueries = [];

  if (siteDomain) {
    for (const core of identityVariants) {
      scopedQueries.push(`site:${siteDomain} ${core} ingredients`.trim());
      scopedQueries.push(`site:${siteDomain} ${core} INCI`.trim());
    }
  }

  if (sourceLabel) {
    for (const core of identityVariants) {
      scopedQueries.push(`${sourceLabel} ${core}`.trim());
    }
  }

  return [...new Set([...baseQueries, ...scopedQueries])].slice(0, 24);
}

function limitQueries(queries = [], queryLimit = 6) {
  return [...new Set(queries.filter(Boolean))].slice(0, Math.max(1, queryLimit));
}

export async function searchDomainResults(queries = [], domains = [], { limitPerDomain = 4, signal, timeoutMs = 5000, queryLimit = 6 } = {}) {
  const trimmedQueries = limitQueries(queries, queryLimit);
  const settled = await Promise.allSettled(
    domains.flatMap((domain) =>
      trimmedQueries.map(async (query) => {
        throwIfAborted(signal);
        const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(`site:${domain} ${query}`)}`;
        const response = await fetchStaticHtml(searchUrl, { timeoutMs, retries: 1, signal });
        if (!response.ok) {
          return [];
        }

        return extractSearchResultUrls(response.html).map((url) => ({ domain, query, url }));
      })
    )
  );

  const results = [];
  const perDomainSeen = new Map();

  for (const entry of settled) {
    if (entry.status !== "fulfilled") {
      if (isAbortError(entry.reason)) {
        break;
      }
      continue;
    }

    for (const hit of entry.value) {
      if (!hit.url.includes(hit.domain)) {
        continue;
      }

      const seen = perDomainSeen.get(hit.domain) || new Set();
      if (seen.has(hit.url) || seen.size >= limitPerDomain) {
        continue;
      }

      seen.add(hit.url);
      perDomainSeen.set(hit.domain, seen);
      results.push(hit);
    }
  }

  return results;
}

export async function searchGeneralResults(queries = [], { limit = 8, allowUrl, signal, timeoutMs = 5000, queryLimit = 5 } = {}) {
  const trimmedQueries = limitQueries(queries, queryLimit);
  const settled = await Promise.allSettled(
    trimmedQueries.map(async (query) => {
      throwIfAborted(signal);
      const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await fetchStaticHtml(searchUrl, { timeoutMs, retries: 1, signal });
      if (!response.ok) {
        return [];
      }

      return extractSearchResultUrls(response.html).map((url) => ({ query, url }));
    })
  );

  const results = [];
  const seenUrls = new Set();

  for (const entry of settled) {
    if (entry.status !== "fulfilled") {
      if (isAbortError(entry.reason)) {
        break;
      }
      continue;
    }

    for (const hit of entry.value) {
      if (seenUrls.has(hit.url)) {
        continue;
      }

      if (allowUrl && !allowUrl(hit.url)) {
        continue;
      }

      seenUrls.add(hit.url);
      results.push(hit);
      if (results.length >= limit) {
        return results;
      }
    }
  }

  return results;
}

export async function inspectCandidatePages(jobs = [], {
  concurrency = 3,
  stopOnVerified = false,
  signal
} = {}) {
  const results = new Array(jobs.length);
  const workerCount = Math.max(1, Math.min(concurrency, jobs.length));
  let cursor = 0;
  let foundVerified = false;

  async function worker() {
    while (cursor < jobs.length && !(stopOnVerified && foundVerified)) {
      const jobIndex = cursor;
      cursor += 1;
      const job = jobs[jobIndex];

      try {
        throwIfAborted(signal);
        const inspected = await inspectCandidatePage({
          ...job,
          signal: job.signal || signal
        });
        results[jobIndex] = {
          status: "fulfilled",
          value: inspected
        };

        if (stopOnVerified && inspected?.candidate) {
          foundVerified = true;
        }
      } catch (error) {
        results[jobIndex] = {
          status: "rejected",
          reason: error
        };

        if (isAbortError(error)) {
          break;
        }
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results.filter(Boolean);
}

async function verifyCandidates(candidatePool = [], context = {}) {
  const attempts = [];
  const verified = [];

  for (const candidate of candidatePool) {
    const checked = await verifyIngredientCandidate(candidate, context);
    attempts.push(checked);
    if (checked.verified) {
      verified.push(checked);
    }
  }

  return { attempts, verified };
}

export async function inspectCandidatePage({
  url,
  productInfo,
  sourceWebsite,
  extractionMethod,
  ingredientSource,
  minIngredientCount = 8,
  signal,
  staticTimeoutMs = 5000,
  dynamicTimeoutMs = 8000
}) {
  throwIfAborted(signal);
  const fetched = await fetchPageWithStrategies(url, {
    signal,
    staticTimeoutMs,
    dynamicTimeoutMs,
    retries: 1
  });

  if (!fetched.ok) {
    return {
      candidate: null,
      attempts: [],
      report: {
        url,
        ok: false,
        reason: fetched.errorMessage || "Unable to fetch the page.",
        fetched,
        attempts: []
      }
    };
  }

  throwIfAborted(signal);
  const extracted = await extractProductInfo(fetched.html, productInfo.name, {
    brandHint: productInfo.brand,
    categoryHint: productInfo.category,
    sourceUrl: fetched.finalUrl || url,
    sourceWebsite
  });
  const parsedProduct = enrichProductIdentity({
    name: extracted.name || productInfo.name,
    brand: extracted.brand || productInfo.brand,
    category: extracted.category || productInfo.category,
    description: extracted.description || productInfo.description || "",
    image: extracted.image || productInfo.image || ""
  });
  const productMatch = matchProducts(
    {
      ...productInfo,
      url,
      description: productInfo.description || ""
    },
    {
      ...parsedProduct,
      url: fetched.finalUrl || url,
      description: parsedProduct.description || extracted.description || ""
    }
  );

  const deterministicCandidates = (extracted.ingredientCandidates || []).map((candidate) => ({
    ...candidate,
    extractionMethod: candidate.extractionMethod === "regex-fallback" ? `${extractionMethod}:regex-fallback` : candidate.extractionMethod,
    sourceWebsite,
    sourceUrl: fetched.finalUrl || url,
    ingredientSource: candidate.ingredientSource || ingredientSource,
    product: parsedProduct
  }));

  const verifiedContext = {
    productName: parsedProduct.name || productInfo.name,
    brand: parsedProduct.brand || productInfo.brand,
    minIngredientCount
  };

  const mismatchReason = productMatch.shouldContinue
    ? `Product matching review window. ${productMatch.summary}. Continuing search because the page scored below the ${productMatch.thresholds.acceptance}% acceptance threshold.`
    : `Product matching failed. ${productMatch.summary}.`;

  if (isLikelyListingPage(fetched.finalUrl || url, parsedProduct)) {
    return {
      candidate: null,
      attempts: [],
      report: {
        url: fetched.finalUrl || url,
        ok: false,
        reason: "Listing/search page detected instead of a canonical product page.",
        fetched,
        parsedProduct,
        productMatch,
        foundIngredients: false,
        attempts: []
      }
    };
  }

  const { attempts, verified } = productMatch.accepted
    ? await verifyCandidates(deterministicCandidates, verifiedContext)
    : {
        attempts: deterministicCandidates.map((candidate) => ({
          ...candidate,
          verified: false,
          rejectionReason: mismatchReason
        })),
        verified: []
      };

  if (productMatch.accepted && !verified.length && !signal?.aborted) {
    const aiCandidate = await extractIngredientsWithAi({
      pageText: createCleanPageText(fetched.html),
      sourceUrl: fetched.finalUrl || url,
      sourceWebsite,
      product: parsedProduct
    });

    if (aiCandidate) {
      const aiAttempt = await verifyIngredientCandidate(aiCandidate, verifiedContext);
      attempts.push(aiAttempt);
      if (aiAttempt.verified) {
        verified.push(aiAttempt);
      }
    }
  }

  if (!productMatch.accepted) {
    return {
      candidate: null,
      attempts,
      report: {
        url: fetched.finalUrl || url,
        ok: false,
        reason: mismatchReason,
        fetched,
        parsedProduct,
        productMatch,
        foundIngredients: attempts.length > 0,
        attempts
      }
    };
  }

  const chosen = compareIngredientLists(verified);
  if (!chosen) {
    return {
      candidate: null,
      attempts,
      report: {
        url: fetched.finalUrl || url,
        ok: false,
        reason: attempts.at(-1)?.rejectionReason || "No verified ingredient candidate passed validation.",
        fetched,
        parsedProduct,
        productMatch,
        foundIngredients: attempts.length > 0,
        attempts
      }
    };
  }

  return {
    candidate: chosen,
    attempts,
    report: {
      url: fetched.finalUrl || url,
      ok: true,
      fetched,
      parsedProduct,
      productMatch,
      verification: chosen.verification,
      attempts
    }
  };
}


