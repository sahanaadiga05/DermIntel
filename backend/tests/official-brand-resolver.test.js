import test from "node:test";
import assert from "node:assert/strict";
import { searchOfficialWebsiteForIngredients } from "../src/lib/url-analysis/official-source-search.js";
import { lookupBrandRegistry } from "../src/lib/url-analysis/brand-registry.js";
import { resolveOfficialBrand } from "../src/services/official-brand-resolver.js";

test("Brand registry resolves known official domains without guessing", async () => {
  const chemistAtPlay = await resolveOfficialBrand({ brand: "Chemist At Play" });
  const minimalist = await resolveOfficialBrand({ brand: "Minimalist" });
  const cetaphil = await resolveOfficialBrand({ brand: "Cetaphil" });
  const cerave = await resolveOfficialBrand({ brand: "CeraVe" });
  const ordinary = await resolveOfficialBrand({ brand: "The Ordinary" });

  assert.equal(chemistAtPlay.officialDomain, "innovist.com");
  assert.equal(minimalist.officialDomain, "beminimalist.co");
  assert.equal(cetaphil.officialDomain, "cetaphil.com");
  assert.equal(cerave.officialDomain, "cerave.com");
  assert.equal(ordinary.officialDomain, "theordinary.com");
});

test("Unknown brand does not generate a fake concatenated domain", async () => {
  const result = await resolveOfficialBrand({
    brand: "Unknown Fancy Brand",
    name: "Glow Cleanser"
  }, {
    searchFn: async () => []
  });

  assert.equal(result.officialDomain, null);
  assert.notEqual(result.officialDomain, "unknownfancybrand.com");
  assert.equal(result.resolutionMethod, "not-found");
});

test("Official search skips safely when no verified official domain exists", async () => {
  const result = await searchOfficialWebsiteForIngredients({
    brand: "Unknown Fancy Brand",
    name: "Glow Cleanser",
    variant: "Hydrating"
  });

  assert.deepEqual(result.candidates, []);
  assert.match(result.report.lastReason, /Skipping official website search/i);
});

test("Brand registry lookup is extendable and normalized", () => {
  assert.equal(lookupBrandRegistry("Chemist At Play").officialDomain, "innovist.com");
  assert.equal(lookupBrandRegistry("Dot & Key").officialDomain, "dotandkey.com");
});
