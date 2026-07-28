import { buildSourceScopedQueries, inspectCandidatePages, searchDomainResults } from "./search-utils.js";

const DISTRIBUTOR_SOURCES = [
  { label: "Apollo Pharmacy", domain: "apollopharmacy.in" },
  { label: "Netmeds", domain: "netmeds.com" },
  { label: "Tata 1mg", domain: "1mg.com" },
  { label: "PharmEasy", domain: "pharmeasy.in" },
  { label: "Wellness Forever", domain: "wellnessforever.com" },
  { label: "Nykaa", domain: "nykaa.com" },
  { label: "Tira", domain: "tirabeauty.com" },
  { label: "Purplle", domain: "purplle.com" },
  { label: "Myntra", domain: "myntra.com" },
  { label: "Flipkart", domain: "flipkart.com" },
  { label: "Amazon India", domain: "amazon.in" },
  { label: "Health and Glow", domain: "healthandglow.com" },
  { label: "BigBasket", domain: "bigbasket.com" }
];

export async function searchDistributorPagesForIngredients(productInfo, options = {}) {
  const candidates = [];
  const attempts = [];
  const report = {
    inspectedPages: 0,
    matchedPages: 0,
    ingredientHits: 0,
    verifiedCandidates: 0,
    sourcesSearched: DISTRIBUTOR_SOURCES.map((source) => source.label),
    candidateUrls: [],
    lastReason: "No distributor page matched yet."
  };

  const searchHits = await Promise.allSettled(
    DISTRIBUTOR_SOURCES.map(async (source) => ({
      source,
      urls: await searchDomainResults(buildSourceScopedQueries(productInfo, {
        sourceLabel: source.label
      }), [source.domain], {
        limitPerDomain: 3,
        signal: options.signal,
        timeoutMs: options.searchTimeoutMs || 5000,
        queryLimit: 2
      })
    }))
  );

  const inspectionJobs = [];
  for (const hit of searchHits) {
    if (hit.status !== "fulfilled") {
      continue;
    }

    for (const result of hit.value.urls) {
      inspectionJobs.push({ source: hit.value.source, url: result.url, query: result.query });
    }
  }

  const uniqueJobs = [];
  const seenUrls = new Set();
  for (const job of inspectionJobs) {
    if (seenUrls.has(job.url)) continue;
    seenUrls.add(job.url);
    uniqueJobs.push(job);
  }

  report.candidateUrls = uniqueJobs.slice(0, 12).map((job) => ({
    source: job.source.label,
    url: job.url,
    query: job.query
  }));

  const inspections = await inspectCandidatePages(
    uniqueJobs.slice(0, 12).map(({ source, url }) => ({
      url,
      productInfo,
      sourceWebsite: source.label,
      extractionMethod: `distributor:${source.label}`,
      ingredientSource: source.label,
      minIngredientCount: 8,
      staticTimeoutMs: options.fetchTimeoutMs || 5000,
      dynamicTimeoutMs: options.dynamicTimeoutMs || 8000
    })),
    {
      concurrency: 3,
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

  if (!candidates.length && report.candidateUrls.length) {
    report.lastReason = `Checked ${report.inspectedPages} distributor/retailer candidate page${report.inspectedPages === 1 ? "" : "s"}; no verified ingredient list was found.`;
  }

  return { candidates, attempts, report };
}
