import fs from "node:fs/promises";
import path from "node:path";

import { createIngredientCandidate } from "../lib/pipeline/ingredient-candidate.js";
import { verifyIngredientCandidate } from "../lib/url-analysis/ingredient-verifier.js";
import { logUrlAnalysis } from "../lib/url-analysis/logger.js";
import { extractIngredientsFromLabelImage, parseIngredientsFromCommunityText } from "./ocr-service.js";

const MAX_IMAGE_CANDIDATES = 80;
const OCR_CONCURRENCY = 3;
const OPENAI_TEXT_MODEL = process.env.OPENAI_OCR_CLEANUP_MODEL || process.env.OPENAI_EXTRACTION_MODEL || "gpt-4.1-mini";
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");

const INGREDIENT_TEXT_KEYWORDS = [
  "ingredients",
  "ingredient",
  "inci",
  "aqua",
  "water",
  "glycerin",
  "sodium",
  "fragrance",
  "tocopherol",
  "phenoxyethanol",
  "composition",
  "ci"
];

const THUMBNAIL_SELECTORS = [
  "[class*='thumb' i]",
  "[class*='thumbnail' i]",
  "[class*='gallery' i] img",
  "[class*='carousel' i] img",
  "[class*='slider' i] img",
  "[class*='swiper' i] img",
  "[class*='slick' i] img",
  "[class*='splide' i] img",
  "[class*='embla' i] img",
  "[class*='product' i] img",
  "[class*='media' i] img",
  "[class*='pdp' i] img",
  "[id*='image' i] img",
  "[id*='gallery' i] img",
  "[id*='altImages' i] img",
  "[data-image-index]",
  "[data-thumb]",
  "[data-thumbnail]",
  "[data-old-hires]",
  "[data-a-dynamic-image]",
  "[aria-label*='thumbnail' i]",
  "[aria-label*='image' i]",
  "li:has(img)",
  "button:has(img)",
  "a:has(img)",
  "img"
];

const GALLERY_CONTAINER_SELECTORS = [
  "[class*='gallery' i]",
  "[class*='carousel' i]",
  "[class*='slider' i]",
  "[class*='swiper' i]",
  "[class*='slick' i]",
  "[class*='splide' i]",
  "[class*='embla' i]",
  "[class*='thumb' i]",
  "[class*='media' i]",
  "[id*='gallery' i]",
  "[id*='image' i]",
  "[id*='altImages' i]",
  "[role='listbox']",
  "[role='region']"
];

const INSPECTED_WINDOW_VARIABLES = [
  "__NEXT_DATA__",
  "__NUXT__",
  "__INITIAL_STATE__",
  "__INITIAL_PROPS__",
  "__APOLLO_STATE__",
  "__PRELOADED_STATE__",
  "ShopifyAnalytics",
  "dataLayer",
  "digitalData",
  "meta",
  "product",
  "productData",
  "ProductData",
  "pdpData",
  "__PRODUCT__"
];

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function safeUrl(value = "", baseUrl = "") {
  try {
    const normalized = String(value || "").replace(/\\\//g, "/").trim();
    if (normalized.startsWith("//")) {
      return new URL(`https:${normalized}`).toString();
    }
    return new URL(normalized, baseUrl).toString();
  } catch (_error) {
    return "";
  }
}

function parseSrcset(value = "", baseUrl = "") {
  return String(value || "")
    .split(",")
    .map((entry) => {
      const [url, descriptor = ""] = entry.trim().split(/\s+/);
      const widthMatch = descriptor.match(/(\d+)w/i);
      return {
        url: safeUrl(url, baseUrl),
        width: widthMatch ? Number(widthMatch[1]) : 0,
        sourceDetail: descriptor || "srcset"
      };
    })
    .filter((entry) => entry.url);
}

function looksLikeImageUrl(value = "") {
  const url = String(value || "").toLowerCase();
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return false;
  if (/\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(url)) return true;
  return /image|images|img|media|photo|picture|gallery|carousel|product|cdn|assets|upload|resize|width=|height=|w=|h=|format=|fm=/.test(url);
}

function isLikelyProductImage(image = {}) {
  const url = String(image.url || "").toLowerCase();
  const alt = String(image.alt || "").toLowerCase();
  const className = String(image.className || "").toLowerCase();
  const source = String(image.source || "").toLowerCase();
  const combined = `${url} ${alt} ${className} ${source}`;

  if (!/^https?:\/\//i.test(image.url || "")) return false;
  if (/logo|sprite|placeholder|payment|badge|avatar|loader|tracking|pixel|favicon|swatch|icon-only/.test(combined)) return false;
  if (/\.(svg|gif)(?:\?|$)/i.test(url)) return false;
  if (image.width && image.height && image.width < 80 && image.height < 80) return false;

  return looksLikeImageUrl(url) || /main|product|gallery|media|carousel|thumbnail|thumb|zoom|pdp|variant|pack|label|ingredient|back|front/.test(combined);
}

function estimateImageResolution(image = {}) {
  const url = String(image.url || "");
  const numbers = [];
  if (image.width) numbers.push(Number(image.width));
  if (image.height) numbers.push(Number(image.height));

  const patterns = [
    /[?&](?:width|height|w|h)=([0-9]{2,5})/gi,
    /(?:SX|SY|UX|UY|UL|SL)([0-9]{2,5})/gi,
    /([0-9]{2,5})x([0-9]{2,5})/gi,
    /[_-]([0-9]{2,5})(?:\.|_|-|$)/gi
  ];

  for (const pattern of patterns) {
    for (const match of url.matchAll(pattern)) {
      numbers.push(...match.slice(1).map(Number).filter(Boolean));
    }
  }

  return Math.max(...numbers, 0);
}

function createHighResolutionVariants(url = "") {
  const variants = new Set([url]);

  try {
    const parsed = new URL(url);
    const params = parsed.searchParams;
    let changed = false;
    for (const key of ["width", "height", "w", "h"]) {
      if (params.has(key)) {
        params.set(key, "1600");
        changed = true;
      }
    }
    for (const key of ["quality", "q"]) {
      if (params.has(key)) {
        params.set(key, "95");
        changed = true;
      }
    }
    if (changed) variants.add(parsed.toString());
  } catch (_error) {
    // Ignore malformed variants.
  }

  const amazonCleaned = url
    .replace(/\._[A-Z0-9_,.-]*(?:SX|SY|UX|UY|UL|SL|AC|SR|QL)[A-Z0-9_,.-]*_\./gi, ".")
    .replace(/\._[A-Z0-9_,.-]{8,}_\./gi, ".");
  if (amazonCleaned !== url) variants.add(amazonCleaned);

  return [...variants];
}

function canonicalImageKey(url = "") {
  try {
    const parsed = new URL(url);
    const paramsToDrop = ["width", "height", "w", "h", "quality", "q", "format", "fm", "fit", "crop", "resize"];
    for (const key of paramsToDrop) parsed.searchParams.delete(key);
    parsed.hash = "";
    parsed.pathname = parsed.pathname
      .replace(/\._[A-Z0-9_,.-]*_\./gi, ".")
      .replace(/([_-])\d{2,5}x\d{2,5}(?=\.|_|-|$)/gi, "$1")
      .replace(/([_-])\d{2,5}(?=\.|_|-|$)/gi, "$1");
    return `${parsed.hostname}${parsed.pathname}${parsed.search}`.toLowerCase();
  } catch (_error) {
    return String(url || "").toLowerCase();
  }
}

export function rankImageCandidates(images = []) {
  return [...images]
    .map((image) => {
      const combined = `${image.url || ""} ${image.alt || ""} ${image.className || ""} ${image.source || ""}`.toLowerCase();
      const resolution = estimateImageResolution(image);
      let score = 0;

      if (/ingredient|ingredients|inci|composition/.test(combined)) score += 60;
      if (/back|label|pack|package|packaging|side|details|panel/.test(combined)) score += 34;
      if (/main|product|gallery|media|carousel|thumbnail|thumb|zoom|pdp|variant/.test(combined)) score += 20;
      if (/network-response|json-ld|embedded|next|nuxt/.test(combined)) score += 10;
      if (/front|hero|lifestyle|model|routine|banner|offer|ad|promo/.test(combined)) score -= 8;
      if (resolution) score += Math.min(36, Math.round(resolution / 80));
      if (image.width && image.height) score += Math.min(20, Math.round((image.width * image.height) / 160000));

      return { ...image, score, resolution };
    })
    .sort((left, right) => right.score - left.score);
}

function collectImageUrlsFromText(text = "", baseUrl = "") {
  const normalized = String(text || "").replace(/\\\//g, "/");
  const matches = [];
  const patterns = [
    /https?:\/\/[^"'\s)<>]+?(?:\.(?:png|jpe?g|webp|avif)|\/image\/|\/images\/|\/media\/|\/upload\/|\/products?\/)[^"'\s)<>]*/gi,
    /\/\/[^"'\s)<>]+?(?:\.(?:png|jpe?g|webp|avif)|\/image\/|\/images\/|\/media\/|\/upload\/|\/products?\/)[^"'\s)<>]*/gi,
    /(?:\/[^"'\s)<>]+?(?:\.(?:png|jpe?g|webp|avif)|\/image\/|\/images\/|\/media\/|\/upload\/|\/products?\/)[^"'\s)<>]*)/gi
  ];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const url = safeUrl(match[0], baseUrl);
      if (url && looksLikeImageUrl(url)) matches.push(url);
    }
  }

  return matches;
}

function expandImageCandidate(image = {}, baseUrl = "") {
  const rawValue = String(image.url || "");
  const sourceFromText = rawValue.startsWith("__SCRIPT_TEXT__")
    ? rawValue.replace("__SCRIPT_TEXT__", "")
    : rawValue;
  const embeddedUrls = collectImageUrlsFromText(sourceFromText, baseUrl);

  if (embeddedUrls.length) {
    const expandedEmbeddedUrls = unique(embeddedUrls.flatMap((url) => [
      url,
      ...createHighResolutionVariants(url)
    ]));

    return expandedEmbeddedUrls.map((url) => ({
      ...image,
      url,
      source: image.source || (rawValue.startsWith("__SCRIPT_TEXT__") ? "embedded-javascript" : "embedded-image-json"),
      className: `${image.className || ""} embedded-product-json`,
      resolution: estimateImageResolution({ ...image, url })
    }));
  }

  if (rawValue.startsWith("__SCRIPT_TEXT__")) {
    return [];
  }

  const directUrl = safeUrl(rawValue, baseUrl);
  const urls = [
    directUrl,
    ...parseSrcset(rawValue, baseUrl).map((entry) => entry.url),
    ...createHighResolutionVariants(directUrl)
  ].filter(Boolean);

  return unique(urls).map((url) => ({
    ...image,
    url,
    resolution: estimateImageResolution({ ...image, url })
  }));
}

function preferHighestResolutionImages(images = []) {
  const byKey = new Map();
  for (const image of images) {
    const key = canonicalImageKey(image.url);
    const existing = byKey.get(key);
    const candidateScore = estimateImageResolution(image) + (image.score || 0);
    const existingScore = existing ? estimateImageResolution(existing) + (existing.score || 0) : -1;
    if (!existing || candidateScore >= existingScore) {
      byKey.set(key, image);
    }
  }
  return [...byKey.values()];
}

async function waitForRenderedPage(page, timeoutMs) {
  await page.waitForLoadState("load", { timeout: Math.min(timeoutMs, 7000) }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 7000) }).catch(() => {});
  await page.waitForTimeout(800);
}

async function autoScrollForLazyImages(page, timeoutMs) {
  const maxSteps = 14;
  const startedAt = Date.now();
  const viewportHeight = page.viewportSize()?.height || 900;
  const stepSize = Math.max(420, Math.floor(viewportHeight * 0.7));

  for (let position = 0, step = 0; step < maxSteps; position += stepSize, step += 1) {
    if (Date.now() - startedAt > timeoutMs) break;
    const scrollHeight = await page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)).catch(() => 0);
    if (position > scrollHeight + viewportHeight) break;
    await page.evaluate((nextPosition) => window.scrollTo(0, nextPosition), position).catch(() => {});
    await page.waitForTimeout(220).catch(() => {});
  }

  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(300).catch(() => {});
}

async function extractRawImagesFromPage(page, source = "rendered-dom") {
  return page.evaluate((sourceLabel) => {
    const output = [];
    const push = (url, meta = {}) => {
      if (!url) return;
      output.push({
        url,
        alt: meta.alt || "",
        className: meta.className || "",
        width: Number(meta.width || 0),
        height: Number(meta.height || 0),
        source: meta.source || sourceLabel,
        sourceDetail: meta.sourceDetail || ""
      });
    };
    const srcsetUrls = (value = "") => String(value || "").split(",").map((entry) => entry.trim().split(/\s+/)[0]).filter(Boolean);
    const imageAttrs = [
      "src", "currentSrc", "srcset", "data-src", "data-srcset", "data-original", "data-image", "data-img",
      "data-image-url", "data-image-src", "data-zoom-image", "data-zoom-url", "data-large-image", "data-large-image-url",
      "data-full-image", "data-full-image-url", "data-hires", "data-old-hires", "data-master", "data-main-image",
      "data-media", "data-media-url", "data-thumbnail", "data-thumb", "data-thumb-url", "data-src-medium",
      "data-src-large", "data-zoom", "data-large", "data-full", "data-a-dynamic-image", "href", "content"
    ];

    document.querySelectorAll("img, image").forEach((img) => {
      const meta = {
        alt: img.alt || img.getAttribute("aria-label") || "",
        className: img.className || "",
        width: img.naturalWidth || img.width || Number(img.getAttribute("width") || 0),
        height: img.naturalHeight || img.height || Number(img.getAttribute("height") || 0),
        source: sourceLabel,
        sourceDetail: img.tagName.toLowerCase()
      };

      push(img.currentSrc || img.src, meta);
      for (const attr of imageAttrs) {
        const value = img.getAttribute(attr);
        push(value, { ...meta, sourceDetail: attr });
        srcsetUrls(value || "").forEach((url) => push(url, { ...meta, sourceDetail: attr }));
      }
    });

    document.querySelectorAll("picture source, source[srcset]").forEach((source) => {
      const meta = { className: source.className || "", source: sourceLabel, sourceDetail: "picture-source" };
      for (const attr of ["src", "srcset", "data-src", "data-srcset"]) {
        const value = source.getAttribute(attr) || "";
        push(value, { ...meta, sourceDetail: attr });
        srcsetUrls(value).forEach((url) => push(url, { ...meta, sourceDetail: attr }));
      }
    });

    document.querySelectorAll("a[href], button, [role='button']").forEach((node) => {
      const text = `${node.getAttribute("href") || ""} ${node.className || ""} ${node.getAttribute("aria-label") || ""}`;
      if (/zoom|gallery|image|media|thumbnail|thumb|product|photo|picture/i.test(text)) {
        for (const attr of imageAttrs) {
          push(node.getAttribute(attr), { className: node.className || "", source: sourceLabel, sourceDetail: attr });
        }
      }
    });

    document.querySelectorAll("*").forEach((node) => {
      const className = node.className || "";
      const style = `${node.getAttribute("style") || ""} ${getComputedStyle(node).backgroundImage || ""}`;
      for (const match of style.matchAll(/url\(["']?([^"')]+)["']?\)/gi)) {
        push(match[1], { className, source: sourceLabel, sourceDetail: "background-image" });
      }

      for (const attr of [...node.attributes || []]) {
        const name = attr.name || "";
        const value = attr.value || "";
        if (/src|image|img|media|zoom|gallery|thumb|background|data-a-dynamic-image/i.test(name)) {
          push(value, { className, source: sourceLabel, sourceDetail: name });
          srcsetUrls(value).forEach((url) => push(url, { className, source: sourceLabel, sourceDetail: name }));
        }
      }
    });

    document.querySelectorAll("meta[property='og:image'],meta[property='og:image:secure_url'],meta[name='twitter:image'],meta[itemprop='image']").forEach((meta) => {
      push(meta.getAttribute("content"), { className: "product-meta-image", source: "metadata", sourceDetail: meta.getAttribute("property") || meta.getAttribute("name") || "meta" });
    });

    document.querySelectorAll("link[rel='preload'][as='image'],link[rel='prefetch'][as='image'],link[imagesrcset],link[href]").forEach((link) => {
      const rel = link.getAttribute("rel") || "link";
      for (const attr of ["href", "imagesrcset", "srcset"]) {
        const value = link.getAttribute(attr) || "";
        push(value, { className: "product-link-image", source: "metadata", sourceDetail: `${rel}:${attr}` });
        srcsetUrls(value).forEach((url) => push(url, { className: "product-link-image", source: "metadata", sourceDetail: `${rel}:${attr}` }));
      }
    });

    document.querySelectorAll("script[type='application/ld+json'],script#__NEXT_DATA__,script").forEach((script) => {
      output.push({
        url: `__SCRIPT_TEXT__${script.textContent || ""}`,
        alt: "embedded product json",
        className: script.id || script.type || "embedded-script",
        width: 0,
        height: 0,
        source: script.id === "__NEXT_DATA__" ? "__NEXT_DATA__" : script.type === "application/ld+json" ? "json-ld" : "embedded-javascript",
        sourceDetail: script.id || script.type || "script"
      });
    });

    const globalKeys = new Set([
      "__NEXT_DATA__", "__NUXT__", "__INITIAL_STATE__", "__INITIAL_PROPS__", "__APOLLO_STATE__",
      "__PRELOADED_STATE__", "ShopifyAnalytics", "dataLayer", "digitalData", "meta", "product",
      "productData", "ProductData", "pdpData", "__PRODUCT__"
    ]);

    try {
      Object.keys(window)
        .filter((key) => /product|pdp|gallery|image|media|variant|carousel/i.test(key))
        .slice(0, 80)
        .forEach((key) => globalKeys.add(key));
    } catch (_error) {
      // Ignore protected global enumeration.
    }

    for (const globalKey of globalKeys) {
      try {
        const value = window[globalKey];
        if (value) {
          output.push({
            url: `__SCRIPT_TEXT__${JSON.stringify(value).slice(0, 700000)}`,
            alt: globalKey,
            className: globalKey,
            width: 0,
            height: 0,
            source: globalKey,
            sourceDetail: "window-object"
          });
        }
      } catch (_error) {
        // Ignore cyclic or protected objects.
      }
    }

    return output;
  }, source).catch(() => []);
}

async function scrollGalleryContainers(page, timeoutMs) {
  const startedAt = Date.now();
  const collected = [];
  const debug = {
    selectorsChecked: [...GALLERY_CONTAINER_SELECTORS],
    containersFoundBySelector: {},
    scrollActions: 0,
    errors: []
  };

  for (const selector of GALLERY_CONTAINER_SELECTORS) {
    if (Date.now() - startedAt > timeoutMs) break;

    let handles = [];
    try {
      handles = await page.$$(selector);
      debug.containersFoundBySelector[selector] = handles.length;
    } catch (error) {
      debug.containersFoundBySelector[selector] = 0;
      debug.errors.push({ selector, message: error.message });
      continue;
    }

    for (const handle of handles.slice(0, 20)) {
      if (Date.now() - startedAt > timeoutMs) break;
      try {
        await handle.scrollIntoViewIfNeeded().catch(() => {});
        const scrollPlan = await handle.evaluate((node) => {
          const maxLeft = Math.max(0, node.scrollWidth - node.clientWidth);
          const maxTop = Math.max(0, node.scrollHeight - node.clientHeight);
          return {
            maxLeft,
            maxTop,
            leftSteps: maxLeft ? [0, Math.floor(maxLeft * 0.33), Math.floor(maxLeft * 0.66), maxLeft] : [0],
            topSteps: maxTop ? [0, Math.floor(maxTop * 0.5), maxTop] : [0]
          };
        }).catch(() => ({ leftSteps: [0], topSteps: [0], maxLeft: 0, maxTop: 0 }));

        for (const left of scrollPlan.leftSteps.slice(0, 4)) {
          for (const top of scrollPlan.topSteps.slice(0, 3)) {
            if (Date.now() - startedAt > timeoutMs) break;
            await handle.evaluate((node, position) => {
              node.scrollLeft = position.left;
              node.scrollTop = position.top;
            }, { left, top }).catch(() => {});
            debug.scrollActions += 1;
            await page.waitForTimeout(180).catch(() => {});
            collected.push(...await extractRawImagesFromPage(page, `gallery-scroll:${selector}`));
          }
        }
      } catch (error) {
        debug.errors.push({ selector, message: error.message });
      }
    }
  }

  Object.defineProperty(collected, "galleryScrollDebug", {
    value: debug,
    enumerable: false
  });
  return collected;
}
async function collectImagesAfterThumbnailClicks(page, timeoutMs) {
  const clickedKeys = new Set();
  const collected = [];
  const startedAt = Date.now();
  const galleryDebug = {
    selectorsChecked: [...THUMBNAIL_SELECTORS],
    elementsFoundBySelector: {},
    clickedThumbnailCount: 0,
    galleryRequiredInteraction: false,
    clickErrors: []
  };

  for (const selector of THUMBNAIL_SELECTORS) {
    if (Date.now() - startedAt > timeoutMs) break;
    let elements = [];
    try {
      elements = await page.$$(selector);
      galleryDebug.elementsFoundBySelector[selector] = elements.length;
    } catch (error) {
      galleryDebug.elementsFoundBySelector[selector] = 0;
      galleryDebug.clickErrors.push({ selector, message: error.message });
      continue;
    }

    for (const element of elements.slice(0, 48)) {
      if (Date.now() - startedAt > timeoutMs) break;
      const key = await element.evaluate((node) => `${node.textContent || ""}|${node.getAttribute("src") || ""}|${node.getAttribute("href") || ""}|${node.className || ""}`.slice(0, 240)).catch(() => "");
      if (clickedKeys.has(key)) continue;
      clickedKeys.add(key);

      try {
        await element.scrollIntoViewIfNeeded().catch(() => {});
        await element.hover({ timeout: 500 }).catch(() => {});
        await element.click({ timeout: 900, force: true }).catch(() => {});
        galleryDebug.clickedThumbnailCount += 1;
        await page.waitForTimeout(250).catch(() => {});
        const imagesAfterClick = await extractRawImagesFromPage(page, `thumbnail-click:${selector}`);
        if (imagesAfterClick.length) {
          galleryDebug.galleryRequiredInteraction = true;
        }
        collected.push(...imagesAfterClick);
      } catch (error) {
        galleryDebug.clickErrors.push({ selector, message: error.message });
      }
    }
  }

  Object.defineProperty(collected, "galleryDebug", {
    value: galleryDebug,
    enumerable: false
  });
  return collected;
}
export function normalizeAndSelectImages(rawImages = [], baseUrl = "") {
  const normalized = rawImages.flatMap((image) => expandImageCandidate(image, baseUrl));
  const filtered = normalized.filter(isLikelyProductImage);
  return rankImageCandidates(preferHighestResolutionImages(filtered)).slice(0, MAX_IMAGE_CANDIDATES);
}

function attachCollectionDebug(images = [], debug = {}) {
  Object.defineProperty(images, "collectionDebug", {
    value: debug,
    enumerable: false
  });
  return images;
}

function hostsLookRelated(inputUrl = "", currentUrl = "") {
  try {
    const inputHost = new URL(inputUrl).hostname.replace(/^www\./i, "").toLowerCase();
    const currentHost = new URL(currentUrl).hostname.replace(/^www\./i, "").toLowerCase();
    return inputHost === currentHost || inputHost.endsWith(`.${currentHost}`) || currentHost.endsWith(`.${inputHost}`);
  } catch (_error) {
    return false;
  }
}

async function getPageCollectionDiagnostics(page, inputUrl = "") {
  const pageTitle = await page.title().catch(() => "");
  const currentUrl = page.url();
  const bodyText = await page.locator("body").innerText({ timeout: 1200 }).catch(() => "");
  const sampleText = `${pageTitle}\n${bodyText.slice(0, 4000)}`;
  const antiBotPattern = /captcha|robot|verify\s+(?:you|yourself)|unusual traffic|access denied|request blocked|are you human|security check|cloudflare|temporarily unavailable|automated access/i;

  return {
    pageTitle,
    currentUrl,
    reachedProductPage: Boolean(currentUrl && currentUrl !== "about:blank" && hostsLookRelated(inputUrl, currentUrl)),
    captchaOrAntiBotDetected: antiBotPattern.test(sampleText),
    bodyTextLength: bodyText.length,
    inspectedWindowVariables: [...INSPECTED_WINDOW_VARIABLES],
    selectorsChecked: [...THUMBNAIL_SELECTORS]
  };
}

function buildZeroImageReason({ pageDebug = {}, rawImageCount = 0, galleryDebug = {}, sourceCounts = {} } = {}) {
  if (pageDebug.captchaOrAntiBotDetected) {
    return `Playwright reached ${pageDebug.currentUrl || "the page"}, but the page appears blocked by CAPTCHA or anti-bot protection.`;
  }

  if (!pageDebug.reachedProductPage) {
    return `Playwright did not appear to reach the original product page. Final URL: ${pageDebug.currentUrl || "unknown"}.`;
  }

  const foundThumbnailElements = Object.values(galleryDebug.elementsFoundBySelector || {}).reduce((total, count) => total + Number(count || 0), 0);

  if (!rawImageCount && foundThumbnailElements > 0 && !galleryDebug.clickedThumbnailCount) {
    return `Thumbnail/gallery elements were found (${foundThumbnailElements}), but they could not be clicked or did not expose image URLs.`;
  }

  if (!rawImageCount) {
    return `No image URLs were found in DOM images, picture/srcset tags, lazy-load data attributes, background images, network responses, embedded JSON, JSON-LD, __NEXT_DATA__, __NUXT__, or inspected JavaScript variables.`;
  }

  return `Found ${rawImageCount} raw image reference${rawImageCount === 1 ? "" : "s"}, but all were rejected as duplicate, non-product, unsupported, blocked, or too small after normalization. Source counts: ${JSON.stringify(sourceCounts)}.`;
}

function isPlaywrightBrowserMissingError(error) {
  const message = `${error?.message || ""}\n${error?.stack || ""}`;
  return /Executable doesn'?t exist|playwright was just installed|npx playwright install|playwright install/i.test(message);
}

function formatImageCollectionError(error) {
  const message = String(error?.message || "").replace(/\s+/g, " ").trim();

  if (isPlaywrightBrowserMissingError(error)) {
    return "Playwright Chromium is not installed on this server. Redeploy the backend after the postinstall browser download runs, or set the Render build command to `npm install && npx playwright install chromium`.";
  }

  if (/ERR_NETWORK_ACCESS_DENIED/i.test(message)) {
    return "The server browser could not access this product URL because the network request was denied. Amazon may block hosted browser requests, so try the official brand product page or paste/upload the ingredient label.";
  }

  return `Image collection failed before OCR could run: ${message}`;
}
export async function collectProductImageUrlsWithPlaywright({ inputUrl, timeoutMs = 12000, signal } = {}) {
  let browser = null;
  let page = null;
  const networkImages = [];
  const startedAt = Date.now();
  const collectionDebug = {
    inputUrl,
    timeoutMs,
    launchMode: "chromium-headless",
    selectorsChecked: [...THUMBNAIL_SELECTORS],
    inspectedWindowVariables: [...INSPECTED_WINDOW_VARIABLES],
    pageTitle: "",
    currentUrl: "",
    reachedProductPage: false,
    captchaOrAntiBotDetected: false,
    bodyTextLength: 0,
    navigationStatus: null,
    galleryDebug: {},
    rawCounts: {},
    rawImageCount: 0,
    rawSourceCounts: {},
    imageCount: 0,
    sourceCounts: {},
    zeroImageReason: ""
  };

  try {
    if (signal?.aborted) {
      collectionDebug.zeroImageReason = "Image collection was cancelled before Playwright started.";
      return attachCollectionDebug([], collectionDebug);
    }

    const playwright = await import("playwright");
    browser = await playwright.chromium.launch({ headless: true });
    page = await browser.newPage({
      viewport: { width: 1365, height: 1100 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    });

    page.on("response", (response) => {
      const url = response.url();
      const contentType = response.headers()["content-type"] || "";
      if (contentType.startsWith("image/") || looksLikeImageUrl(url)) {
        networkImages.push({
          url,
          source: "network-response",
          sourceDetail: contentType || String(response.status()),
          width: 0,
          height: 0,
          status: response.status()
        });
      }
    });

    const navigationResponse = await page.goto(inputUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    collectionDebug.navigationStatus = navigationResponse?.status?.() || null;
    await waitForRenderedPage(page, timeoutMs);

    Object.assign(collectionDebug, await getPageCollectionDiagnostics(page, inputUrl));

    const firstPass = await extractRawImagesFromPage(page, "rendered-dom:first-pass");
    const galleryScrollBeforeClicks = await scrollGalleryContainers(page, Math.max(2200, timeoutMs - (Date.now() - startedAt)));
    await autoScrollForLazyImages(page, Math.max(2500, timeoutMs - (Date.now() - startedAt)));
    const afterScroll = await extractRawImagesFromPage(page, "rendered-dom:after-scroll");
    const afterClicks = await collectImagesAfterThumbnailClicks(page, Math.max(3000, timeoutMs - (Date.now() - startedAt)));
    const galleryScrollAfterClicks = await scrollGalleryContainers(page, Math.max(1800, timeoutMs - (Date.now() - startedAt)));
    const finalPass = await extractRawImagesFromPage(page, "rendered-dom:final-pass");

    const rawImages = [
      ...networkImages,
      ...firstPass,
      ...galleryScrollBeforeClicks,
      ...afterScroll,
      ...afterClicks,
      ...galleryScrollAfterClicks,
      ...finalPass
    ];

    const images = normalizeAndSelectImages(rawImages, page.url());

    const rawSourceCounts = rawImages.reduce((counts, image) => {
      const key = image.source || "unknown";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});

    const sourceCounts = images.reduce((counts, image) => {
      const key = image.source || "unknown";
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {});

    Object.assign(collectionDebug, {
      rawCounts: {
        networkImages: networkImages.length,
        firstPass: firstPass.length,
        galleryScrollBeforeClicks: galleryScrollBeforeClicks.length,
        afterScroll: afterScroll.length,
        afterThumbnailClicks: afterClicks.length,
        galleryScrollAfterClicks: galleryScrollAfterClicks.length,
        finalPass: finalPass.length
      },
      rawImageCount: rawImages.length,
      rawSourceCounts,
      imageCount: images.length,
      sourceCounts,
      galleryDebug: afterClicks.galleryDebug || {},
      galleryScrollDebug: {
        beforeClicks: galleryScrollBeforeClicks.galleryScrollDebug || {},
        afterClicks: galleryScrollAfterClicks.galleryScrollDebug || {}
      },
      galleryRequiredInteraction: Boolean(afterClicks.galleryDebug?.galleryRequiredInteraction),
      totalDurationMs: Date.now() - startedAt
    });

    if (!images.length) {
      collectionDebug.zeroImageReason = buildZeroImageReason({
        pageDebug: collectionDebug,
        rawImageCount: rawImages.length,
        galleryDebug: collectionDebug.galleryDebug,
        sourceCounts: rawSourceCounts
      });
      logUrlAnalysis("product-image-collection-zero", collectionDebug);
      return attachCollectionDebug(images, collectionDebug);
    }

    logUrlAnalysis("product-image-collection-complete", {
      inputUrl,
      pageTitle: collectionDebug.pageTitle,
      currentUrl: collectionDebug.currentUrl,
      finalUrl: page.url(),
      reachedProductPage: collectionDebug.reachedProductPage,
      captchaOrAntiBotDetected: collectionDebug.captchaOrAntiBotDetected,
      navigationStatus: collectionDebug.navigationStatus,
      selectorsChecked: collectionDebug.selectorsChecked,
      inspectedWindowVariables: collectionDebug.inspectedWindowVariables,
      galleryDebug: collectionDebug.galleryDebug,
      rawImageCount: collectionDebug.rawImageCount,
      imageCount: images.length,
      sourceCounts,
      images: images.map((image) => ({
        url: image.url,
        source: image.source,
        sourceDetail: image.sourceDetail,
        width: image.width || 0,
        height: image.height || 0,
        resolution: image.resolution || 0,
        score: image.score || 0
      })).slice(0, MAX_IMAGE_CANDIDATES)
    });

    return attachCollectionDebug(images, collectionDebug);
  } catch (error) {
    if (page && !page.isClosed()) {
      Object.assign(collectionDebug, await getPageCollectionDiagnostics(page, inputUrl).catch(() => ({})));
    }
    collectionDebug.zeroImageReason = collectionDebug.captchaOrAntiBotDetected
      ? `Playwright reached ${collectionDebug.currentUrl || "the page"}, but the page appears blocked by CAPTCHA or anti-bot protection.`
      : formatImageCollectionError(error);
    collectionDebug.totalDurationMs = Date.now() - startedAt;

    logUrlAnalysis("product-image-collection-failed", {
      ...collectionDebug,
      message: error.message,
      stack: error.stack
    });
    return attachCollectionDebug([], collectionDebug);
  } finally {
    try {
      if (page && !page.isClosed()) await page.close();
    } catch (_error) {
      // Ignore cleanup failure.
    }
    try {
      if (browser) await browser.close();
    } catch (_error) {
      // Ignore cleanup failure.
    }
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: options.signal || controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function extractJsonObject(value = "") {
  try {
    return JSON.parse(value);
  } catch (_error) {
    const match = String(value || "").match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (_nestedError) {
      return null;
    }
  }
}

async function callOpenAiChatJson({ model, messages }) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(`${OPENAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages
      })
    }, 8000);

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return extractJsonObject(payload.choices?.[0]?.message?.content || "");
  } catch (_error) {
    return null;
  }
}

function splitPotentialIngredients(text = "") {
  return parseIngredientsFromCommunityText(text || "")
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && item.length <= 90);
}

function normalizeIngredientTokenForSupport(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[01]/g, (digit) => (digit === "0" ? "o" : "i"))
    .replace(/[^a-z]/g, "");
}

function levenshteinDistance(left = "", right = "") {
  const a = normalizeIngredientTokenForSupport(left);
  const b = normalizeIngredientTokenForSupport(right);

  if (!a || !b) return Math.max(a.length, b.length);
  if (a === b) return 0;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }

  return previous[b.length];
}

function isSupportedByOcrText(cleanedIngredient = "", ocrTokens = []) {
  const cleaned = normalizeIngredientTokenForSupport(cleanedIngredient);
  if (!cleaned) return false;

  return ocrTokens.some((token) => {
    const original = normalizeIngredientTokenForSupport(token);
    if (!original) return false;
    if (cleaned === original || cleaned.includes(original) || original.includes(cleaned)) return true;

    const distance = levenshteinDistance(cleaned, original);
    const maxAllowedDistance = Math.max(1, Math.floor(Math.max(cleaned.length, original.length) * 0.25));
    return distance <= maxAllowedDistance;
  });
}

export function filterAiIngredientsByOcrText(aiIngredients = [], rawOcrText = "") {
  const ocrTokens = splitPotentialIngredients(rawOcrText);
  return aiIngredients
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .filter((item) => isSupportedByOcrText(item, ocrTokens));
}

function extractAiIngredientList(aiResult = {}) {
  if (Array.isArray(aiResult?.ingredients)) {
    return aiResult.ingredients;
  }

  if (typeof aiResult?.ingredientsText === "string") {
    return splitPotentialIngredients(aiResult.ingredientsText);
  }

  return [];
}
export function scoreOcrIngredientText(rawText = "") {
  const text = String(rawText || "").replace(/\s+/g, " ").trim();
  const lowered = text.toLowerCase();
  const tokens = splitPotentialIngredients(text);
  const commaCount = (text.match(/,/g) || []).length;
  const keywordHits = INGREDIENT_TEXT_KEYWORDS.filter((keyword) => {
    if (keyword.toLowerCase() === "ci") {
      return /\bci\s*\d{3,5}\b/i.test(text) || /\bci\b/i.test(text);
    }
    return lowered.includes(keyword.toLowerCase());
  });
  const longCommaSeparatedList = tokens.length >= 8 && commaCount >= 6;
  const hasIngredientHeading = /\bingredients?\b|\binci\b|\bcomposition\b/i.test(text);
  const hasCommonInciSignals = keywordHits.length >= 3;

  let score = 0;
  score += keywordHits.length * 10;
  score += Math.min(tokens.length, 40) * 4;
  score += Math.min(commaCount, 30) * 2;
  if (hasIngredientHeading) score += 30;
  if (longCommaSeparatedList) score += 35;
  if (hasCommonInciSignals) score += 20;
  if (/directions|how to use|manufactured by|marketed by|customer care/i.test(text)) score -= 12;

  return {
    score,
    isIngredientText: Boolean(hasIngredientHeading || hasCommonInciSignals || longCommaSeparatedList),
    keywordHits,
    ingredientLikeCount: tokens.length,
    ingredientText: parseIngredientsFromCommunityText(text)
  };
}

export function selectBestIngredientOcrResult(ocrResults = []) {
  return ocrResults
    .map((result) => {
      const scoring = scoreOcrIngredientText(result.extractedIngredientsText || result.rawText || "");
      return {
        ...result,
        ...scoring
      };
    })
    .filter((result) => result.isIngredientText)
    .sort((left, right) => {
      if (right.ingredientLikeCount !== left.ingredientLikeCount) {
        return right.ingredientLikeCount - left.ingredientLikeCount;
      }
      return right.score - left.score;
    })[0] || null;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function cleanOcrIngredientTextWithAi({ rawText = "", product = {} } = {}) {
  const parsedText = parseIngredientsFromCommunityText(rawText || "");
  if (!parsedText) {
    return "";
  }

  const aiResult = await callOpenAiChatJson({
    model: OPENAI_TEXT_MODEL,
    messages: [
      {
        role: "system",
        content: "You extract cosmetic ingredients from OCR text. Correct obvious OCR spelling, spacing, and punctuation mistakes only. Return only ingredients that are visible in the OCR text. Never add ingredients from memory. Never infer missing ingredients. If the OCR text is not an ingredient list, return an empty array. Return JSON only."
      },
      {
        role: "user",
        content: `Product: ${product.brand || ""} ${product.name || ""}\nOCR text only:\n${parsedText}\n\nReturn JSON as {"ingredients":["Water","Glycerin"],"ingredientsText":"comma separated visible ingredients only"}.`
      }
    ]
  });

  const aiIngredients = extractAiIngredientList(aiResult);
  const supportedIngredients = filterAiIngredientsByOcrText(aiIngredients, parsedText);

  if (supportedIngredients.length) {
    return supportedIngredients.join(", ");
  }

  return parsedText.trim();
}

function extensionFromContentType(contentType = "", fallbackUrl = "") {
  const normalized = String(contentType || "").split(";")[0].trim().toLowerCase();
  const byType = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/gif": ".gif",
    "image/bmp": ".bmp",
    "image/tiff": ".tiff"
  };

  if (byType[normalized]) return byType[normalized];

  try {
    const match = new URL(fallbackUrl).pathname.match(/\.(jpe?g|png|webp|avif|gif|bmp|tiff?)(?:$|[?#])/i);
    if (match?.[1]) return match[0].startsWith(".") ? `.${match[1].toLowerCase().replace("jpeg", "jpg")}` : ".jpg";
  } catch (_error) {
    // Ignore malformed URLs.
  }

  return ".jpg";
}

function sanitizeDebugPathPart(value = "") {
  return String(value || "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "product";
}

function getDebugImageFolder({ inputUrl = "", traceId = "" } = {}) {
  const root = process.env.DERMINTEL_DEBUG_IMAGE_DIR || path.join(process.cwd(), "debug-images");
  let host = "product";
  try {
    host = new URL(inputUrl).hostname.replace(/^www\./i, "");
  } catch (_error) {
    // Use fallback folder name.
  }

  return path.join(root, `${sanitizeDebugPathPart(traceId || Date.now())}-${sanitizeDebugPathPart(host)}`);
}

async function downloadSingleDebugImage(image = {}, index = 0, folder = "") {
  const imageNumber = image.imageNumber || index + 1;
  const startedAt = Date.now();
  const base = {
    imageNumber,
    url: image.url,
    attempted: true,
    succeeded: false,
    status: null,
    contentType: "",
    byteLength: 0,
    filePath: "",
    error: "",
    durationMs: 0
  };

  try {
    const response = await fetchWithTimeout(image.url, {}, 5000);
    const contentType = response.headers?.get?.("content-type") || "";
    const buffer = Buffer.from(await response.arrayBuffer());
    const extension = extensionFromContentType(contentType, image.url);
    const filePath = path.join(folder, `image-${imageNumber}${extension}`);

    await fs.writeFile(filePath, buffer);

    return {
      ...base,
      succeeded: response.ok,
      status: response.status,
      contentType,
      byteLength: buffer.length,
      filePath,
      base64: response.ok ? buffer.toString("base64") : "",
      durationMs: Date.now() - startedAt,
      error: response.ok ? "" : `Image download failed with status ${response.status}.`
    };
  } catch (error) {
    return {
      ...base,
      durationMs: Date.now() - startedAt,
      error: error.message
    };
  }
}

function sanitizeDebugDownload(download = {}) {
  const { base64: _base64, ...safeDownload } = download;
  return safeDownload;
}

async function downloadImagesForDebug(images = [], { inputUrl = "", traceId = "" } = {}) {
  const folder = getDebugImageFolder({ inputUrl, traceId });
  await fs.mkdir(folder, { recursive: true });
  const downloads = await mapWithConcurrency(images, 4, (image, index) => downloadSingleDebugImage(image, index, folder));
  return {
    folder,
    downloads
  };
}

function summarizeImageForDiagnostics(image = {}) {
  return {
    imageNumber: image.imageNumber || null,
    url: image.url,
    source: image.source || "unknown",
    sourceDetail: image.sourceDetail || "",
    alt: image.alt || "",
    className: image.className || "",
    width: image.width || 0,
    height: image.height || 0,
    resolution: image.resolution || estimateImageResolution(image),
    score: image.score || 0
  };
}

function createTrackedImageFetch(imageUrl) {
  const download = {
    attempted: false,
    succeeded: null,
    status: null,
    error: ""
  };

  return {
    download,
    fetchFn: async (url, options = {}) => {
      const requestUrl = String(url || "");
      const isImageDownload = requestUrl === imageUrl;
      if (isImageDownload) {
        download.attempted = true;
      }

      try {
        const response = await fetchWithTimeout(url, options, 5000);
        if (isImageDownload) {
          download.status = response.status;
          download.succeeded = response.ok;
        }
        return response;
      } catch (error) {
        if (isImageDownload) {
          download.succeeded = false;
          download.error = error.message;
        }
        throw error;
      }
    }
  };
}

function createOcrDiagnostic({ image, ocrResult = {}, download = {}, error = null } = {}) {
  const rawText = ocrResult.rawText || "";
  const extractedIngredientsText = ocrResult.extractedIngredientsText || "";
  const scoring = scoreOcrIngredientText(extractedIngredientsText || rawText);
  const ocrPreview = (rawText || extractedIngredientsText).replace(/\s+/g, " ").trim().slice(0, 420);

  return {
    ...summarizeImageForDiagnostics(image),
    debugFilePath: download.filePath || "",
    downloadAttempted: Boolean(download.attempted),
    downloadSucceeded: download.succeeded,
    downloadStatus: download.status,
    downloadContentType: download.contentType || "",
    downloadByteLength: download.byteLength || 0,
    downloadError: download.error || "",
    ocrSucceeded: !error && Boolean(rawText || extractedIngredientsText),
    provider: ocrResult.provider || (error ? "failed" : "unknown"),
    rawTextLength: rawText.length,
    extractedTextLength: extractedIngredientsText.length,
    ocrPreview,
    score: scoring.score,
    isIngredientText: scoring.isIngredientText,
    ingredientKeywordsDetected: scoring.keywordHits.length > 0,
    keywordHits: scoring.keywordHits,
    ingredientLikeCount: scoring.ingredientLikeCount,
    error: error?.message || ocrResult.error || ""
  };
}
export async function searchProductImagesForIngredients({
  inputUrl,
  website,
  product,
  traceId,
  signal,
  collectImagesFn = collectProductImageUrlsWithPlaywright,
  ocrFn = extractIngredientsFromLabelImage,
  cleanOcrTextFn = cleanOcrIngredientTextWithAi
} = {}) {
  const report = {
    imageCount: 0,
    selectedImageCount: 0,
    ocrAttempts: 0,
    verifiedCandidates: 0,
    imageUrls: [],
    imageCollectionDebug: null,
    ocrDiagnostics: [],
    lastReason: "No product image contained a verified ingredient list."
  };
  const candidates = [];
  const attempts = [];

  const collectedImages = await collectImagesFn({
    inputUrl,
    timeoutMs: 15000,
    signal
  });
  const images = collectedImages.map((image, index) => ({
    ...image,
    imageNumber: index + 1
  }));
  Object.defineProperty(images, "collectionDebug", {
    value: collectedImages.collectionDebug || null,
    enumerable: false
  });

  report.imageCount = images.length;
  report.imageUrls = images.map(summarizeImageForDiagnostics);
  report.imageCollectionDebug = images.collectionDebug || null;

  logUrlAnalysis("product-image-fallback-images", {
    traceId,
    inputUrl,
    imageCount: report.imageCount,
    imageCollectionDebug: report.imageCollectionDebug,
    images: report.imageUrls
  });

  if (!images.length) {
    report.lastReason = report.imageCollectionDebug?.zeroImageReason || "No product images could be collected from the page.";
    return { candidates, attempts, report };
  }

  let debugDownloads = { folder: "", downloads: [] };
  const shouldDownloadDebugImages = ocrFn === extractIngredientsFromLabelImage && process.env.DERMINTEL_SKIP_DEBUG_IMAGE_DOWNLOADS !== "true";

  if (shouldDownloadDebugImages) {
    debugDownloads = await downloadImagesForDebug(images, { inputUrl, traceId });
    report.debugImageFolder = debugDownloads.folder;
    report.debugImageDownloads = debugDownloads.downloads.map(sanitizeDebugDownload);
    logUrlAnalysis("product-image-debug-downloads", {
      traceId,
      inputUrl,
      imageCount: images.length,
      debugImageFolder: debugDownloads.folder,
      downloads: report.debugImageDownloads
    });
  } else {
    report.debugImageFolder = "";
    report.debugImageDownloads = [];
  }

  const debugDownloadByNumber = new Map(debugDownloads.downloads.map((download) => [download.imageNumber, download]));

  const ocrResults = await mapWithConcurrency(images, OCR_CONCURRENCY, async (image) => {
    if (signal?.aborted) return null;

    report.ocrAttempts += 1;
    const tracker = createTrackedImageFetch(image.url);
    const debugDownload = debugDownloadByNumber.get(image.imageNumber);
    const downloadForDiagnostics = debugDownload?.base64 ? sanitizeDebugDownload(debugDownload) : tracker.download;

    try {
      const ocrResult = await ocrFn(debugDownload?.base64
        ? {
            imageBase64: debugDownload.base64,
            fetchFn: tracker.fetchFn
          }
        : {
            imageUrl: image.url,
            fetchFn: tracker.fetchFn
          });
      const result = {
        image,
        provider: ocrResult.provider || "unknown",
        rawText: ocrResult.rawText || "",
        extractedIngredientsText: ocrResult.extractedIngredientsText || ""
      };
      const diagnostic = createOcrDiagnostic({
        image,
        ocrResult: result,
        download: downloadForDiagnostics
      });
      report.ocrDiagnostics.push(diagnostic);
      logUrlAnalysis("product-image-ocr-result", {
        traceId,
        inputUrl,
        ...diagnostic
      });
      return result;
    } catch (error) {
      const result = {
        image,
        provider: "failed",
        rawText: "",
        extractedIngredientsText: "",
        error: error.message
      };
      const diagnostic = createOcrDiagnostic({
        image,
        ocrResult: result,
        download: downloadForDiagnostics,
        error
      });
      report.ocrDiagnostics.push(diagnostic);
      logUrlAnalysis("product-image-ocr-result", {
        traceId,
        inputUrl,
        ...diagnostic
      });
      return result;
    }
  });
  const bestOcr = selectBestIngredientOcrResult(ocrResults.filter(Boolean));
  report.selectedImageCount = bestOcr ? 1 : 0;

  if (!bestOcr) {
    const keywordImageCount = report.ocrDiagnostics.filter((item) => item.ingredientKeywordsDetected).length;
    report.lastReason = keywordImageCount
      ? `OCR scanned ${images.length} product image${images.length === 1 ? "" : "s"}; ${keywordImageCount} image${keywordImageCount === 1 ? "" : "s"} had ingredient keywords, but none passed full-label verification.`
      : `OCR scanned ${images.length} product image${images.length === 1 ? "" : "s"}, but none contained ingredient-label text.`;
    return { candidates, attempts, report };
  }

  const cleanedText = await cleanOcrTextFn({
    rawText: bestOcr.ingredientText || bestOcr.extractedIngredientsText || bestOcr.rawText || "",
    product
  });

  if (!cleanedText) {
    report.lastReason = "The best product image OCR text did not contain extractable ingredients after cleanup.";
    return { candidates, attempts, report };
  }

  const candidate = createIngredientCandidate({
    sourceUrl: bestOcr.image.url,
    sourceWebsite: website?.websiteLabel || "Product image",
    stage: "product-image-label",
    extractionMethod: `product-image-ocr:${bestOcr.provider || "unknown"}`,
    ingredientSource: "product-image-label",
    rawExtractedIngredients: cleanedText,
    sourceKind: "COMMUNITY",
    metadata: {
      imageUrl: bestOcr.image.url,
      rawOcrText: bestOcr.rawText || "",
      ocrProvider: bestOcr.provider || "none",
      ocrIngredientScore: bestOcr.score,
      ocrKeywordHits: bestOcr.keywordHits || [],
      ocrIngredientLikeCount: bestOcr.ingredientLikeCount || 0
    },
    product
  });

  const verified = await verifyIngredientCandidate(candidate, {
    productName: product?.name || "",
    brand: product?.brand || "",
    minIngredientCount: 8
  });

  attempts.push(verified);
  if (verified.verified) {
    candidates.push(verified);
    report.verifiedCandidates += 1;
    report.lastReason = `OCR scanned ${images.length} product image${images.length === 1 ? "" : "s"} and verified the most complete ingredient label using ${bestOcr.provider || "OCR"}.`;
  } else {
    report.lastReason = verified.rejectionReason || "Product image OCR text did not pass ingredient verification.";
  }

  logUrlAnalysis("product-image-ingredient-fallback", {
    traceId,
    inputUrl,
    imageCount: report.imageCount,
    selectedImageCount: report.selectedImageCount,
    ocrAttempts: report.ocrAttempts,
    verifiedCandidates: report.verifiedCandidates,
    imageUrls: report.imageUrls,
    debugImageFolder: report.debugImageFolder,
    debugImageDownloads: report.debugImageDownloads,
    ocrDiagnostics: report.ocrDiagnostics,
    lastReason: report.lastReason
  });

  return { candidates, attempts, report };
}
