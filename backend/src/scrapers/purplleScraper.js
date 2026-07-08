import { createBaseScraper } from "./base-scraper.js";

export const purplleScraper = createBaseScraper({
  platform: "Purplle",
  hostPatterns: ["purplle."]
});

