import { genericScraper } from "../../scrapers/genericScraper.js";

const SEARCH_ENGINE_HOSTS = ["google.", "bing.", "search.yahoo.", "duckduckgo.", "yandex."];

function normalizeHost(hostname = "") {
  return hostname.toLowerCase();
}

function labelFromHostname(hostname = "") {
  return hostname.replace(/^www\./, "") || "Generic Website";
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

  return {
    hostname,
    websiteKey: hostname.replace(/^www\./, ""),
    websiteLabel: labelFromHostname(hostname),
    websiteType: "generic-website",
    scraper: genericScraper,
    parsedUrl
  };
}
