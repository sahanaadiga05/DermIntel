import { createBaseScraper } from "./base-scraper.js";

export const flipkartScraper = createBaseScraper({
  platform: "Flipkart",
  hostPatterns: ["flipkart."]
});

