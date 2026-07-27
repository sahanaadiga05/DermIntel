import { getCachedBrandResolution, setCachedBrandResolution } from "../lib/cache-manager.js";
import { fetchStaticHtml } from "../lib/url-analysis/page-fetcher.js";
import { lookupBrandRegistry, normalizeBrandRegistryKey } from "../lib/url-analysis/brand-registry.js";
import { logUrlAnalysis } from "../lib/url-analysis/logger.js";
import { searchGeneralResults } from "../lib/url-analysis/search-utils.js";

const BLOCKED_HOST_KEYWORDS = [
  "amazon.",
  "flipkart.",
  "nykaa.",
  "myntra.",
  "purplle.",
  "tira.",
  "apollopharmacy",
  "netmeds",
  "1mg.",
  "pharmeasy",
  "incidecoder",
  "cosdna",
  "skinsort",
  "beautypedia",
  "ewg.",
  "reddit.",
  "youtube.",
  "instagram.",
  "facebook.",
  "blog",
  "wordpress"
];

function buildSearchQueries(productInfo = {}) {
  const brand = productInfo.brand || "";
  const productName = productInfo.name || "";
  const variant = productInfo.variant || "";

  return [
    `${brand} official website`.trim(),
    `${brand} ${productName}`.trim(),
    `${brand} ${productName} ingredients`.trim(),
    `${brand} ${productName} ${variant}`.trim()
  ].filter(Boolean);
}

function isAllowedOfficialDomain(hostname = "") {
  const host = hostname.toLowerCase();
  return host && !BLOCKED_HOST_KEYWORDS.some((keyword) => host.includes(keyword));
}

function brandMentioned(text = "", brand = "") {
  const normalizedText = text.toLowerCase();
  const normalizedBrand = normalizeBrandRegistryKey(brand).replace(/\s+/g, " ");
  return normalizedBrand && normalizedText.includes(normalizedBrand);
}

async function validateOfficialDomain(candidateUrl, productInfo, fetchFn = fetchStaticHtml) {
  try {
    const response = await fetchFn(candidateUrl, { timeoutMs: 12000, retries: 1 });
    if (!response.ok) {
      return null;
    }

    const hostname = new URL(response.finalUrl || candidateUrl).hostname.replace(/^www\./, "").toLowerCase();
    if (!isAllowedOfficialDomain(hostname)) {
      return null;
    }

    const html = response.html || "";
    const documentText = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    if (!brandMentioned(documentText, productInfo.brand)) {
      return null;
    }

    return {
      officialDomain: hostname,
      confidence: 0.72,
      resolutionMethod: "search-validation"
    };
  } catch (_error) {
    return null;
  }
}

export async function resolveOfficialBrand(productInfo = {}, options = {}) {
  const normalizedBrand = normalizeBrandRegistryKey(productInfo.brand || "");
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

  const registryMatch = lookupBrandRegistry(productInfo.brand || "");
  if (registryMatch) {
    await setCachedBrandResolution(normalizedBrand, registryMatch);
    logUrlAnalysis("official-brand-registry-hit", {
      traceId,
      brand: productInfo.brand,
      officialDomain: registryMatch.officialDomain
    });
    return registryMatch;
  }

  const searchQueries = buildSearchQueries(productInfo);
  const searchResults = await searchFn(searchQueries, {
    limit: 6,
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
    const validated = await validateOfficialDomain(result.url, productInfo, fetchFn);
    if (validated?.officialDomain) {
      await setCachedBrandResolution(normalizedBrand, validated);
      logUrlAnalysis("official-brand-search-hit", {
        traceId,
        brand: productInfo.brand,
        officialDomain: validated.officialDomain,
        searchUrl: result.url
      });
      return validated;
    }
  }

  logUrlAnalysis("official-brand-search-miss", {
    traceId,
    brand: productInfo.brand
  });

  return {
    officialDomain: null,
    confidence: 0,
    resolutionMethod: searchResults.length ? "search-unverified" : "not-found"
  };
}
