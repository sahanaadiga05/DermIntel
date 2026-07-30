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

const HEADING_PATTERN = /\b(?:full\s+)?ingredients?(?:\s+list)?\b|\binci\b|\bcomposition\b|\bwhat(?:'s| is)\s+inside\b/i;
const PARTIAL_PATTERN = /\b(?:key|hero|featured|active)\s+ingredients?\b|\bhighlights?\b|\bbenefits?\b/i;
const STOP_PATTERN = /\b(?:directions?|how to use|usage|warnings?|caution|benefits?|description|reviews?|shipping|returns?|faq|about)\b/i;
const CONTENT_SELECTORS = [
  "[data-ingredients]",
  "[data-inci]",
  "[data-composition]",
  "[data-full-ingredients]",
  "[itemprop='ingredients']",
  "[itemprop='ingredient']",
  "[class*='ingredient' i]",
  "[id*='ingredient' i]",
  "[class*='inci' i]",
  "[id*='inci' i]",
  "[class*='composition' i]",
  "[id*='composition' i]"
].join(",");

function cleanText(value = "") {
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*([,;|•·])\s*/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(value = "") {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function trimIngredientBlock(value = "") {
  return cleanText(value)
    .split(/\b(?:please be aware|for refilled products|actual product packaging|ingredient lists? (?:for|may|can|are)|directions?|how to use|usage|warnings?|caution|reviews?|shipping|returns?)\b/i)[0]
    .replace(/^(?:full\s+)?ingredients?(?:\s+list)?\s*:?\s*/i, "")
    .replace(/[,\s]+$/, "")
    .trim();
}

function looksUseful(text = "") {
  const normalized = cleanText(text);
  if (normalized.length < 20 || PARTIAL_PATTERN.test(normalized.slice(0, 100))) {
    return false;
  }

  const separators = (normalized.match(/[,;|•·]/g) || []).length;
  const ingredientSignals = (normalized.match(/\b(?:aqua|water|glycerin|glycol|acid|extract|oil|alcohol|sodium|potassium|fragrance|parfum)\b/gi) || []).length;
  return separators >= 2 || ingredientSignals >= 3;
}

function textWithSeparators($, element) {
  const clone = $(element).clone();
  clone.find("script,style,noscript,svg,button").remove();
  clone.find("br").replaceWith(", ");
  clone.find("li").each((_, item) => {
    $(item).append(", ");
  });
  clone.find("p,dd,tr").each((_, item) => {
    $(item).append(" ");
  });
  return cleanText(clone.text()).replace(/(?:,\s*){2,}/g, ", ").replace(/,\s*$/, "");
}

function controlledContent($, element) {
  const base = $(element);
  const ids = [
    base.attr("aria-controls"),
    (base.attr("href") || "").startsWith("#") ? base.attr("href").slice(1) : "",
    (base.attr("data-target") || "").replace(/^#/, "")
  ].filter(Boolean);

  return ids
    .map((id) => $(`#${CSS_ESCAPE(id)}`).first())
    .filter((entry) => entry.length)
    .map((entry) => textWithSeparators($, entry))
    .filter(looksUseful);
}

function CSS_ESCAPE(value = "") {
  return String(value).replace(/([ #;?%&,.+*~':"!^$[\]()=>|/@])/g, "\\$1");
}

function siblingContent($, element) {
  const values = [];
  let sibling = $(element).next();
  let inspected = 0;

  while (sibling.length && inspected < 6) {
    const tagName = String(sibling[0]?.tagName || "").toLowerCase();
    const text = textWithSeparators($, sibling);
    if (/^h[1-6]$/.test(tagName) || (text.length < 90 && STOP_PATTERN.test(text))) {
      break;
    }
    if (looksUseful(text)) {
      values.push(text);
    }
    sibling = sibling.next();
    inspected += 1;
  }

  return values;
}

function getClosestContent($, element) {
  const base = $(element);
  const values = [
    ...controlledContent($, element),
    ...siblingContent($, element)
  ];

  const details = base.closest("details");
  if (details.length) {
    const detailText = textWithSeparators($, details.clone().find("summary").remove().end());
    if (looksUseful(detailText)) values.push(detailText);
  }

  const region = base.closest("section,article,[role='tabpanel'],.accordion-item,.accordion__item,.product-accordion,.tab-pane,div");
  if (region.length) {
    const regionClone = region.clone();
    regionClone.find("h1,h2,h3,h4,h5,h6,summary,button").first().remove();
    const regionText = textWithSeparators($, regionClone);
    if (looksUseful(regionText)) values.push(regionText);
  }

  return [...new Map(values.map((value) => [normalizeKey(value), value])).values()];
}

function findHeadingCandidates($) {
  const hits = [];
  $("h1,h2,h3,h4,h5,h6,strong,b,summary,button,dt,th,[role='tab'],[role='button'],label").each((_, element) => {
    const text = cleanText($(element).text());
    if (!text || text.length > 100 || !HEADING_PATTERN.test(text) || PARTIAL_PATTERN.test(text)) {
      return;
    }
    hits.push({ text, values: getClosestContent($, element) });
  });
  return hits;
}

function collectAttributeValues($) {
  const results = [];
  $("*").each((_, element) => {
    for (const [attribute, rawValue] of Object.entries(element.attribs || {})) {
      if (!/(?:^|[-_:])(ingredients?|inci|composition)(?:$|[-_:])/i.test(attribute)) continue;
      const value = cleanText(rawValue || "");
      if (looksUseful(value)) results.push({ label: attribute, value });
    }
  });
  return results;
}

function collectDirectContainers($) {
  const results = [];
  $(CONTENT_SELECTORS).each((_, element) => {
    const node = $(element);
    const label = cleanText([
      node.attr("id"),
      node.attr("class"),
      node.attr("itemprop"),
      node.attr("aria-label"),
      node.attr("data-title")
    ].filter(Boolean).join(" "));
    if (PARTIAL_PATTERN.test(label)) return;

    const value = node.attr("content") || textWithSeparators($, element);
    if (looksUseful(value)) results.push({ label: label || "ingredient-container", value });
  });
  return results;
}

function collectMetaValues($) {
  const results = [];
  $("meta").each((_, element) => {
    const label = cleanText(`${$(element).attr("name") || ""} ${$(element).attr("property") || ""} ${$(element).attr("itemprop") || ""}`);
    const value = cleanText($(element).attr("content") || "");
    if (HEADING_PATTERN.test(label) && !PARTIAL_PATTERN.test(label) && looksUseful(value)) {
      results.push({ label, value });
    }
  });
  return results;
}

function collectIngredientTableValues($) {
  const results = [];
  $("table").each((_, table) => {
    const headerCells = $(table).find("tr").first().find("th,td").toArray();
    const ingredientColumn = headerCells.findIndex((cell) => /\bingredients?\b|\binci\b/i.test(cleanText($(cell).text())));
    if (ingredientColumn < 0) return;

    const rows = [];
    $(table).find("tr").slice(1).each((__, row) => {
      const cells = $(row).find("th,td");
      const ingredient = cleanText(cells.eq(ingredientColumn).text());
      if (ingredient && !HEADING_PATTERN.test(ingredient)) rows.push(ingredient);
    });

    if (rows.length >= 3) results.push({ label: "ingredient-table", value: rows.join(", ") });
  });
  return results;
}

export async function extractDomIngredientCandidates({ html = "", sourceUrl = "", sourceWebsite = "", product = null }) {
  const cheerio = await getCheerio();
  if (!cheerio?.load || !html) return [];

  const $ = cheerio.load(html);
  $("script,style,noscript,svg,nav,footer").remove();
  const candidates = [];
  const seen = new Set();

  const addCandidate = (label, value, extractionMethod) => {
    const trimmedValue = trimIngredientBlock(value);
    const key = normalizeKey(trimmedValue);
    if (!key || seen.has(key) || !looksUseful(trimmedValue)) return;
    seen.add(key);
    candidates.push(createIngredientCandidate({
      sourceUrl,
      sourceWebsite,
      stage: "retailer-page",
      extractionMethod,
      ingredientSource: label,
      rawExtractedIngredients: trimmedValue,
      metadata: { matchedHeading: label },
      product
    }));
  };

  for (const hit of findHeadingCandidates($)) {
    for (const value of hit.values) addCandidate(hit.text, value, "dom-heading");
  }
  for (const item of collectDirectContainers($)) addCandidate(item.label, item.value, "dom-container");
  for (const item of collectAttributeValues($)) addCandidate(item.label, item.value, "dom-dataset");
  for (const item of collectMetaValues($)) addCandidate(item.label, item.value, "dom-meta");
  for (const item of collectIngredientTableValues($)) addCandidate(item.label, item.value, "dom-table");

  return candidates;
}
