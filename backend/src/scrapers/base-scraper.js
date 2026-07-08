import { extractProductInfo } from "../lib/ingredient-extractor.js";

export function createBaseScraper({ platform, hostPatterns = [] }) {
  return {
    platform,
    hostPatterns,
    canHandle(hostname) {
      return hostPatterns.some((pattern) => hostname.includes(pattern));
    },
    scrape({ html, fallbackName }) {
      return extractProductInfo(html, fallbackName, {});
    }
  };
}

