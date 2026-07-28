import * as cheerio from "cheerio";

import { buildSourceScopedQueries, inspectCandidatePages, searchDomainResults } from "./search-utils.js";
import { fetchStaticHtml } from "./page-fetcher.js";
import { matchProducts } from "./product-matcher.js";
import { resolveOfficialBrand } from "../../services/official-brand-resolver.js";
import { normalizeProductName, slugToTitle } from "../product-normalizer.js";

function slugify(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function safeUrl(value = "", baseUrl = "") {
  try {
    return new URL(String(value || "").trim(), baseUrl).toString();
  } catch (_error) {
    return "";
  }
}

function sameHostname(url = "", domain = "") {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    const normalizedDomain = domain.replace(/^www\./i, "").toLowerCase();
    return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
  } catch (_error) {
    return false;
  }
}

function buildSeedUrls(domain, productInfo) {
  const nameSlug = slugify([productInfo.name, productInfo.variant].filter(Boolean).join(" "));
  const baseSlug = slugify(productInfo.name || productInfo.canonicalName || "");

  return [
    `https://${domain}/products/${nameSlug}`,
    `https://${domain}/products/${baseSlug}`
  ].filter(Boolean);
}

function buildOfficialSearchUrls(domain, productInfo = {}) {
  const searchTerms = [
    [productInfo.brand, productInfo.canonicalName || productInfo.name].filter(Boolean).join(" "),
    [productInfo.name, productInfo.variant].filter(Boolean).join(" "),
    productInfo.canonicalName || productInfo.name || ""
  ]
    .map((value) => normalizeProductName(value))
    .filter(Boolean);

  return [...new Set(searchTerms.flatMap((term) => {
    const encoded = encodeURIComponent(term);
    return [
      `https://${domain}/search?q=${encoded}`,
      `https://${domain}/search?type=product&q=${encoded}`,
      `https://${domain}/pages/search-results-page?q=${encoded}`,
      `https://${domain}/collections/all?q=${encoded}`,
      `https://${domain}/?s=${encoded}`
    ];
  }))].slice(0, 10);
}

function scoreOfficialLink(productInfo = {}, link = {}) {
  const urlTitle = slugToTitle(new URL(link.url).pathname.split("/").filter(Boolean).pop() || "");
  const candidateName = link.text || urlTitle;
  const productMatch = matchProducts(productInfo, {
    name: candidateName,
    brand: productInfo.brand,
    category: productInfo.category,
    description: `${link.url} ${link.text || ""}`,
    url: link.url
  });

  let score = productMatch.finalScore;
  if (/\/products?\//i.test(link.url)) score += 12;
  if (/ingredient|inci|composition/i.test(`${link.url} ${link.text || ""}`)) score += 8;
  if (/search|collection|collections|tagged|category/i.test(link.url)) score -= 14;

  return {
    ...link,
    score: Math.max(0, score),
    productMatch
  };
}

function extractCandidateLinksFromSearchPage(html = "", searchUrl = "", domain = "", productInfo = {}) {
  const $ = cheerio.load(html || "");
  const links = [];

  $("a[href]").each((_index, anchor) => {
    const href = $(anchor).attr("href") || "";
    const url = safeUrl(href, searchUrl);
    if (!url || !sameHostname(url, domain)) return;

    const text = $(anchor).text().replace(/\s+/g, " ").trim();
    const combined = `${url} ${text}`.toLowerCase();
    if (!/product|shop|pdp|item|ingredient|inci|composition/.test(combined)) return;

    links.push(scoreOfficialLink(productInfo, {
      url,
      text,
      discoveredFrom: searchUrl
    }));
  });

  const seen = new Set();
  return links
    .sort((left, right) => right.score - left.score)
    .filter((link) => {
      if (seen.has(link.url)) return false;
      seen.add(link.url);
      return true;
    })
    .slice(0, 8);
}

async function searchOfficialSiteInternally(domain, productInfo, options = {}) {
  const searchUrls = buildOfficialSearchUrls(domain, productInfo);
  const settled = await Promise.allSettled(searchUrls.map(async (searchUrl) => {
    const response = await fetchStaticHtml(searchUrl, {
      timeoutMs: options.searchTimeoutMs || 5000,
      retries: 1,
      signal: options.signal
    });

    if (!response.ok || !response.html) {
      return [];
    }

    return extractCandidateLinksFromSearchPage(response.html, response.finalUrl || searchUrl, domain, productInfo);
  }));

  const links = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      links.push(...result.value);
    }
  }

  const seen = new Set();
  return links
    .sort((left, right) => right.score - left.score)
    .filter((link) => {
      if (seen.has(link.url)) return false;
      seen.add(link.url);
      return true;
    })
    .slice(0, 10);
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
    candidateUrls: [],
    internalSearchPagesChecked: 0,
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
    const [searchSeedResults, internalSearchResults] = await Promise.all([
      searchDomainResults(queries, [domain], {
        limitPerDomain: 8,
        signal: options.signal,
        timeoutMs: options.searchTimeoutMs || 5000,
        queryLimit: 4
      }),
      searchOfficialSiteInternally(domain, productInfo, options)
    ]);

    report.internalSearchPagesChecked += buildOfficialSearchUrls(domain, productInfo).length;

    const rankedSearchUrls = searchSeedResults.map((entry) => scoreOfficialLink(productInfo, {
      url: entry.url,
      text: entry.query,
      discoveredFrom: `duckduckgo:${entry.query}`
    }));

    const rankedUrls = [
      ...internalSearchResults,
      ...rankedSearchUrls,
      ...buildSeedUrls(domain, productInfo).map((url) => scoreOfficialLink(productInfo, { url, text: productInfo.name || "", discoveredFrom: "slug-seed" }))
    ]
      .sort((left, right) => right.score - left.score);

    const seenUrls = new Set();
    const uniqueUrls = rankedUrls
      .filter((entry) => {
        if (!entry.url || seenUrls.has(entry.url)) return false;
        seenUrls.add(entry.url);
        return true;
      })
      .slice(0, 10);

    report.candidateUrls.push(...uniqueUrls.map((entry) => ({
      url: entry.url,
      score: Math.round(entry.score),
      discoveredFrom: entry.discoveredFrom || "unknown"
    })));

    const inspections = await inspectCandidatePages(
      uniqueUrls.map((entry) => ({
        url: entry.url,
        productInfo,
        sourceWebsite: domain,
        extractionMethod: "official-site-search",
        ingredientSource: domain,
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
        report.lastReason = `Official domain resolved: ${domain}. Matched official product page. ${candidateReport.productMatch?.summary || "Verification passed."}`;
      } else if (candidateReport.reason) {
        report.lastReason = `Official domain resolved: ${domain}. ${candidateReport.reason}`;
      }
    }
  }

  report.topProductMatches = scoredPages
    .sort((left, right) => right.score - left.score)
    .slice(0, 8);

  if (!candidates.length && report.topProductMatches.length) {
    const best = report.topProductMatches[0];
    report.lastReason = `Official domain resolved: ${brandResolution.officialDomain}. Best product match scored ${best.score}% for ${best.title}. ${best.summary}`;
  } else if (!candidates.length && report.candidateUrls.length) {
    report.lastReason = `Official domain resolved: ${brandResolution.officialDomain}. Evaluated ${report.candidateUrls.length} candidate official page${report.candidateUrls.length === 1 ? "" : "s"}, but none contained a verified ingredient list.`;
  }

  return { candidates, attempts, report };
}
