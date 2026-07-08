import { createBaseScraper } from "./base-scraper.js";

export const myntraScraper = createBaseScraper({
  platform: "Myntra",
  hostPatterns: ["myntra."]
});

