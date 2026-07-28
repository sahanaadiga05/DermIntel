const NOISE_PATTERNS = [
  /\bpack of \d+\b/gi,
  /\bcombo\b/gi,
  /\bfree gift\b/gi,
  /\bfreebie\b/gi,
  /\btrial pack\b/gi,
  /\bbest seller\b/gi,
  /\bbestseller\b/gi,
  /\blimited edition\b/gi,
  /\bnew\b/gi,
  /\btrending\b/gi,
  /\bviral\b/gi,
  /\bmust have\b/gi,
  /\bworth the hype\b/gi,
  /\|\s*[^|]+$/g,
  /\(([^)]*pack[^)]*)\)/gi
];

const MARKETING_SPLIT_PATTERNS = [
  /\bbrightens skin\b/i,
  /\bfor bright skin\b/i,
  /\bhelps fade blemishes\b/i,
  /\bsoftens(?:\s*&|\s+and)?\s*smoothens skin\b/i,
  /\bsmoothens skin\b/i,
  /\bdeep(?:ly)? cleans(?:es|ing)?\b/i,
  /\bcontrols? oil\b/i,
  /\bprevents? acne\b/i,
  /\bfades? acne marks\b/i,
  /\bhelps reduce blemishes\b/i,
  /\bhelps reduce dark spots\b/i,
  /\bboosts? glow\b/i,
  /\bgives? glowing skin\b/i,
  /\bfor glowing skin\b/i,
  /\bfor radiant skin\b/i,
  /\bfor oily skin\b/i,
  /\bsuitable for all skin types\b/i,
  /\bdermatologically tested\b/i,
  /\bwith\s+[a-z0-9 +&%-]{3,40}$/i
];

const SIZE_PATTERN = /\b\d+(?:\.\d+)?\s?(?:ml|g|gm|kg|oz|fl oz|l)\b/gi;
const SKU_PATTERNS = [
  /\bsku\s*[:#-]?\s*([a-z0-9-]{4,})\b/i,
  /\bitem\s*code\s*[:#-]?\s*([a-z0-9-]{4,})\b/i,
  /\bmodel\s*[:#-]?\s*([a-z0-9-]{4,})\b/i,
  /\bhsn\s*[:#-]?\s*([a-z0-9-]{4,})\b/i
];

const CATEGORY_RULES = [
  { category: "Face Wash", keywords: ["face wash", "facewash", "cleanser", "facial cleanser"] },
  { category: "Face Cream", keywords: ["face cream", "night cream", "day cream"] },
  { category: "Moisturizer", keywords: ["moisturizer", "moisturiser", "lotion"] },
  { category: "Sunscreen", keywords: ["sunscreen", "sun screen", "spf"] },
  { category: "Serum", keywords: ["serum"] },
  { category: "Body Wash", keywords: ["body wash", "shower gel", "beauty bar", "soap bar", "soap"] },
  { category: "Body Lotion", keywords: ["body lotion", "body cream"] },
  { category: "Shampoo", keywords: ["shampoo"] },
  { category: "Conditioner", keywords: ["conditioner"] },
  { category: "Hair Serum", keywords: ["hair serum", "hair oil"] }
];

const KNOWN_BRANDS = [
  "cetaphil",
  "cerave",
  "minimalist",
  "the ordinary",
  "dot & key",
  "dot and key",
  "plum",
  "nykaa",
  "loreal",
  "la roche posay",
  "pilgrim",
  "discover pilgrim",
  "chemist at play",
  "chemistatplay",
  "the derma co",
  "derma co",
  "dove"
];

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "face",
  "skin",
  "care",
  "cream",
  "serum",
  "wash",
  "cleanser",
  "moisturizer",
  "moisturiser",
  "lotion",
  "spf",
  "shampoo",
  "conditioner",
  "product",
  "ml",
  "g"
]);

function escapeRegExp(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeWhitespace(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeProductName(value = "") {
  let result = normalizeWhitespace(value);

  for (const pattern of NOISE_PATTERNS) {
    result = result.replace(pattern, " ");
    result = normalizeWhitespace(result);
  }

  for (const pattern of MARKETING_SPLIT_PATTERNS) {
    result = result.replace(pattern, " ");
    result = normalizeWhitespace(result);
  }

  result = result
    .replace(/[|:]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return result;
}

export function extractProductSku(...candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    const normalizedCandidate = normalizeWhitespace(String(candidate));

    for (const pattern of SKU_PATTERNS) {
      const match = normalizedCandidate.match(pattern);
      if (match?.[1]) {
        return normalizeWhitespace(match[1].toUpperCase());
      }
    }

    if (/^[A-Z0-9-]{4,}$/i.test(normalizedCandidate)) {
      return normalizedCandidate.toUpperCase();
    }
  }

  return "";
}

function formatKnownBrand(brand = "") {
  return brand
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getBrandsBySpecificity() {
  return [...KNOWN_BRANDS].sort((left, right) => right.length - left.length);
}

export function detectBrand(...candidates) {
  const normalizedCandidates = candidates
    .filter(Boolean)
    .map((candidate) => candidate.toLowerCase().replace(/[._/-]+/g, " "));

  for (const candidate of normalizedCandidates) {
    for (const brand of getBrandsBySpecificity()) {
      if (candidate.includes(brand)) {
        return formatKnownBrand(brand);
      }
    }
  }

  return "";
}

export function detectCategory(...candidates) {
  const combined = candidates.join(" ").toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => combined.includes(keyword))) {
      return rule.category;
    }
  }

  return "Product";
}

export function extractProductSize(value = "") {
  const matches = normalizeProductName(value).match(SIZE_PATTERN);
  return matches?.[matches.length - 1] || "";
}

export function extractProductVariant(value = "", { brand = "", category = "" } = {}) {
  const normalized = normalizeWhitespace(value);
  const size = extractProductSize(normalized);
  let working = normalized;

  if (brand) {
    working = working.replace(new RegExp(`^${escapeRegExp(brand)}\\s*`, "i"), "");
  }

  if (size) {
    working = working.replace(new RegExp(`\\b${escapeRegExp(size)}\\b`, "i"), " ");
  }

  const categoryKeywords = CATEGORY_RULES.find((rule) => rule.category === category)?.keywords || [];
  for (const keyword of categoryKeywords) {
    working = working.replace(new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i"), keyword);
  }

  const variantPatterns = [
    /((?:\d+(?:\.\d+)?%\s*[a-z0-9 +&-]+)(?:\s*\+\s*[a-z0-9 +&-]+)+)/i,
    /((?:with|infused with)\s+[a-z0-9 +&%,-]+)/i,
    /((?:fragrance free|soap free|sulfate free|paraben free)[a-z0-9 +&%,-]*)/i,
    /(\([^)]*(?:%|acid|niacinamide|ceramide|vitamin|cica|hyaluronic)[^)]*\))/i
  ];

  for (const pattern of variantPatterns) {
    const match = working.match(pattern);
    if (match?.[1]) {
      return normalizeWhitespace(match[1].replace(/^\(|\)$/g, ""));
    }
  }

  return "";
}

export function extractCoreProductName(value = "", { brand = "", category = "" } = {}) {
  const normalized = normalizeWhitespace(value);
  const size = extractProductSize(normalized);
  const variant = extractProductVariant(normalized, { brand, category });
  let working = normalized;

  if (brand) {
    working = working.replace(new RegExp(`^${escapeRegExp(brand)}\\s*`, "i"), "");
  }

  if (size) {
    working = working.replace(new RegExp(`\\b${escapeRegExp(size)}\\b`, "i"), " ");
  }

  if (variant) {
    working = working.replace(new RegExp(escapeRegExp(variant), "i"), " ");
  }

  working = working
    .replace(/[|:]+/g, " ")
    .replace(/\(\s*\)/g, " ")
    .replace(/\b(?:brightens|softens|smoothens|controls|prevents|fades|boosts)\b.*$/i, " ")
    .replace(/\b(?:for|with)\s+(?:all\s+skin\s+types|daily\s+use|men|women)\b/gi, " ");

  working = normalizeWhitespace(working);
  return working || normalized;
}

export function slugToTitle(slug = "") {
  return normalizeWhitespace(
    slug
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/[|/]/g, " ")
  )
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function normalizeIngredientList(value = "") {
  return normalizeWhitespace(
    value
      .replace(/ingredients?\s*:/i, "")
      .replace(/full ingredients?\s*:/i, "")
      .replace(/inci\s*:/i, "")
      .replace(/\s*,\s*/g, ", ")
  );
}

export function tokenizeProductName(value = "") {
  return normalizeProductName(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token && !STOP_WORDS.has(token) && token.length > 1);
}

