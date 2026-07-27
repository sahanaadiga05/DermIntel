import { buildSourceScopedQueries, inspectCandidatePages, searchDomainResults } from "./search-utils.js";

const TRUSTED_DATABASES = [
  { label: "INCI Decoder", domain: "incidecoder.com" },
  { label: "CosDNA", domain: "cosdna.com" },
  { label: "SkinSort", domain: "skinsort.com" },
  { label: "Beautypedia", domain: "beautypedia.com" },
  { label: "EWG", domain: "ewg.org" }
];

export async function searchTrustedDatabasesForIngredients(productInfo, options = {}) {
  const candidates = [];
  const attempts = [];
  const report = {
    inspectedPages: 0,
    matchedPages: 0,
    ingredientHits: 0,
    verifiedCandidates: 0,
    lastReason: "No trusted database result matched yet."
  };

  const searchHits = await Promise.allSettled(
    TRUSTED_DATABASES.map(async (source) => ({
      source,
      urls: await searchDomainResults(buildSourceScopedQueries(productInfo, {
        sourceLabel: source.label
      }), [source.domain], {
        limitPerDomain: 2,
        signal: options.signal,
        timeoutMs: options.searchTimeoutMs || 5000,
        queryLimit: 1
      })
    }))
  );

  const inspectionJobs = [];
  for (const hit of searchHits) {
    if (hit.status !== "fulfilled") {
      continue;
    }

    for (const result of hit.value.urls) {
      inspectionJobs.push({ source: hit.value.source, url: result.url });
    }
  }

  const inspections = await inspectCandidatePages(
    inspectionJobs.slice(0, 3).map(({ source, url }) => ({
      url,
      productInfo,
      sourceWebsite: source.label,
      extractionMethod: `trusted-database:${source.label}`,
      ingredientSource: source.label,
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

    if (candidateReport.parsedProduct) {
      report.matchedPages += 1;
    }

    if (candidateReport.foundIngredients) {
      report.ingredientHits += 1;
    }

    if (inspected.candidate) {
      candidates.push(inspected.candidate);
      report.verifiedCandidates += 1;
      report.lastReason = `Found verified ingredients on ${inspected.candidate.sourceWebsite}.`;
    } else if (candidateReport.reason) {
      report.lastReason = candidateReport.reason;
    }
  }

  return { candidates, attempts, report };
}
