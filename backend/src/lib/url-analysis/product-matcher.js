import Fuse from "fuse.js";
import {
  detectBrand,
  detectCategory,
  extractProductSize,
  extractProductVariant,
  normalizeProductName,
  normalizeWhitespace
} from "../product-normalizer.js";

const ACCEPTANCE_THRESHOLD = 85;
const REVIEW_THRESHOLD = 70;
const SIZE_PATTERN = /\b\d+(?:\.\d+)?\s?(?:ml|g|gm|kg|oz|fl oz|l|pcs|pc|count)\b/gi;
const MARKETING_PATTERNS = [
  /\bbest seller\b/gi,
  /\bbestseller\b/gi,
  /\bnew\b/gi,
  /\bsale\b/gi,
  /\boffer\b/gi,
  /\bdiscount\b/gi,
  /\blimited edition\b/gi,
  /\bcontrols oil\b/gi,
  /\bdermatologically tested\b/gi,
  /\bclinically proven\b/gi,
  /\bbrightens skin\b/gi,
  /\bhydrating formula\b/gi,
  /\bprevents acne\b/gi,
  /\bfades acne marks\b/gi,
  /\bfor all skin types\b/gi,
  /\bwith pump\b/gi
];

const FIELD_WEIGHTS = {
  brand: 40,
  productType: 25,
  activeIngredients: 20,
  skinConcerns: 10,
  variant: 5
};

const CATEGORY_SYNONYMS = new Map([
  ["face wash", "Face Wash"],
  ["face cleanser", "Face Wash"],
  ["facial cleanser", "Face Wash"],
  ["cleanser", "Face Wash"],
  ["gentle skin cleanser", "Face Wash"],
  ["face cream", "Face Cream"],
  ["day cream", "Face Cream"],
  ["night cream", "Face Cream"],
  ["moisturizer", "Moisturizer"],
  ["moisturiser", "Moisturizer"],
  ["lotion", "Moisturizer"],
  ["body lotion", "Body Lotion"],
  ["body cream", "Body Lotion"],
  ["body wash", "Body Wash"],
  ["soap bar", "Body Wash"],
  ["beauty bar", "Body Wash"],
  ["soap", "Body Wash"],
  ["sunscreen", "Sunscreen"],
  ["sun screen", "Sunscreen"],
  ["spf", "Sunscreen"],
  ["serum", "Serum"],
  ["shampoo", "Shampoo"],
  ["conditioner", "Conditioner"],
  ["hair serum", "Hair Serum"],
  ["hair oil", "Hair Serum"]
]);

const ACTIVE_RULES = [
  { canonical: "salicylic acid", patterns: [/\bsalicylic acid\b/i, /\b(?:2%|1%|0\.5%)\s*salicylic\b/i, /\bbha\b/i] },
  { canonical: "niacinamide", patterns: [/\bniacinamide\b/i, /\bvitamin b3\b/i] },
  { canonical: "panthenol", patterns: [/\bpanthenol\b/i, /\bvitamin b5\b/i] },
  { canonical: "hyaluronic acid", patterns: [/\bhyaluronic acid\b/i, /\bha\b/i, /\bsodium hyaluronate\b/i] },
  { canonical: "tocopherol", patterns: [/\btocopherol\b/i, /\bvitamin e\b/i] },
  { canonical: "centella asiatica extract", patterns: [/\bcentella asiatica\b/i, /\bcica\b/i] },
  { canonical: "zinc pca", patterns: [/\bzinc pca\b/i, /\bzinc\b/i] },
  { canonical: "ceramides", patterns: [/\bceramide(?:s)?\b/i] },
  { canonical: "vitamin c", patterns: [/\bvitamin c\b/i, /\bascorbic acid\b/i, /\bethyl ascorbic acid\b/i] },
  { canonical: "retinol", patterns: [/\bretinol\b/i, /\bgranactive retinoid\b/i] },
  { canonical: "glycolic acid", patterns: [/\bglycolic acid\b/i] },
  { canonical: "lactic acid", patterns: [/\blactic acid\b/i] },
  { canonical: "tea tree", patterns: [/\btea tree\b/i] }
];

const CONCERN_RULES = [
  { canonical: "acne", patterns: [/\bacne\b/i, /\bacne prone\b/i, /\bbreakout(?:s)?\b/i] },
  { canonical: "oily skin", patterns: [/\boily skin\b/i, /\boil control\b/i, /\bcontrols oil\b/i, /\bexcess oil\b/i, /\boil balancing\b/i] },
  { canonical: "post acne marks", patterns: [/\bacne marks\b/i, /\bpost acne marks\b/i, /\bpost-acne marks\b/i] },
  { canonical: "pigmentation", patterns: [/\bpigmentation\b/i, /\bdark spots?\b/i, /\buneven skin tone\b/i] },
  { canonical: "dry skin", patterns: [/\bdry skin\b/i, /\bdry to normal\b/i, /\bdryness\b/i, /\bhydration\b/i, /\bhydrating\b/i] },
  { canonical: "normal skin", patterns: [/\bnormal skin\b/i, /\bdry to normal\b/i] },
  { canonical: "sensitive skin", patterns: [/\bsensitive skin\b/i, /\bsensitivity\b/i, /\bredness\b/i, /\bgentle\b/i] },
  { canonical: "barrier repair", patterns: [/\bbarrier repair\b/i, /\bskin barrier\b/i] },
  { canonical: "anti-aging", patterns: [/\banti[- ]aging\b/i, /\bwrinkles?\b/i, /\bfine lines?\b/i] }
];

function decodeHtmlEntities(value = "") {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/â€“/g, "-")
    .replace(/â€”/g, "-")
    .replace(/â€&trade;/g, "\"");
}

function stripNoise(value = "") {
  let normalized = decodeHtmlEntities(normalizeProductName(value))
    .replace(SIZE_PATTERN, " ")
    .replace(/[|_/,:;()[\]{}]+/g, " ")
    .replace(/[+]+/g, " + ")
    .replace(/[^\w\s%&.+-]+/g, " ");

  for (const pattern of MARKETING_PATTERNS) {
    normalized = normalized.replace(pattern, " ");
  }

  return normalizeWhitespace(normalized);
}

function canonicalizeBrand(value = "") {
  return detectBrand(value) || normalizeWhitespace(value);
}

function canonicalizeProductType(value = "", fallbackText = "") {
  const direct = CATEGORY_SYNONYMS.get(value.toLowerCase());
  if (direct) {
    return direct;
  }

  const detected = detectCategory(value, fallbackText);
  if (detected && detected !== "Product") {
    return detected;
  }

  const combined = `${value} ${fallbackText}`.toLowerCase();
  for (const [phrase, category] of CATEGORY_SYNONYMS.entries()) {
    if (combined.includes(phrase)) {
      return category;
    }
  }

  return "";
}

function extractCanonicalTokens(text = "", rules = []) {
  const normalized = stripNoise(text).toLowerCase();
  const matches = new Set();

  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      matches.add(rule.canonical);
    }
  }

  return [...matches];
}

function normalizeVariantText(value = "", { brand = "", productType = "" } = {}) {
  if (!value) {
    return "";
  }

  let normalized = stripNoise(value);

  if (brand) {
    normalized = normalized.replace(new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"), " ");
  }

  if (productType) {
    normalized = normalized.replace(new RegExp(`\\b${productType.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"), " ");
  }

  return normalizeWhitespace(normalized);
}

function createFuse(items = []) {
  return new Fuse(items.map((value) => ({ value })), {
    includeScore: true,
    keys: ["value"],
    threshold: 0.35,
    shouldSort: true,
    minMatchCharLength: 2
  });
}

function fuzzyStringSimilarity(left = "", right = "") {
  if (!left || !right) {
    return 0;
  }

  if (left.toLowerCase() === right.toLowerCase()) {
    return 1;
  }

  const results = createFuse([right]).search(left);
  if (!results.length) {
    return 0;
  }

  return Math.max(0, 1 - (results[0].score ?? 1));
}

function fuzzyArraySimilarity(expected = [], actual = []) {
  if (!expected.length) {
    return null;
  }

  if (!actual.length) {
    return 0;
  }

  const fuse = createFuse(actual);
  const scores = expected.map((value) => {
    if (actual.includes(value)) {
      return 1;
    }

    const result = fuse.search(value)[0];
    return result ? Math.max(0, 1 - (result.score ?? 1)) : 0;
  });

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function extractProductProfile(product = {}) {
  const name = product.name || "";
  const description = product.description || "";
  const url = product.url || "";
  const category = product.category || "";
  const brandHint = product.brand || "";
  const combinedText = [name, description, url].filter(Boolean).join(" ");
  const normalizedText = stripNoise(combinedText);
  const brand = canonicalizeBrand(brandHint || combinedText);
  const productType = canonicalizeProductType(category || name, combinedText);
  const variant = normalizeVariantText(
    extractProductVariant(combinedText, { brand, category: productType }) || "",
    { brand, productType }
  );

  return {
    originalName: name,
    normalizedTitle: normalizedText,
    brand,
    productType,
    activeIngredients: extractCanonicalTokens(combinedText, ACTIVE_RULES),
    skinConcerns: extractCanonicalTokens(combinedText, CONCERN_RULES),
    variant,
    packSize: extractProductSize(combinedText)
  };
}

function toPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

export function matchProducts(sourceProduct = {}, candidateProduct = {}) {
  const expected = extractProductProfile(sourceProduct);
  const actual = extractProductProfile(candidateProduct);

  const brandSimilarity = expected.brand ? fuzzyStringSimilarity(expected.brand, actual.brand) : null;
  const typeSimilarity = expected.productType ? fuzzyStringSimilarity(expected.productType, actual.productType) : null;
  const activeSimilarity = fuzzyArraySimilarity(expected.activeIngredients, actual.activeIngredients);
  const concernSimilarity = fuzzyArraySimilarity(expected.skinConcerns, actual.skinConcerns);
  const variantSimilarity = expected.variant ? fuzzyStringSimilarity(expected.variant, actual.variant) : null;

  const components = [
    ["brand", brandSimilarity],
    ["productType", typeSimilarity],
    ["activeIngredients", activeSimilarity],
    ["skinConcerns", concernSimilarity],
    ["variant", variantSimilarity]
  ].map(([field, similarity]) => {
    const weight = FIELD_WEIGHTS[field];
    const applicable = similarity !== null;
    return {
      field,
      weight,
      applicable,
      similarity: applicable ? similarity : null,
      points: applicable ? Number((weight * similarity).toFixed(2)) : 0
    };
  });

  const applicableWeight = components
    .filter((component) => component.applicable)
    .reduce((sum, component) => sum + component.weight, 0);
  const earnedPoints = components.reduce((sum, component) => sum + component.points, 0);
  const finalScore = applicableWeight > 0 ? Math.round((earnedPoints / applicableWeight) * 100) : 0;
  const accepted = finalScore >= ACCEPTANCE_THRESHOLD;
  const shouldContinue = !accepted && finalScore >= REVIEW_THRESHOLD;

  const breakdown = {
    brand: toPercent(brandSimilarity ?? 0),
    productType: toPercent(typeSimilarity ?? 0),
    activeIngredients: activeSimilarity === null ? null : toPercent(activeSimilarity),
    skinConcerns: concernSimilarity === null ? null : toPercent(concernSimilarity),
    variant: variantSimilarity === null ? null : toPercent(variantSimilarity)
  };

  return {
    accepted,
    shouldContinue,
    finalScore,
    thresholds: {
      acceptance: ACCEPTANCE_THRESHOLD,
      review: REVIEW_THRESHOLD
    },
    components,
    breakdown,
    expected,
    actual,
    summary: [
      `Brand Match ${breakdown.brand}%`,
      `Product Type Match ${breakdown.productType}%`,
      breakdown.activeIngredients === null ? "Active Ingredient Match N/A" : `Active Ingredient Match ${breakdown.activeIngredients}%`,
      breakdown.skinConcerns === null ? "Skin Concern Match N/A" : `Skin Concern Match ${breakdown.skinConcerns}%`,
      breakdown.variant === null ? "Variant Match N/A" : `Variant Match ${breakdown.variant}%`,
      `Final Similarity ${finalScore}%`
    ].join(" | ")
  };
}
