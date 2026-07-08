import { createBaseScraper } from "./base-scraper.js";

export const brandWebsiteScraper = createBaseScraper({
  platform: "Brand Website",
  hostPatterns: ["cetaphil.", "cerave.", "beminimalist.", "theordinary.", "plumgoodness.", "dotandkey."]
});

