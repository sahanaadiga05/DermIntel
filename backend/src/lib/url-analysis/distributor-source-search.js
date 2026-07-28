import { buildSourceScopedQueries, inspectCandidatePages, searchGeneralResults } from "./search-utils.js";
import { matchProducts } from "./product-matcher.js";
import { slugToTitle } from "../product-normalizer.js";

const NON_RETAIL_RESULT_PATTERNS = [
  "reddit.",
  "youtube.",
  "instagram.",
  "facebook.",
  "pinterest.",
  "tiktok.",
  "medium.",
  "wordpress.",
  "blogspot."
];

function allowDistributorResult(url = "") {
  const normalized = String(url || "").toLowerCase();
  return !NON_RETAIL_RESULT_PATTERNS.some((pattern) => normalized.includes(pattern));
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
    return "Distributor Result";
  }
}

function buildDistributorQueries(productInfo = {}) {
  return buildSourceScopedQueries(productInfo, {
    sourceLabel: "retailer distributor pharmacy product page ingredients"
  });
}

function rankDistributorHits(productInfo = {}, hits = []) {
  return hits
    .map((hit) => {
      const hostname = getHostname(hit.url);
      const productMatch = matchProducts(productInfo, {
        name: urlToCandidateTitle(hit.url),
        brand: productInfo.brand,
        category: productInfo.category,
        description: `${hit.query || ""} ${hit.url}`,
        url: hit.url
      });
      let score = productMatch.finalScore;
      if (/ingredient|inci|composition|product|pdp|item|buy|shop/i.test(`${hit.query || ""} ${hit.url}`)) score += 14;
      if (/search|collection|collections|catalog|tagged|category/i.test(hit.url)) score -= 14;

      return {
        ...hit,
        source: {
          label: hostname,
          domain: hostname
        },
        rankScore: Math.max(0, score),
        productMatch
      };
    })
    .sort((left, right) => right.rankScore - left.rankScore);
}

export async function searchDistributorPagesForIngredients(productInfo, options = {}) {
  const candidates = [];
  const attempts = [];
  const report = {
    inspectedPages: 0,
    matchedPages: 0,
    ingredientHits: 0,
    verifiedCandidates: 0,
    sourcesSearched: ["generic-web-distributor-search"],
    candidateUrls: [],
    lastReason: "No distributor page matched yet."
  };

  const searchHits = await searchGeneralResults(buildDistributorQueries(productInfo), {
    limit: 14,
    allowUrl: allowDistributorResult,
    signal: options.signal,
    timeoutMs: options.searchTimeoutMs || 5000,
    queryLimit: 4
  });

  const rankedHits = rankDistributorHits(productInfo, searchHits).slice(0, 10);

  report.candidateUrls = rankedHits.map((hit) => ({
    source: hit.source.label,
    url: hit.url,
    query: hit.query,
    score: Math.round(hit.rankScore)
  }));

  const inspections = await inspectCandidatePages(
    rankedHits.map(({ source, url }) => ({
      url,
      productInfo,
      sourceWebsite: source.label,
      extractionMethod: "distributor:generic-search",
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
    report.lastReason = `Checked ${report.inspectedPages} generic distributor/retailer candidate page${report.inspectedPages === 1 ? "" : "s"}; no verified ingredient list was found.`;
  }

  return { candidates, attempts, report };
}