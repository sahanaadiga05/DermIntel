import { productCatalog } from "../data/mock-data.js";
import { downloadWebpage } from "./html-fetcher.js";
import { extractProductInfo } from "./ingredient-extractor.js";
import { tokenizeProductName } from "./product-normalizer.js";

const BRAND_DOMAINS = {
  Cetaphil: ["cetaphil.com"],
  CeraVe: ["cerave.com"],
  Minimalist: ["beminimalist.co"],
  "The Ordinary": ["theordinary.com"],
  "Dot & Key": ["dotandkey.com"],
  Plum: ["plumgoodness.com"],
  Pilgrim: ["discoverpilgrim.com"]
};

function normalize(value = "") {
  return value.trim().toLowerCase();
}

function hasStrongNameOverlap(nameA = "", nameB = "") {
  const tokensA = tokenizeProductName(nameA);
  const tokensB = tokenizeProductName(nameB);

  if (!tokensA.length || !tokensB.length) {
    return false;
  }

  const overlap = tokensA.filter((token) => tokensB.includes(token));
  return overlap.length >= 2;
}

function findCatalogMatch({ name = "", brand = "", category = "" }) {
  const normalizedName = normalize(name);
  const normalizedBrand = normalize(brand);
  const normalizedCategory = normalize(category);

  return (
    productCatalog.find(
      (product) =>
        normalize(product.name) === normalizedName &&
        (!normalizedBrand || normalize(product.brand) === normalizedBrand)
    ) ||
    productCatalog.find((product) => {
      const brandMatches = normalizedBrand && normalize(product.brand) === normalizedBrand;
      const categoryMatches = !normalizedCategory || normalize(product.category) === normalizedCategory;
      return brandMatches && categoryMatches && hasStrongNameOverlap(product.name, name);
    }) ||
    null
  );
}

export async function searchOfficialWebsite(productInfo) {
  const exactCatalog = findCatalogMatch(productInfo);

  if (exactCatalog) {
    return {
      source: "official-site-catalog-fallback",
      matchedProduct: exactCatalog,
      ingredientsText: exactCatalog.ingredientsText,
      url: null
    };
  }

  const domains = BRAND_DOMAINS[productInfo.brand] || [];

  for (const domain of domains) {
    const searchUrl = `https://${domain}`;
    const downloaded = await downloadWebpage(searchUrl);

    if (!downloaded.ok) {
      continue;
    }

    const extracted = extractProductInfo(downloaded.html, productInfo.name, {
      brandHint: productInfo.brand,
      categoryHint: productInfo.category
    });

    if (extracted.ingredients && extracted.name) {
      return {
        source: "official-website",
        matchedProduct: null,
        ingredientsText: extracted.ingredients,
        url: searchUrl,
        product: extracted
      };
    }
  }

  return null;
}

