const NOISE_PATTERNS = [
  /\bpack of \d+\b/gi,
  /\bcombo\b/gi,
  /\bbestseller\b/gi,
  /\blimited edition\b/gi,
  /\bnew\b/gi,
  /\b\d+\s?(ml|g|gm|kg|oz)\b/gi,
  /\|\s*[^|]+$/g,
  /\(([^)]*pack[^)]*)\)/gi
];

const CATEGORY_RULES = [
  { category: "Face Wash", keywords: ["face wash", "facewash", "cleanser", "facial cleanser"] },
  { category: "Face Cream", keywords: ["face cream", "night cream", "day cream"] },
  { category: "Moisturizer", keywords: ["moisturizer", "moisturiser", "lotion"] },
  { category: "Sunscreen", keywords: ["sunscreen", "sun screen", "spf"] },
  { category: "Serum", keywords: ["serum"] },
  { category: "Body Wash", keywords: ["body wash", "shower gel"] },
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
  "discover pilgrim"
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

export function normalizeWhitespace(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeProductName(value = "") {
  let result = normalizeWhitespace(value);

  for (const pattern of NOISE_PATTERNS) {
    result = result.replace(pattern, " ");
    result = normalizeWhitespace(result);
  }

  return result;
}

export function detectBrand(...candidates) {
  const normalizedCandidates = candidates
    .filter(Boolean)
    .map((candidate) => candidate.toLowerCase().replace(/[._/-]+/g, " "));

  for (const brand of KNOWN_BRANDS) {
    if (normalizedCandidates.some((candidate) => candidate.includes(brand))) {
      return brand
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
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

