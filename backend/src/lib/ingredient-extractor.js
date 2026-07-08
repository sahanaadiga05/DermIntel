import {
  detectBrand,
  detectCategory,
  normalizeIngredientList,
  normalizeProductName,
  normalizeWhitespace
} from "./product-normalizer.js";

function decodeHtml(value = "") {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
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
        brand:
          typeof productNode.brand === "string"
            ? productNode.brand
            : productNode.brand?.name || "",
        image: Array.isArray(productNode.image) ? productNode.image[0] : productNode.image || "",
        description: normalizeWhitespace(productNode.description || ""),
        ingredients:
          normalizeIngredientList(productNode.ingredients || productNode.material || productNode.additionalProperty?.value || "")
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

function extractHtmlImage(html = "") {
  return (
    extractMetaContent(html, "og:image") ||
    extractMetaContent(html, "twitter:image") ||
    ""
  );
}

function extractDescription(html = "") {
  return (
    extractMetaContent(html, "og:description") ||
    extractMetaContent(html, "description") ||
    ""
  );
}

function cleanIngredientSection(value = "") {
  return normalizeIngredientList(
    value
      .split(/(?:directions|how to use|benefits|description|about this item|usage|warnings|manufacturer)/i)[0]
      .trim()
  );
}

export function extractIngredientsText(html = "") {
  const text = stripHtml(html);
  const patterns = [
    /ingredients?\s*[:\-]\s*([a-z0-9(),.%/+\-\s]{30,1800})/i,
    /full ingredients?\s*[:\-]?\s*([a-z0-9(),.%/+\-\s]{30,1800})/i,
    /inci\s*[:\-]?\s*([a-z0-9(),.%/+\-\s]{30,1800})/i,
    /composition\s*[:\-]?\s*([a-z0-9(),.%/+\-\s]{30,1800})/i,
    /key ingredients?\s*[:\-]?\s*([a-z0-9(),.%/+\-\s]{30,1800})/i,
    /product details\s*[:\-]?\s*([a-z0-9(),.%/+\-\s]{30,1800})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (match?.[1]) {
      const cleaned = cleanIngredientSection(match[1]);

      if (cleaned.split(",").length >= 3) {
        return cleaned;
      }
    }
  }

  return "";
}

export function extractProductInfo(html = "", fallbackName = "", siteHints = {}) {
  const jsonLd = extractJsonLdProduct(html);
  const title = extractTitle(html, fallbackName);
  const description = extractDescription(html);
  const ingredientsFromHtml = extractIngredientsText(html);

  const name = normalizeProductName(jsonLd?.name || title || fallbackName);
  const brand = jsonLd?.brand || detectBrand(name, description, siteHints.brandHint || "");
  const category = detectCategory(name, description, siteHints.categoryHint || "");
  const image = jsonLd?.image || extractHtmlImage(html);
  const ingredients = jsonLd?.ingredients || ingredientsFromHtml;

  return {
    name,
    brand,
    category,
    image,
    description,
    ingredients
  };
}

