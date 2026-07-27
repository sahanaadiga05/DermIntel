import { createHash } from "node:crypto";
import {
  extractCoreProductName,
  extractProductSize,
  extractProductVariant,
  normalizeProductName,
  normalizeWhitespace
} from "../product-normalizer.js";

function normalizeKeyPart(value = "") {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[™®©]/g, "")
    .replace(/\bpack of \d+\b/gi, " ")
    .replace(/\b\d+(?:\.\d+)?\s?(?:ml|g|gm|kg|oz|fl oz|l|pcs|pc|count)\b/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractStableVariant(value = "", { brand = "", category = "" } = {}) {
  const detected = normalizeProductName(extractProductVariant(value, { brand, category }));
  if (detected) {
    return detected;
  }

  const match = normalizeProductName(value).match(
    /(\d+(?:\.\d+)?%\s+[a-z0-9 +&-]{2,80}?)(?=\b(?:face wash|face cleanser|cleanser|serum|cream|moisturizer|moisturiser|sunscreen|lotion|shampoo|conditioner)\b|$)/i
  );

  return normalizeProductName(match?.[1] || "");
}

export function createProductFingerprint(product = {}) {
  const brand = normalizeProductName(product.brand || "");
  const category = normalizeProductName(product.category || "Product");
  const sourceName = normalizeProductName(product.name || "");
  const description = normalizeWhitespace(product.description || "");
  const size = normalizeProductName(product.size || extractProductSize(`${sourceName} ${description}`));
  const variant = normalizeProductName(
    product.variant || extractStableVariant(`${sourceName} ${description}`, { brand, category })
  );
  const canonicalName = normalizeProductName(
    product.canonicalName || extractCoreProductName(sourceName, { brand, category }) || sourceName
  );

  const normalized = {
    brand: normalizeKeyPart(brand),
    canonicalName: normalizeKeyPart(canonicalName),
    variant: normalizeKeyPart(variant),
    category: normalizeKeyPart(category),
    size: normalizeKeyPart(size)
  };

  const identity = JSON.stringify(normalized);
  const fingerprint = createHash("sha256").update(identity).digest("hex");

  return {
    fingerprint,
    fingerprintKey: fingerprint,
    label: [brand, canonicalName, variant, category, size].filter(Boolean).join(" | "),
    brand,
    canonicalName,
    variant,
    category,
    size,
    normalized
  };
}
