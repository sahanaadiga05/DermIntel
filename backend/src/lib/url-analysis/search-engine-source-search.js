import { buildSourceScopedQueries, inspectCandidatePages, searchGeneralResults } from "./search-utils.js";
import { matchProducts } from "./product-matcher.js";
import { slugToTitle } from "../product-normalizer.js";

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

function getHostname(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch (_error) {
    return "Unknown Source";
  }
}

function urlToCandidateTitle(url = "") {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    return slugToTitle(segments.at(-1) || segments.at(-2) || parsed.hostname);
  } catch (_error) {
    return "Search Result";
  }
}

function rankSearchHits(productInfo = {}, hits = []) {
  return hits
    .map((hit) => {
      const hostname = getHostname(hit.url);
      const productMatch = matchProducts(productInfo, {
        name: urlToCandidateTitle(hit.url),
        brand: hostname.toLowerCase().includes(String(productInfo.brand || "").toLowerCase().replace(/\s+/g, "")) ? productInfo.brand : "",
        category: productInfo.category,
        description: `${hit.query || ""} ${hit.url}`,
        url: hit.url
      });
      let score = productMatch.finalScore;
      if (/ingredients|inci|composition/i.test(`${hit.query || ""} ${hit.url}`)) score += 12;
      if (/product|products|pdp|item/i.test(hit.url)) score += 8;
      if (/search|collection|collections|tagged|category|catalog/i.test(hit.url)) score -= 12;

      return {
        ...hit,
        hostname,
        productMatch,
        rankScore: Math.max(0, score)
      };
    })
    .sort((left, right) => right.rankScore - left.rankScore);
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
    candidateUrls: [],
    topProductMatches: [],
    lastReason: "No broader web result matched yet."
  };

  const urls = await searchGeneralResults(queries, {
    limit: 12,
    allowUrl: allowSearchResult,
    signal: options.signal,
    timeoutMs: options.searchTimeoutMs || 5000,
    queryLimit: 5
  });

  const rankedHits = rankSearchHits(productInfo, urls).slice(0, 10);
  report.candidateUrls = rankedHits.map((hit) => ({
    url: hit.url,
    query: hit.query,
    score: Math.round(hit.rankScore),
    host: hit.hostname
  }));

  const inspections = await inspectCandidatePages(
    rankedHits.map((result) => ({
      url: result.url,
      productInfo,
      sourceWebsite: result.hostname,
      extractionMethod: "search-engine-result",
      ingredientSource: result.hostname,
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

    if (candidateReport.productMatch) {
      report.topProductMatches.push({
        url: candidateReport.url,
        title: candidateReport.parsedProduct?.name || productInfo.name,
        score: candidateReport.productMatch.finalScore,
        accepted: candidateReport.productMatch.accepted,
        summary: candidateReport.productMatch.summary
      });
    }

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

  report.topProductMatches = report.topProductMatches
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);

  if (!candidates.length && report.candidateUrls.length) {
    report.lastReason = `Evaluated ${report.inspectedPages} broader web candidate page${report.inspectedPages === 1 ? "" : "s"}; no verified ingredient list was found.`;
  }

  return { candidates, attempts, report };
}
