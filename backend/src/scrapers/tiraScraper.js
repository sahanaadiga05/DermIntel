import { createBaseScraper } from "./base-scraper.js";

export const tiraScraper = createBaseScraper({
  platform: "Tira Beauty",
  hostPatterns: ["tirabeauty.", "tira."]
});

