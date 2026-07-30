import { buildSourceScopedQueries, inspectCandidatePages, searchDomainResults } from "./search-utils.js";

const TRUSTED_DATABASES = [
  { label: "INCI Decoder", domain: "incidecoder.com" },
  { label: "CosDNA", domain: "cosdna.com" },
  { label: "SkinSort", domain: "skinsort.com" },
  { label: "Beautypedia", domain: "beautypedia.com" },
  { label: "EWG", domain: "ewg.org" },
  { label: "INC Beauty", domain: "incibeauty.com" },
  { label: "SkinSAFE", domain: "skinsafeproducts.com" },
  { label: "Paula's Choice", domain: "paulaschoice.com" },
  { label: "Sephora", domain: "sephora.com" },
  { label: "Ulta", domain: "ulta.com" },
  { label: "Lookfantastic", domain: "lookfantastic.com" }
];

function slugifyProduct(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\bfacewash\b/g, "face wash")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildTrustedDirectUrls(productInfo = {}) {
  const brand = productInfo.brand || "";
  const name = productInfo.canonicalName || productInfo.name || "";
  const compactName = name
    .replace(/\b(?:daily|mild|cleanser|for all skin types?|soap free|balances? ph)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const slugs = [
    slugifyProduct(`${brand} ${compactName}`),
    slugifyProduct(`${brand} ${String(compactName).replace(/\bcleansing face wash\b/i, "face wash")}`),
    slugifyProduct(`${brand} ${name}`)
  ].filter(Boolean);

  return [...new Set(slugs)].flatMap((slug) => [
    {
      source: { label: "INCI Decoder", domain: "incidecoder.com" },
      url: `https://incidecoder.com/products/${slug}`,
      query: "direct-slug"
    }
  ]);
}

export async function searchTrustedDatabasesForIngredients(productInfo, options = {}) {
  const candidates = [];
  const attempts = [];
  const report = {
    inspectedPages: 0,
    matchedPages: 0,
    ingredientHits: 0,
    verifiedCandidates: 0,
    sourcesSearched: TRUSTED_DATABASES.map((source) => source.label),
    candidateUrls: [],
    lastReason: "No trusted database result matched yet."
  };

  const directJobs = buildTrustedDirectUrls(productInfo);
  const directInspections = await inspectCandidatePages(
    directJobs.map(({ source, url }) => ({
      url,
      productInfo,
      sourceWebsite: source.label,
      extractionMethod: `trusted-database:${source.label}`,
      ingredientSource: source.label,
      minIngredientCount: 8,
      staticTimeoutMs: Math.min(options.fetchTimeoutMs || 5000, 3500),
      dynamicTimeoutMs: Math.min(options.dynamicTimeoutMs || 8000, 5500)
    })),
    {
      concurrency: 2,
      stopOnVerified: true,
      signal: options.signal
    }
  );

  for (const inspection of directInspections) {
    if (inspection.status !== "fulfilled") continue;
    const inspected = inspection.value;
    report.inspectedPages += 1;
    attempts.push(...(inspected.attempts || []));
    if (inspected.report?.parsedProduct) report.matchedPages += 1;
    if (inspected.report?.foundIngredients) report.ingredientHits += 1;
    if (inspected.candidate) {
      candidates.push(inspected.candidate);
      report.verifiedCandidates += 1;
      report.lastReason = `Found verified ingredients on ${inspected.candidate.sourceWebsite}.`;
    }
  }

  report.candidateUrls = directJobs.map((job) => ({
    source: job.source.label,
    url: job.url,
    query: job.query
  }));

  if (candidates.length) {
    return { candidates, attempts, report };
  }

  const searchHits = await Promise.allSettled(
    TRUSTED_DATABASES.map(async (source) => ({
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

  report.candidateUrls.push(...uniqueJobs.slice(0, 12).map((job) => ({
    source: job.source.label,
    url: job.url,
    query: job.query
  })));

  const inspections = await inspectCandidatePages(
    uniqueJobs.slice(0, 12).map(({ source, url }) => ({
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
    report.lastReason = `Checked ${report.inspectedPages} trusted source candidate page${report.inspectedPages === 1 ? "" : "s"}; no verified ingredient list was found.`;
  }

  return { candidates, attempts, report };
}
