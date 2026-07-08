import { productCatalog } from "../data/mock-data.js";
import {
  getCachedProductResolution,
  getCachedUrlResolution,
  setCachedProductResolution,
  setCachedUrlResolution
} from "./cache-manager.js";
import { downloadWebpage } from "./html-fetcher.js";
import { searchOfficialWebsite } from "./official-website-search.js";
import {
  detectBrand,
  normalizeProductName,
  slugToTitle,
  tokenizeProductName
} from "./product-normalizer.js";
import { amazonScraper } from "../scrapers/amazonScraper.js";
import { brandWebsiteScraper } from "../scrapers/brandWebsiteScraper.js";
import { flipkartScraper } from "../scrapers/flipkartScraper.js";
import { genericScraper } from "../scrapers/genericScraper.js";
import { myntraScraper } from "../scrapers/myntraScraper.js";
import { nykaaScraper } from "../scrapers/nykaaScraper.js";
import { purplleScraper } from "../scrapers/purplleScraper.js";
import { tiraScraper } from "../scrapers/tiraScraper.js";

const SCRAPERS = [
  amazonScraper,
  flipkartScraper,
  myntraScraper,
  nykaaScraper,
  purplleScraper,
  tiraScraper,
  brandWebsiteScraper
];

const SEARCH_ENGINE_HOSTS = [
  "google.",
  "bing.",
  "search.yahoo.",
  "duckduckgo.",
  "yandex."
];

function normalize(value = "") {
  return value.trim().toLowerCase();
}

function isSearchEngineUrl(parsedUrl) {
  const host = parsedUrl.hostname.toLowerCase();
  const path = parsedUrl.pathname.toLowerCase();

  if (!SEARCH_ENGINE_HOSTS.some((pattern) => host.includes(pattern))) {
    return false;
  }

  return path.startsWith("/search") || path === "/" || parsedUrl.searchParams.has("q");
}

function findScraper(hostname) {
  return SCRAPERS.find((scraper) => scraper.canHandle(hostname)) || genericScraper;
}

function computeNameConfidence(candidateName, catalogProduct) {
  const inputTokens = tokenizeProductName(candidateName);
  const productTokens = tokenizeProductName(catalogProduct.name);

  if (!inputTokens.length || !productTokens.length) {
    return 0;
  }

  const overlap = inputTokens.filter((token) => productTokens.includes(token));
  return overlap.length / Math.max(inputTokens.length, productTokens.length);
}

function findLocalDatabaseMatch(productInfo) {
  const productKey = `${normalize(productInfo.brand)}|${normalize(productInfo.name)}|${normalize(productInfo.category)}`;
  const cached = getCachedProductResolution(productKey);

  if (cached) {
    return { ...cached, cacheHit: true };
  }

  const normalizedBrand = normalize(productInfo.brand);
  const normalizedCategory = normalize(productInfo.category);
  const normalizedName = normalize(productInfo.name);

  let bestMatch = null;
  let bestConfidence = 0;

  for (const product of productCatalog) {
    const productBrand = normalize(product.brand);
    const productCategory = normalize(product.category);

    if (normalizedBrand && productBrand !== normalizedBrand) {
      continue;
    }

    if (normalizedName && normalize(product.name) === normalizedName) {
      const value = {
        matchedProduct: product,
        ingredientsText: product.ingredientsText,
        source: "local-database"
      };
      setCachedProductResolution(productKey, value);
      return value;
    }

    const nameConfidence = computeNameConfidence(productInfo.name, product);
    let totalConfidence = nameConfidence;

    if (normalizedCategory && productCategory === normalizedCategory) {
      totalConfidence += 0.1;
    }

    if (totalConfidence > bestConfidence) {
      bestConfidence = totalConfidence;
      bestMatch = product;
    }
  }

  if (!bestMatch) {
    return null;
  }

  const minimumConfidence = normalizedBrand ? 0.35 : 0.6;
  if (bestConfidence < minimumConfidence) {
    return null;
  }

  const value = {
    matchedProduct: bestMatch,
    ingredientsText: bestMatch.ingredientsText,
    source: "local-database"
  };
  setCachedProductResolution(productKey, value);
  return value;
}

function createStep(label, state, details = "") {
  return { label, state, details };
}

export async function processProductUrl(inputUrl) {
  const processingTrace = [];

  let parsedUrl;
  try {
    parsedUrl = new URL(inputUrl);
    processingTrace.push(createStep("Validating URL", "completed", "Valid URL received."));
  } catch (_error) {
    processingTrace.push(
      createStep("Validating URL", "failed", "The pasted text is not a valid URL.")
    );
    const error = new Error("Please paste a valid product URL.");
    error.statusCode = 400;
    error.details = { processingTrace };
    throw error;
  }

  if (isSearchEngineUrl(parsedUrl)) {
    processingTrace.push(
      createStep(
        "Validating URL",
        "failed",
        "Search-result pages are not product pages."
      )
    );
    const error = new Error(
      "Please paste the actual Dove product page URL, not a Google or search-results link."
    );
    error.statusCode = 400;
    error.details = { processingTrace };
    throw error;
  }

  const cached = getCachedUrlResolution(parsedUrl.toString());
  if (cached) {
    return {
      ...cached,
      cacheHit: true,
      processingTrace: [
        createStep("Validating URL", "completed", "Valid URL received."),
        createStep("Cache lookup", "completed", "Returning cached URL analysis.")
      ]
    };
  }

  const scraper = findScraper(parsedUrl.hostname);
  const fallbackName = slugToTitle(parsedUrl.pathname.split("/").filter(Boolean).pop() || "");
  let product = {
    name: normalizeProductName(fallbackName || "Linked Product"),
    brand: detectBrand(fallbackName, parsedUrl.hostname),
    category: "Product",
    image: "",
    description: ""
  };
  let extractedIngredients = "";

  processingTrace.push(
    createStep("Downloading webpage", "in_progress", `Using ${scraper.platform} pipeline.`)
  );
  const downloaded = await downloadWebpage(parsedUrl.toString());

  if (downloaded.ok) {
    processingTrace[processingTrace.length - 1] = createStep(
      "Downloading webpage",
      "completed",
      `Fetched page using ${downloaded.renderMode} rendering.`
    );

    processingTrace.push(
      createStep(
        "Extracting product information",
        "completed",
        `Parsed ${scraper.platform} product metadata.`
      )
    );

    const extracted = scraper.scrape({
      html: downloaded.html,
      fallbackName
    });

    product = {
      name: normalizeProductName(extracted.name || fallbackName || "Linked Product"),
      brand: extracted.brand || detectBrand(extracted.name, fallbackName, parsedUrl.hostname),
      category: extracted.category || "Product",
      image: extracted.image || "",
      description: extracted.description || ""
    };
    extractedIngredients = extracted.ingredients || "";
  } else {
    processingTrace[processingTrace.length - 1] = createStep(
      "Downloading webpage",
      "failed",
      downloaded.errorMessage || "Unable to download webpage."
    );
    processingTrace.push(
      createStep(
        "Extracting product information",
        "completed",
        "Using URL slug fallback because the webpage could not be downloaded."
      )
    );
  }

  if (extractedIngredients) {
    processingTrace.push(
      createStep(
        "Looking for ingredients",
        "completed",
        "Ingredients extracted from the current page."
      )
    );
    const result = {
      sourceUrl: parsedUrl.toString(),
      platform: scraper.platform,
      cacheHit: false,
      product,
      ingredientsText: extractedIngredients,
      ingredientSource: "current-website",
      suggestedProduct: null,
      fallbackRequired: false,
      message: "Ingredients were retrieved directly from the product page."
    };
    setCachedUrlResolution(parsedUrl.toString(), result);
    return {
      ...result,
      processingTrace
    };
  }

  processingTrace.push(
    createStep(
      "Looking for ingredients",
      "failed",
      "No reliable ingredient section found on the original page."
    )
  );

  processingTrace.push(
    createStep("Searching official website", "in_progress", "Trying brand-owned source next.")
  );
  const officialSiteResult = await searchOfficialWebsite(product);
  if (officialSiteResult?.ingredientsText) {
    processingTrace[processingTrace.length - 1] = createStep(
      "Searching official website",
      "completed",
      officialSiteResult.url
        ? `Ingredients found on ${officialSiteResult.url}.`
        : "Ingredients matched through official brand/local brand fallback."
    );
    const result = {
      sourceUrl: parsedUrl.toString(),
      platform: scraper.platform,
      cacheHit: false,
      product: officialSiteResult.product || product,
      ingredientsText: officialSiteResult.ingredientsText,
      ingredientSource: officialSiteResult.source,
      suggestedProduct: officialSiteResult.matchedProduct || null,
      fallbackRequired: false,
      message: "Ingredients were recovered through the brand fallback pipeline."
    };
    setCachedUrlResolution(parsedUrl.toString(), result);
    return {
      ...result,
      processingTrace
    };
  }

  processingTrace[processingTrace.length - 1] = createStep(
    "Searching official website",
    "failed",
    "No ingredient list found through official brand fallback."
  );

  processingTrace.push(
    createStep(
      "Searching local database",
      "in_progress",
      "Trying fuzzy product matching in DermIntel storage."
    )
  );
  const databaseMatch = findLocalDatabaseMatch(product);

  if (databaseMatch?.ingredientsText) {
    processingTrace[processingTrace.length - 1] = createStep(
      "Searching local database",
      "completed",
      `Matched ${databaseMatch.matchedProduct.name} in the local catalog.`
    );
    const result = {
      sourceUrl: parsedUrl.toString(),
      platform: scraper.platform,
      cacheHit: false,
      product: {
        ...product,
        name: databaseMatch.matchedProduct.name,
        brand: databaseMatch.matchedProduct.brand,
        category: databaseMatch.matchedProduct.category
      },
      ingredientsText: databaseMatch.ingredientsText,
      ingredientSource: "local-database",
      suggestedProduct: databaseMatch.matchedProduct,
      fallbackRequired: false,
      message: "Ingredients were recovered from DermIntel's local product database."
    };
    setCachedUrlResolution(parsedUrl.toString(), result);
    return {
      ...result,
      processingTrace
    };
  }

  processingTrace[processingTrace.length - 1] = createStep(
    "Searching local database",
    "failed",
    "No sufficiently confident product match was found in the local catalog."
  );

  processingTrace.push(
    createStep(
      "Searching external API",
      "skipped",
      "External API integration is not configured in this MVP."
    )
  );
  processingTrace.push(
    createStep("Manual fallback", "completed", "Prompt the user to paste ingredients manually.")
  );

  const result = {
    sourceUrl: parsedUrl.toString(),
    platform: scraper.platform,
    cacheHit: false,
    product,
    ingredientsText: "",
    ingredientSource: "manual-fallback",
    suggestedProduct: null,
    fallbackRequired: true,
    message:
      "We couldn't automatically retrieve the ingredient list for this product. Please paste the ingredients manually for analysis."
  };
  setCachedUrlResolution(parsedUrl.toString(), result);
  return {
    ...result,
    processingTrace
  };
}

