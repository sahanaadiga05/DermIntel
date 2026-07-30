import vm from "node:vm";
import { createIngredientCandidate } from "./ingredient-candidate.js";

function cleanText(value = "") {
  return String(value)
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<\/(?:p|li|div|dd|tr)>/gi, ", ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const INGREDIENT_KEY_PATTERN = /(?:^|[_\-.])(?:full[_\-.]?)?(?:ingredients?|inci|composition|materials?)(?:$|[_\-.])/i;
const PARTIAL_KEY_PATTERN = /(?:key|hero|featured|active|highlight)[_\-.]?(?:ingredients?)?/i;

function serializeIngredientValue(value) {
  if (typeof value === "string" || typeof value === "number") {
    return cleanText(value);
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => {
        if (typeof entry === "string") return [cleanText(entry)];
        if (entry && typeof entry === "object") {
          const name = entry.name || entry.ingredient || entry.inci || entry.value || entry.label;
          return name ? [cleanText(name)] : [];
        }
        return [];
      })
      .filter(Boolean)
      .join(", ");
  }

  if (value && typeof value === "object") {
    return serializeIngredientValue(value.value || value.text || value.name || value.ingredients || value.inci || "");
  }

  return "";
}

function extractJsonScripts(html = "") {
  return html.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    try {
      return vm.runInNewContext(`(${value})`, Object.create(null), {
        timeout: 50
      });
    } catch (_vmError) {
      return null;
    }
  }
}

function flattenObject(value, path = [], bucket = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => flattenObject(entry, [...path, String(index)], bucket));
    return bucket;
  }

  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      bucket.push({
        key,
        path: [...path, key].join("."),
        value: entry
      });
      flattenObject(entry, [...path, key], bucket);
    }
  }

  return bucket;
}

function findIngredientValues(payload) {
  const flattened = flattenObject(payload);
  const results = [];

  for (const entry of flattened) {
    if (INGREDIENT_KEY_PATTERN.test(entry.key) && !PARTIAL_KEY_PATTERN.test(entry.key)) {
      const value = serializeIngredientValue(entry.value);
      if (value.length >= 12) results.push({ path: entry.path, value });
    }

    if (/^(?:name|label|title|key)$/i.test(entry.key) && /^(?:full\s+)?ingredients?(?:\s+list)?$|^inci$|^composition$/i.test(cleanText(entry.value))) {
      const parentPath = entry.path.split(".").slice(0, -1).join(".");
      const sibling = flattened.find((candidate) =>
        candidate.path.startsWith(`${parentPath}.`) &&
        /^(?:value|text|content|description|body|html)$/i.test(candidate.key)
      );
      const value = serializeIngredientValue(sibling?.value);
      if (value.length >= 12) results.push({ path: sibling.path, value });
    }

    if (/^(?:description|descriptionHtml|body_html|content|details)$/i.test(entry.key)) {
      const text = cleanText(entry.value);
      const match = text.match(/(?:full\s+)?ingredients?(?:\s+list)?\s*:?\s*([\s\S]{20,4000}?)(?=\b(?:directions?|how to use|warnings?|benefits?|reviews?)\b|$)/i);
      if (match?.[1]) results.push({ path: entry.path, value: cleanText(match[1]) });
    }
  }

  return [...new Map(results.map((entry) => [`${entry.path}:${entry.value}`, entry])).values()];
}

function findProductValues(payload) {
  const flattened = flattenObject(payload);
  const lookup = (patterns) => flattened.find((entry) => patterns.some((pattern) => pattern.test(entry.path) || pattern.test(entry.key)))?.value;

  const rawBrand = lookup([/brand$/i, /product\.brand$/i, /pageProps\.product\.brand$/i]);

  return {
    name: cleanText(lookup([/name$/i, /product\.name$/i, /pageProps\.product\.name$/i]) || ""),
    brand: typeof rawBrand === "string" ? cleanText(rawBrand) : cleanText(rawBrand?.name || ""),
    description: cleanText(lookup([/description$/i]) || ""),
    image: cleanText(lookup([/image$/i, /images\.0$/i]) || ""),
    sku: cleanText(lookup([/sku$/i, /itemCode$/i, /model$/i, /hsn$/i]) || "")
  };
}

function scoreProductData(productData = {}) {
  let score = 0;
  if (productData.name) score += 40;
  if (productData.brand) score += 28;
  if (productData.description) score += 16;
  if (productData.image) score += 8;
  if (productData.sku) score += 8;
  return score;
}

function normalizeJsonBlock(value = "") {
  return cleanText(value)
    .replace(/;\s*$/, "")
    .trim();
}

function extractNamedScriptBlocks(html = "") {
  const results = [];
  const patterns = [
    { name: "__NEXT_DATA__", regex: /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i },
    { name: "__INITIAL_STATE__", regex: /__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;?/i },
    { name: "__NUXT__", regex: /window\.__NUXT__\s*=\s*([\s\S]*?)<\/script>/i },
    { name: "__NUXT_DATA__", regex: /<script[^>]+id=["']__NUXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i },
    { name: "__PRELOADED_STATE__", regex: /__PRELOADED_STATE__\s*=\s*([\s\S]*?)(?:<\/script>|;)/i }
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern.regex);
    if (match?.[1]) {
      results.push({
        name: pattern.name,
        json: normalizeJsonBlock(match[1])
      });
    }
  }

  return results;
}

function extractMicrodataCandidates(html = "", { sourceUrl = "", sourceWebsite = "", product = null } = {}) {
  const candidates = [];
  const itemScopeMatch = html.match(/<[^>]+itemscope[^>]+itemtype=["'][^"']*Product[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  if (!itemScopeMatch?.[1]) {
    return candidates;
  }

  const scopeHtml = itemScopeMatch[1];
  const patterns = [
    /itemprop=["']ingredients?["'][^>]+content=["']([^"']+)["']/i,
    /itemprop=["']ingredients?["'][^>]*>([^<]{20,2000})<\/[^>]+>/i,
    /itemprop=["']material["'][^>]+content=["']([^"']+)["']/i,
    /itemprop=["']material["'][^>]*>([^<]{20,2000})<\/[^>]+>/i
  ];

  for (const pattern of patterns) {
    const match = scopeHtml.match(pattern);
    if (match?.[1]) {
      candidates.push(
        createIngredientCandidate({
          sourceUrl,
          sourceWebsite,
          stage: "structured-data",
          extractionMethod: "microdata",
          ingredientSource: "microdata",
          rawExtractedIngredients: cleanText(match[1]),
          metadata: {
            sourceBlock: "microdata"
          },
          product
        })
      );
    }
  }

  return candidates;
}

export function extractStructuredIngredientCandidates({ html = "", sourceUrl = "", sourceWebsite = "", product = null }) {
  const candidates = [];
  const seen = new Set();

  for (const block of extractNamedScriptBlocks(html)) {
    const payload = safeJsonParse(block.json);
    if (!payload) {
      continue;
    }

    for (const hit of findIngredientValues(payload)) {
      const key = `${block.name}:${hit.path}:${hit.value}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      candidates.push(
        createIngredientCandidate({
          sourceUrl,
          sourceWebsite,
          stage: "structured-data",
          extractionMethod: block.name.toLowerCase(),
          ingredientSource: block.name,
          rawExtractedIngredients: hit.value,
          metadata: {
            dataPath: hit.path,
            sourceBlock: block.name,
            structuredProduct: findProductValues(payload)
          },
          product
        })
      );
    }
  }

  for (const scriptBlock of extractJsonScripts(html)) {
    const contentMatch = scriptBlock.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    const payload = safeJsonParse(contentMatch?.[1] || "");
    if (!payload) {
      continue;
    }

    for (const hit of findIngredientValues(payload)) {
      const key = `embedded-json:${hit.path}:${hit.value}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      candidates.push(
        createIngredientCandidate({
          sourceUrl,
          sourceWebsite,
          stage: "structured-data",
          extractionMethod: "embedded-product-json",
          ingredientSource: "embedded-json",
          rawExtractedIngredients: hit.value,
          metadata: {
            dataPath: hit.path,
            sourceBlock: "embedded-json",
            structuredProduct: findProductValues(payload)
          },
          product
        })
      );
    }
  }

  for (const candidate of extractMicrodataCandidates(html, { sourceUrl, sourceWebsite, product })) {
    const key = `${candidate.extractionMethod}:${candidate.rawExtractedIngredients}`;
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(candidate);
    }
  }

  return candidates;
}

export function extractStructuredProductData(html = "") {
  const productBlocks = [];

  for (const block of extractNamedScriptBlocks(html)) {
    const payload = safeJsonParse(block.json);
    if (!payload) {
      continue;
    }

    const productData = findProductValues(payload);
    const score = scoreProductData(productData);
    if (score > 0) {
      productBlocks.push({
        ...productData,
        sourceBlock: block.name,
        reliabilityScore: score + 8
      });
    }
  }

  for (const scriptBlock of extractJsonScripts(html)) {
    const contentMatch = scriptBlock.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    const payload = safeJsonParse(contentMatch?.[1] || "");
    if (!payload) {
      continue;
    }

    const productData = findProductValues(payload);
    const score = scoreProductData(productData);
    if (score > 0) {
      productBlocks.push({
        ...productData,
        sourceBlock: "embedded-json",
        reliabilityScore: score
      });
    }
  }

  return productBlocks
    .sort((left, right) => right.reliabilityScore - left.reliabilityScore)[0] || null;
}


