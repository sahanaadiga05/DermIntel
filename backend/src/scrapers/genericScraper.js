import { createBaseScraper } from "./base-scraper.js";

export const genericScraper = createBaseScraper({
  platform: "Generic Website",
  hostPatterns: []
});

