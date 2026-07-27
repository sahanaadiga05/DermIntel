import { buildSourceScopedQueries, inspectCandidatePages, searchGeneralResults } from "./search-utils.js";

const BLOCKED_HOST_KEYWORDS = [
  "blog",
  "wordpress",
  "medium.com",
  "reddit.com",
  "youtube.com",
  "instagram.com",
  "facebook.com"
];

function allowSearchResult(url) {
  return !BLOCKED_HOST_KEYWORDS.some((keyword) => url.includes(keyword));
}

export async function searchSearchEngineResultsForIngredients(productInfo, options = {}) {
  const queries = buildSourceScopedQueries(productInfo, {
    sourceLabel: "ingredients"
  });
  const candidates = [];
  const attempts = [];
  const report = {
    inspectedPages: 0,
    matchedPages: 0,
    ingredientHits: 0,
    verifiedCandidates: 0,
    lastReason: "No broader web result matched yet."
  };

  const urls = await searchGeneralResults(queries, {
    limit: 4,
    allowUrl: allowSearchResult,
    signal: options.signal,
    timeoutMs: options.searchTimeoutMs || 5000,
    queryLimit: 2
  });

  const inspections = await inspectCandidatePages(
    urls.map((result) => ({
      url: result.url,
      productInfo,
      sourceWebsite: new URL(result.url).hostname.replace(/^www\./, ""),
      extractionMethod: "search-engine-result",
      ingredientSource: new URL(result.url).hostname.replace(/^www\./, ""),
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
