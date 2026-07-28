import { getCachedBrandResolution, setCachedBrandResolution } from "../lib/cache-manager.js";
import { fetchStaticHtml } from "../lib/url-analysis/page-fetcher.js";
import { logUrlAnalysis } from "../lib/url-analysis/logger.js";
import { searchGeneralResults } from "../lib/url-analysis/search-utils.js";

const NON_OFFICIAL_HOST_PATTERNS = [
  "google.",
  "bing.",
  "duckduckgo.",
  "yahoo.",
  "yandex.",
  "reddit.",
  "youtube.",
  "instagram.",
  "facebook.",
  "pinterest.",
  "tiktok.",
  "linkedin.",
  "medium.",
  "wordpress.",
  "blogspot."
];

function normalizeBrandKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compact(value = "") {
  return normalizeBrandKey(value).replace(/\s+/g, "");
}

function buildSearchQueries(productInfo = {}) {
  const brand = productInfo.brand || "";
  const productName = productInfo.canonicalName || productInfo.name || "";
  const variant = productInfo.variant || "";

  return [
    `${brand} official website`.trim(),
    `${brand} ${productName} official`.trim(),
    `${brand} ${productName} ingredients`.trim(),
    `${brand} ${productName} ${variant}`.trim()
  ].filter(Boolean);
}

function isAllowedOfficialDomain(hostname = "") {
  const host = hostname.toLowerCase();
  return host && !NON_OFFICIAL_HOST_PATTERNS.some((pattern) => host.includes(pattern));
}

function hostnameBrandScore(hostname = "", brand = "") {
  const compactHost = compact(hostname.replace(/^www\./, "").split(".").slice(0, -1).join(" "));
  const compactBrand = compact(brand);
  if (!compactHost || !compactBrand) return 0;
  if (compactHost === compactBrand) return 1;
  if (compactHost.includes(compactBrand) || compactBrand.includes(compactHost)) return 0.82;

  const brandTokens = normalizeBrandKey(brand).split(" ").filter(Boolean);
  const matched = brandTokens.filter((token) => compactHost.includes(token)).length;
  return brandTokens.length ? matched / brandTokens.length : 0;
}

function brandMentioned(text = "", brand = "") {
  const normalizedText = normalizeBrandKey(text);
  const normalizedBrand = normalizeBrandKey(brand);
  if (!normalizedBrand) return false;

  if (normalizedText.includes(normalizedBrand)) return true;

  const tokens = normalizedBrand.split(" ").filter((token) => token.length > 2);
  return tokens.length > 0 && tokens.every((token) => normalizedText.includes(token));
}

function extractCanonicalHost(response, candidateUrl) {
  try {
    return new URL(response.finalUrl || candidateUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch (_error) {
    return "";
  }
}

async function validateOfficialDomain(candidateUrl, productInfo, fetchFn = fetchStaticHtml, options = {}) {
  try {
    const response = await fetchFn(candidateUrl, { timeoutMs: options.timeoutMs || 5000, retries: 1, signal: options.signal });
    if (!response.ok) {
      return null;
    }

    const hostname = extractCanonicalHost(response, candidateUrl);
    if (!isAllowedOfficialDomain(hostname)) {
      return null;
    }

    const html = response.html || "";
    const documentText = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const hostScore = hostnameBrandScore(hostname, productInfo.brand);
    const textMentionsBrand = brandMentioned(documentText, productInfo.brand);
    if (hostScore < 0.45 && !textMentionsBrand) {
      return null;
    }

    return {
      officialDomain: hostname,
      confidence: Math.max(0.68, Math.min(0.96, hostScore || (textMentionsBrand ? 0.72 : 0))),
      resolutionMethod: "search-validation"
    };
  } catch (_error) {
    return null;
  }
}

export async function resolveOfficialBrand(productInfo = {}, options = {}) {
  const normalizedBrand = normalizeBrandKey(productInfo.brand || "");
  const traceId = options.traceId;
  const searchFn = options.searchFn || searchGeneralResults;
  const fetchFn = options.fetchFn || fetchStaticHtml;

  if (!normalizedBrand) {
    return {
      officialDomain: null,
      confidence: 0,
      resolutionMethod: "brand-missing"
    };
  }

  const cached = await getCachedBrandResolution(normalizedBrand);
  if (cached?.officialDomain) {
    return cached;
  }

  const searchQueries = buildSearchQueries(productInfo);
  const searchResults = await searchFn(searchQueries, {
    limit: 8,
    signal: options.signal,
    timeoutMs: options.searchTimeoutMs || 5000,
    queryLimit: 4,
    allowUrl: (url) => {
      try {
        const hostname = new URL(url).hostname.replace(/^www\./, "");
        return isAllowedOfficialDomain(hostname);
      } catch (_error) {
        return false;
      }
    }
  });

  for (const result of searchResults) {
    const validated = await validateOfficialDomain(result.url, productInfo, fetchFn, {
      timeoutMs: options.fetchTimeoutMs || 5000,
      signal: options.signal
    });
    if (validated?.officialDomain) {
      await setCachedBrandResolution(normalizedBrand, validated);
      logUrlAnalysis("official-brand-search-hit", {
        traceId,
        brand: productInfo.brand,
        officialDomain: validated.officialDomain,
        searchUrl: result.url,
        confidence: validated.confidence
      });
      return validated;
    }
  }

  logUrlAnalysis("official-brand-search-miss", {
    traceId,
    brand: productInfo.brand,
    candidatesChecked: searchResults.length
  });

  return {
    officialDomain: null,
    confidence: 0,
    resolutionMethod: searchResults.length ? "search-unverified" : "not-found"
  };
}

export const __testables = {
  normalizeBrandKey,
  hostnameBrandScore,
  brandMentioned
};