import {
  detectBrand,
  detectCategory,
  extractCoreProductName,
  extractProductSku,
  normalizeIngredientList,
  normalizeProductName,
  normalizeWhitespace
} from "./product-normalizer.js";
import { extractDomIngredientCandidates } from "./pipeline/dom-extractor.js";
import { createIngredientCandidate } from "./pipeline/ingredient-candidate.js";
import { prioritizeIngredientCandidatesWithAi } from "./pipeline/ai-ingredient-extractor.js";
import { extractStructuredIngredientCandidates, extractStructuredProductData } from "./pipeline/structured-data-extractor.js";

const MARKETING_BLACKLIST = [
  "key ingredients",
  "benefits",
  "why you'll love it",
  "why we love it",
  "good to know",
  "hero ingredients"
];

function decodeHtml(value = "") {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripHtml(html = "") {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  );
}

export function extractMetaContent(html = "", key) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["']`, "i")
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1]);
    }
  }

  return "";
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function flattenJsonLd(value) {
  if (Array.isArray(value)) {
    return value.flatMap(flattenJsonLd);
  }

  if (value?.["@graph"]) {
    return flattenJsonLd(value["@graph"]);
  }

  return value ? [value] : [];
}

export function extractJsonLdProduct(html = "") {
  const matches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];

  for (const scriptBlock of matches) {
    const contentMatch = scriptBlock.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    const parsed = safeJsonParse(contentMatch?.[1] || "");

    if (!parsed) {
      continue;
    }

    const nodes = flattenJsonLd(parsed);
    const productNode = nodes.find((node) => {
      const type = Array.isArray(node?.["@type"]) ? node["@type"].join(" ") : node?.["@type"];
      return typeof type === "string" && /product/i.test(type);
    });

    if (productNode) {
      return {
        name: normalizeProductName(productNode.name || ""),
        canonicalName: extractCoreProductName(productNode.name || "", {
          brand: typeof productNode.brand === "string" ? productNode.brand : productNode.brand?.name || "",
          category: detectCategory(productNode.name || "", productNode.description || "")
        }),
        brand:
          typeof productNode.brand === "string"
            ? productNode.brand
            : productNode.brand?.name || "",
        image: Array.isArray(productNode.image) ? productNode.image[0] : productNode.image || "",
        description: normalizeWhitespace(productNode.description || ""),
        ingredients: normalizeIngredientList(productNode.ingredients || productNode.material || ""),
        sku: extractProductSku(productNode.sku, productNode.mpn, productNode.productID)
      };
    }
  }

  return null;
}

function extractTitle(html = "", fallback = "") {
  const metaTitle =
    extractMetaContent(html, "og:title") ||
    extractMetaContent(html, "twitter:title") ||
    extractMetaContent(html, "title");

  if (metaTitle) {
    return normalizeProductName(metaTitle);
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return normalizeProductName(titleMatch?.[1] || fallback);
}


function extractHeadingTitle(html = "") {
  const h1Match = html.match(/<h1[^>]*>([\s\S]{2,240}?)<\/h1>/i);
  return normalizeProductName(stripHtml(h1Match?.[1] || ""));
}

function extractMetaBrand(html = "") {
  return normalizeWhitespace(
    extractMetaContent(html, "brand") ||
    extractMetaContent(html, "product:brand") ||
    extractMetaContent(html, "og:brand") ||
    extractMetaContent(html, "twitter:data1") ||
    ""
  );
}

const RETAILER_BRAND_NAMES = new Set([
  "amazon",
  "amazon in",
  "myntra",
  "nykaa",
  "flipkart",
  "meesho",
  "ajio"
]);

function cleanRetailerBrand(value = "") {
  const cleaned = normalizeWhitespace(stripHtml(value))
    .replace(/^(?:visit|shop)\s+(?:the\s+)?/i, "")
    .replace(/^(?:brand|manufacturer)\s*[:\-]\s*/i, "")
    .replace(/\s+(?:official\s+)?store$/i, "")
    .trim();
  return RETAILER_BRAND_NAMES.has(cleaned.toLowerCase()) ? "" : cleaned;
}

function extractRetailerBrand(html = "") {
  const patterns = [
    /<(?:a|span)[^>]+id=["']bylineInfo["'][^>]*>([\s\S]{1,180}?)<\/(?:a|span)>/i,
    /<(?:a|span)[^>]+class=["'][^"']*(?:brand|manufacturer)[^"']*["'][^>]*>([\s\S]{1,180}?)<\/(?:a|span)>/i,
    /data-brand-name=["']([^"']{1,120})["']/i
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const brand = cleanRetailerBrand(match?.[1] || "");
    if (brand) return brand;
  }

  return "";
}

function extractBreadcrumbName(html = "") {
  const matches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];

  for (const scriptBlock of matches) {
    const contentMatch = scriptBlock.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    const parsed = safeJsonParse(contentMatch?.[1] || "");
    const nodes = flattenJsonLd(parsed);
    const breadcrumb = nodes.find((node) => {
      const type = Array.isArray(node?.["@type"]) ? node["@type"].join(" ") : node?.["@type"];
      return typeof type === "string" && /breadcrumb/i.test(type);
    });

    const items = breadcrumb?.itemListElement || [];
    const lastItem = Array.isArray(items) ? items.at(-1) : null;
    const name = lastItem?.name || lastItem?.item?.name || "";
    if (name) {
      return normalizeProductName(name);
    }
  }

  return "";
}

function chooseReliableText(candidates = []) {
  const normalized = candidates
    .filter((entry) => entry?.value)
    .map((entry) => ({
      ...entry,
      value: normalizeProductName(entry.value)
    }))
    .filter((entry) => entry.value);

  if (!normalized.length) return "";

  return normalized
    .map((entry) => {
      const agreement = normalized.filter((other) => {
        if (other === entry) return false;
        const left = entry.value.toLowerCase();
        const right = other.value.toLowerCase();
        return left.includes(right) || right.includes(left);
      }).length;
      return {
        ...entry,
        score: (entry.weight || 0) + agreement * 12 + Math.min(entry.value.length, 90) / 10
      };
    })
    .sort((left, right) => right.score - left.score)[0].value;
}
function extractHtmlImage(html = "") {
  return extractMetaContent(html, "og:image") || extractMetaContent(html, "twitter:image") || "";
}

function extractDescription(html = "") {
  return extractMetaContent(html, "og:description") || extractMetaContent(html, "description") || "";
}

function extractHtmlSku(html = "") {
  return extractProductSku(
    extractMetaContent(html, "sku"),
    extractMetaContent(html, "product:sku"),
    html
  );
}

function buildOfficialSectionPattern(label) {
  return new RegExp(`${label}[^a-z0-9]{0,12}([a-z0-9()/%+,.\\-\\s]{40,2400})`, "i");
}

function cleanIngredientSection(value = "") {
  return normalizeIngredientList(
    value
      .split(/(?:directions|how to use|benefits|about this item|usage|warnings|manufacturer|customer care|country of origin)/i)[0]
      .trim()
  );
}

function isLikelyMarketingList(value = "") {
  const normalized = value.toLowerCase();
  return MARKETING_BLACKLIST.some((phrase) => normalized.includes(phrase));
}

function looksLikeIngredientList(value = "") {
  if (isLikelyMarketingList(value)) {
    return false;
  }

  const items = cleanIngredientSection(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length < 3) {
    return false;
  }

  const ingredientLikeCount = items.filter((item) => /^[a-z0-9()/%+\-\s]{3,}$/i.test(item)).length;
  return ingredientLikeCount >= Math.max(3, Math.floor(items.length * 0.75));
}

function scoreIngredientCandidate(candidate) {
  const label = `${candidate.ingredientSource || ""} ${candidate.metadata?.matchedHeading || ""} ${candidate.metadata?.sourceBlock || ""}`.toLowerCase();
  const count = candidate.parsedIngredientList?.length || 0;
  const raw = candidate.rawExtractedIngredients || "";
  let score = Math.min(count, 60) * 1.5;

  if (/full ingredients?|inci|complete ingredients?|composition/.test(label)) {
    score += 55;
  }

  if (/ingredients?/.test(label)) {
    score += 18;
  }

  if (/key ingredients?|hero ingredients?|benefits|why/.test(label)) {
    score -= 80;
  }

  if (count < 8) {
    score -= 45;
  }

  if (candidate.extractionMethod === "dom-table") score += 18;
  if (candidate.extractionMethod === "dom-container") score += 10;
  if (/\.{3}|…|\betc\.?\s*$/i.test(raw)) score -= 35;

  return score;
}

function rankIngredientCandidates(candidates = []) {
  return [...candidates].sort((left, right) => scoreIngredientCandidate(right) - scoreIngredientCandidate(left));
}

export function extractIngredientsText(html = "") {
  const text = stripHtml(html);
  const sectionPatterns = [
    buildOfficialSectionPattern("ingredients"),
    buildOfficialSectionPattern("full ingredients"),
    buildOfficialSectionPattern("inci"),
    /manufacturer[^a-z0-9]{0,12}ingredients[^a-z0-9]{0,12}([a-z0-9()/%+,.\-\s]{40,2400})/i,
    /product description[^a-z0-9]{0,24}ingredients[^a-z0-9]{0,12}([a-z0-9()/%+,.\-\s]{40,2400})/i
  ];

  for (const pattern of sectionPatterns) {
    const match = text.match(pattern);
    if (match?.[1] && looksLikeIngredientList(match[1])) {
      return cleanIngredientSection(match[1]);
    }
  }

  return "";
}

export async function extractIngredientCandidates(html = "", options = {}) {
  const { sourceUrl = "", sourceWebsite = "", product = null } = options;
  const candidates = [];

  const domCandidates = await extractDomIngredientCandidates({
    html,
    sourceUrl,
    sourceWebsite,
    product
  });
  candidates.push(...domCandidates);

  const structuredCandidates = extractStructuredIngredientCandidates({
    html,
    sourceUrl,
    sourceWebsite,
    product
  });
  candidates.push(...structuredCandidates);

  const jsonLd = extractJsonLdProduct(html);
  if (jsonLd?.ingredients) {
    candidates.push(
      createIngredientCandidate({
        sourceUrl,
        sourceWebsite,
        stage: "structured-data",
        extractionMethod: "json-ld",
        ingredientSource: "json-ld",
        rawExtractedIngredients: jsonLd.ingredients,
        metadata: {
          sourceBlock: "json-ld"
        },
        product
      })
    );
  }

  const regexFallback = extractIngredientsText(html);
  if (regexFallback) {
    candidates.push(
      createIngredientCandidate({
        sourceUrl,
        sourceWebsite,
        stage: "fallback",
        extractionMethod: "regex-fallback",
        ingredientSource: "regex",
        rawExtractedIngredients: regexFallback,
        metadata: {
          sourceBlock: "regex-fallback"
        },
        product
      })
    );
  }

  return prioritizeIngredientCandidatesWithAi({
    candidates: rankIngredientCandidates(candidates),
    pageText: stripHtml(html)
  });
}

export async function extractProductInfo(html = "", fallbackName = "", siteHints = {}) {
  const jsonLd = extractJsonLdProduct(html);
  const structured = extractStructuredProductData(html);
  const title = extractTitle(html, fallbackName);
  const description = structured?.description || jsonLd?.description || extractDescription(html);
  const candidates = await extractIngredientCandidates(html, {
    sourceUrl: siteHints.sourceUrl || "",
    sourceWebsite: siteHints.sourceWebsite || "",
    product: null
  });
  const ingredientsFromCandidates = candidates[0]?.rawExtractedIngredients || "";

  const headingTitle = extractHeadingTitle(html);
  const breadcrumbName = extractBreadcrumbName(html);
  const metaBrand = extractMetaBrand(html);
  const retailerBrand = extractRetailerBrand(html);
  const rawName = chooseReliableText([
    { value: jsonLd?.name, weight: 45 },
    { value: structured?.name, weight: 42 },
    { value: headingTitle, weight: 35 },
    { value: title, weight: 28 },
    { value: breadcrumbName, weight: 22 },
    { value: fallbackName, weight: 8 }
  ]) || fallbackName;
  const brandCandidates = [
    jsonLd?.brand,
    structured?.brand,
    retailerBrand,
    metaBrand,
    siteHints.brandHint
  ]
    .map((candidate) => cleanRetailerBrand(candidate || ""))
    .filter(Boolean);
  const brand = normalizeWhitespace(brandCandidates[0] || detectBrand(rawName, title, description));
  const category = detectCategory(rawName, description, siteHints.categoryHint || "");
  const normalizedName = normalizeProductName(rawName);
  const canonicalName = extractCoreProductName(rawName, { brand, category });
  const image = jsonLd?.image || structured?.image || extractHtmlImage(html);
  const ingredients = ingredientsFromCandidates || jsonLd?.ingredients || "";
  const sku = extractProductSku(structured?.sku, jsonLd?.sku, extractHtmlSku(html), siteHints.sourceUrl || "", html);

  return {
    name: normalizedName,
    canonicalName,
    brand,
    category,
    sku,
    image,
    description,
    ingredients,
    ingredientCandidates: candidates
  };
}


