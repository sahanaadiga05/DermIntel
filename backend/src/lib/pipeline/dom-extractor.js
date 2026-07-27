import { createIngredientCandidate } from "./ingredient-candidate.js";

let cheerioModule = null;
let attemptedCheerioLoad = false;

async function getCheerio() {
  if (!attemptedCheerioLoad) {
    attemptedCheerioLoad = true;
    try {
      cheerioModule = await import("cheerio");
    } catch (_error) {
      cheerioModule = null;
    }
  }

  return cheerioModule;
}

const HEADING_PATTERNS = [
  /ingredients?/i,
  /ingredient list/i,
  /full ingredients?/i,
  /composition/i,
  /contains/i,
  /inci/i
];

function cleanText(value = "") {
  return value
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function looksUseful(text = "") {
  const normalized = cleanText(text);
  return normalized.length >= 24 && /[,;]|\bwater\b|\baqua\b|\bglycerin\b|\bextract\b/i.test(normalized);
}

function getClosestContent($, element) {
  const candidates = [];
  const base = $(element);
  const neighbors = [
    base.next(),
    base.parent().next(),
    base.closest("details,section,article,div,li,td,tr").find(".accordion-content,.tab-content,[role='tabpanel'],dd,p,div,span,li").first(),
    base.closest("details,section,article,div,li,td,tr").next()
  ].filter((entry) => entry && entry.length);

  for (const candidate of neighbors) {
    const text = cleanText(candidate.text());
    if (looksUseful(text)) {
      candidates.push(text);
    }
  }

  return candidates;
}

function findHeadingCandidates($) {
  const hits = [];

  $("h1,h2,h3,h4,h5,h6,strong,b,summary,button,dt,th,span,div,p,li,a").each((_, element) => {
    const text = cleanText($(element).text());
    if (!text || text.length > 80) {
      return;
    }

    if (HEADING_PATTERNS.some((pattern) => pattern.test(text))) {
      hits.push({
        text,
        values: getClosestContent($, element)
      });
    }
  });

  return hits;
}

function collectDatasetValues($) {
  const results = [];

  $("[data-ingredients],[data-inci],[data-composition],[data-full-ingredients]").each((_, element) => {
    for (const attribute of Object.keys(element.attribs || {})) {
      if (/data-(ingredients|inci|composition|full-ingredients)/i.test(attribute)) {
        const value = cleanText(element.attribs[attribute] || "");
        if (looksUseful(value)) {
          results.push({
            label: attribute,
            value
          });
        }
      }
    }
  });

  return results;
}

function collectIngredientTableValues($) {
  const results = [];

  $("table").each((_, table) => {
    const rows = [];
    const headers = $(table)
      .find("tr")
      .first()
      .find("th,td")
      .map((__, cell) => cleanText($(cell).text()).toLowerCase())
      .get();

    if (!headers.some((header) => /^ingredients?$/.test(header))) {
      return;
    }

    $(table)
      .find("tr")
      .slice(1)
      .each((__, row) => {
        const ingredient = cleanText($(row).find("th,td").first().text());
        if (ingredient && !/^ingredients?$/i.test(ingredient)) {
          rows.push(ingredient);
        }
      });

    if (rows.length >= 8) {
      results.push({
        label: "ingredient-table",
        value: rows.join(", ")
      });
    }
  });

  return results;
}

export async function extractDomIngredientCandidates({ html = "", sourceUrl = "", sourceWebsite = "", product = null }) {
  const cheerio = await getCheerio();
  if (!cheerio?.load || !html) {
    return [];
  }

  const $ = cheerio.load(html);
  const candidates = [];
  const seen = new Set();

  for (const hit of findHeadingCandidates($)) {
    for (const value of hit.values) {
      const key = `${hit.text}:${value}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      candidates.push(
        createIngredientCandidate({
          sourceUrl,
          sourceWebsite,
          stage: "retailer-page",
          extractionMethod: "dom-heading",
          ingredientSource: hit.text,
          rawExtractedIngredients: value,
          metadata: {
            matchedHeading: hit.text
          },
          product
        })
      );
    }
  }

  for (const dataset of collectDatasetValues($)) {
    const key = `${dataset.label}:${dataset.value}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    candidates.push(
      createIngredientCandidate({
        sourceUrl,
        sourceWebsite,
        stage: "retailer-page",
        extractionMethod: "dom-dataset",
        ingredientSource: dataset.label,
        rawExtractedIngredients: dataset.value,
        metadata: {
          matchedHeading: dataset.label
        },
        product
      })
    );
  }

  for (const table of collectIngredientTableValues($)) {
    const key = `${table.label}:${table.value}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    candidates.push(
      createIngredientCandidate({
        sourceUrl,
        sourceWebsite,
        stage: "retailer-page",
        extractionMethod: "dom-table",
        ingredientSource: table.label,
        rawExtractedIngredients: table.value,
        metadata: {
          matchedHeading: table.label
        },
        product
      })
    );
  }

  return candidates;
}
