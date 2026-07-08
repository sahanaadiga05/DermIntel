import { createBaseScraper } from "./base-scraper.js";

export const amazonScraper = createBaseScraper({
  platform: "Amazon",
  hostPatterns: ["amazon."]
});

