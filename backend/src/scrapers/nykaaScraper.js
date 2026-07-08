import { createBaseScraper } from "./base-scraper.js";

export const nykaaScraper = createBaseScraper({
  platform: "Nykaa",
  hostPatterns: ["nykaa."]
});

