import { brandWebsiteScraper } from "../../scrapers/brandWebsiteScraper.js";
import { genericScraper } from "../../scrapers/genericScraper.js";
import { lookupBrandRegistry, normalizeBrandRegistryKey } from "./brand-registry.js";

const SEARCH_ENGINE_HOSTS = ["google.", "bing.", "search.yahoo.", "duckduckgo.", "yandex."];

function normalizeHost(hostname = "") {
  return hostname.toLowerCase();
}

export function isSearchEngineUrl(parsedUrl) {
  const host = normalizeHost(parsedUrl.hostname);
  const path = parsedUrl.pathname.toLowerCase();

  if (!SEARCH_ENGINE_HOSTS.some((pattern) => host.includes(pattern))) {
    return false;
  }

  return path.startsWith("/search") || path === "/" || parsedUrl.searchParams.has("q");
}

export function detectSourceWebsite(inputUrl) {
  const parsedUrl = new URL(inputUrl);
  const hostname = normalizeHost(parsedUrl.hostname);
  const scraper = brandWebsiteScraper.canHandle(hostname) ? brandWebsiteScraper : genericScraper;

  let websiteType = "ecommerce";
  if (scraper === brandWebsiteScraper) {
    websiteType = "official-brand-website";
  } else if (scraper === genericScraper) {
    websiteType = "generic-website";
  }

  return {
    hostname,
    websiteKey: hostname.replace(/^www\./, ""),
    websiteLabel: scraper.platform,
    websiteType,
    scraper,
    parsedUrl
  };
}

export function getBrandDomains(brand = "") {
  const resolved = lookupBrandRegistry(brand);
  return resolved?.officialDomain ? [resolved.officialDomain] : [];
}

export function getBrandRegistryKey(brand = "") {
  return normalizeBrandRegistryKey(brand);
}
