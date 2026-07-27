import { buildSourceScopedQueries, inspectCandidatePages, searchDomainResults } from "./search-utils.js";
import { resolveOfficialBrand } from "../../services/official-brand-resolver.js";

function slugify(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildSeedUrls(domain, productInfo) {
  const nameSlug = slugify([productInfo.name, productInfo.variant].filter(Boolean).join(" "));
  const baseSlug = slugify(productInfo.name || "");

  return [
    `https://${domain}/products/${nameSlug}`,
    `https://${domain}/products/${baseSlug}`
  ].filter(Boolean);
}

export async function searchOfficialWebsiteForIngredients(productInfo, options = {}) {
  const brandResolution = await resolveOfficialBrand(productInfo, {
    traceId: options.traceId
  });
  const domains = brandResolution.officialDomain ? [brandResolution.officialDomain] : [];
  const report = {
    domainsTried: domains,
    inspectedPages: 0,
    matchedPages: 0,
    ingredientHits: 0,
    verifiedCandidates: 0,
    foundProductPage: false,
    resolutionMethod: brandResolution.resolutionMethod,
    confidence: brandResolution.confidence,
    topProductMatches: [],
    lastReason: ""
  };

  if (!domains.length) {
    report.lastReason = brandResolution.resolutionMethod === "not-found"
      ? "Brand Registry: No entry. Official domain: Not found. Skipping official website search."
      : "Brand Registry: No entry. Official domain could not be verified. Skipping official website search.";
    return { candidates: [], attempts: [], report };
  }

  report.lastReason = `Official domain resolved: ${brandResolution.officialDomain}`;

  const queries = buildSourceScopedQueries(productInfo, {
    sourceLabel: "official"
  });
  const candidates = [];
  const attempts = [];
  const scoredPages = [];

  for (const domain of domains) {
    const searchSeedResults = await searchDomainResults(queries, [domain], {
      limitPerDomain: 3,
      signal: options.signal,
      timeoutMs: options.searchTimeoutMs || 5000,
        queryLimit: 2
    });
    const urls = [
      ...buildSeedUrls(domain, productInfo),
      ...searchSeedResults.map((entry) => entry.url)
    ];
    const uniqueUrls = [...new Set(urls)].slice(0, 4);
    const inspections = await inspectCandidatePages(
      uniqueUrls.map((url) => ({
        url,
        productInfo,
        sourceWebsite: domain,
        extractionMethod: "official-site-search",
        ingredientSource: domain,
        minIngredientCount: 8,
        staticTimeoutMs: options.fetchTimeoutMs || 5000,
        dynamicTimeoutMs: options.dynamicTimeoutMs || 8000
      })),
      {
        concurrency: 2,
        stopOnVerified: true,
        signal: options.signal
      }
    );

    for (const inspection of inspections) {
      if (inspection.status !== "fulfilled") {
        continue;
      }

      const inspected = inspection.value;
      report.inspectedPages += 1;
      attempts.push(...(inspected.attempts || []));
      const candidateReport = inspected.report;

      if (candidateReport.productMatch) {
        scoredPages.push({
          url: candidateReport.url,
          title: candidateReport.parsedProduct?.name || productInfo.name,
          score: candidateReport.productMatch.finalScore,
          accepted: candidateReport.productMatch.accepted,
          summary: candidateReport.productMatch.summary
        });
      }

      if (candidateReport.parsedProduct) {
        report.foundProductPage = true;
        report.matchedPages += 1;
      }

      if (candidateReport.foundIngredients) {
        report.ingredientHits += 1;
      }

      if (inspected.candidate) {
        candidates.push(inspected.candidate);
        report.verifiedCandidates += 1;
        report.lastReason = `Official domain resolved: ${domain}. ${candidateReport.productMatch?.summary || "Product page found. Verification passed."}`;
      } else if (candidateReport.reason) {
        report.lastReason = `Official domain resolved: ${domain}. ${candidateReport.reason}`;
      }
    }
  }

  report.topProductMatches = scoredPages
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);

  if (!candidates.length && report.topProductMatches.length) {
    const best = report.topProductMatches[0];
    report.lastReason = `Official domain resolved: ${brandResolution.officialDomain}. Best product match scored ${best.score}% for ${best.title}. ${best.summary}`;
  }

  return { candidates, attempts, report };
}
