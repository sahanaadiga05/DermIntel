import test from "node:test";
import assert from "node:assert/strict";
import { searchOfficialWebsiteForIngredients } from "../src/lib/url-analysis/official-source-search.js";
import { resolveOfficialBrand, __testables } from "../src/services/official-brand-resolver.js";

test("Official discovery validates a brand-owned domain from search results", async () => {
  const result = await resolveOfficialBrand(
    {
      brand: "Example Botanics",
      name: "Barrier Gel Cleanser",
      canonicalName: "Barrier Gel Cleanser"
    },
    {
      searchFn: async () => [
        {
          url: "https://examplebotanics.com/products/barrier-gel-cleanser"
        }
      ],
      fetchFn: async () => ({
        ok: true,
        finalUrl: "https://examplebotanics.com/products/barrier-gel-cleanser",
        html: "<html><title>Example Botanics Barrier Gel Cleanser</title><body>Example Botanics official skincare.</body></html>"
      })
    }
  );

  assert.equal(result.officialDomain, "examplebotanics.com");
  assert.equal(result.resolutionMethod, "search-validation");
  assert.ok(result.confidence > 0.65);
});

test("Official discovery rejects unverified domains instead of guessing", async () => {
  const result = await resolveOfficialBrand(
    {
      brand: "Unknown Fancy Brand",
      name: "Glow Cleanser"
    },
    {
      searchFn: async () => [],
      fetchFn: async () => {
        throw new Error("fetch should not be called when search returns no candidates");
      }
    }
  );

  assert.equal(result.officialDomain, null);
  assert.notEqual(result.officialDomain, "unknownfancybrand.com");
  assert.equal(result.resolutionMethod, "not-found");
});

test("Official search skips safely when brand metadata is missing", async () => {
  const result = await searchOfficialWebsiteForIngredients({
    name: "Glow Cleanser",
    variant: "Hydrating"
  });

  assert.deepEqual(result.candidates, []);
  assert.match(result.report.lastReason, /Official website discovery/i);
});

test("Official discovery scores host and text similarity generically", () => {
  assert.ok(__testables.hostnameBrandScore("examplebotanics.com", "Example Botanics") > 0.8);
  assert.equal(__testables.brandMentioned("Welcome to Example Botanics skincare", "Example Botanics"), true);
  assert.equal(__testables.brandMentioned("Independent marketplace listing", "Example Botanics"), false);
});