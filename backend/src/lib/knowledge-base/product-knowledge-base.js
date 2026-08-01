import { randomUUID } from "node:crypto";
import { ingredientCatalog, productCatalog } from "../../data/mock-data.js";
import { getCachedProductResolution, setCachedProductResolution } from "../cache-manager.js";
import { getLookupKey } from "../formula-analysis/ingredient-normalizer.js";
import { normalizeProductName, normalizeWhitespace } from "../product-normalizer.js";
import { logUrlAnalysis } from "../url-analysis/logger.js";
import { createProductFingerprint } from "./product-fingerprint.js";
import { buildIngredientCreateData, buildSeedIngredientKnowledge } from "./ingredient-knowledge.js";

let prismaClientPromise;
const memoryProducts = new Map();
const memoryVerifiedFormulas = new Map();
const memoryProductAliases = new Map();
const memorySearchAttempts = [];

function nowIso() {
  return new Date().toISOString();
}

async function getPrismaClient() {
  if (prismaClientPromise !== undefined) {
    return prismaClientPromise;
  }

  prismaClientPromise = (async () => {
    if (!process.env.DATABASE_URL) {
      return null;
    }

    try {
      const prismaModule = await import("@prisma/client");
      const client = new prismaModule.PrismaClient();
      await client.$connect();
      return client;
    } catch (_error) {
      return null;
    }
  })();

  return prismaClientPromise;
}

function cloneValue(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function normalizeAliasKey(value = "") {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[\u2122\u00AE\u00A9]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAliasKeys(product = {}) {
  const brand = normalizeProductName(product.brand || "");
  const name = normalizeProductName(product.name || "");
  const canonicalName = normalizeProductName(product.canonicalName || name);
  const variant = normalizeProductName(product.variant || "");
  const size = normalizeProductName(product.size || "");
  const category = normalizeProductName(product.category || "");

  const rawKeys = [
    name,
    canonicalName,
    [brand, name].filter(Boolean).join(" "),
    [brand, canonicalName].filter(Boolean).join(" "),
    [brand, canonicalName, variant].filter(Boolean).join(" "),
    [brand, canonicalName, size].filter(Boolean).join(" "),
    [brand, variant, category].filter(Boolean).join(" "),
    [brand, name, variant].filter(Boolean).join(" ")
  ].filter(Boolean);

  return [...new Set(rawKeys.map(normalizeAliasKey).filter(Boolean))];
}

function registerAliases(fingerprintKey, productRecord) {
  for (const aliasKey of buildAliasKeys(productRecord)) {
    if (!memoryProductAliases.has(aliasKey)) {
      memoryProductAliases.set(aliasKey, fingerprintKey);
    }
  }
}

function resolveMemoryAliasFingerprint(fingerprint) {
  for (const aliasKey of buildAliasKeys(fingerprint)) {
    const matchedFingerprint = memoryProductAliases.get(aliasKey);
    if (matchedFingerprint) {
      return matchedFingerprint;
    }
  }

  return null;
}

function ensureMemorySeeded() {
  if (memoryVerifiedFormulas.size > 0) {
    return;
  }

  for (const product of productCatalog) {
    const fingerprint = createProductFingerprint(product);
    const ingredientList = Array.isArray(product.ingredients) ? product.ingredients : [];
    const createdAt = nowIso();
    const productRecord = {
      id: product.id || randomUUID(),
      fingerprint: fingerprint.fingerprint,
      brand: fingerprint.brand,
      name: product.name,
      canonicalName: fingerprint.canonicalName,
      variant: fingerprint.variant,
      category: fingerprint.category,
      size: fingerprint.size,
      description: product.description || "",
      imageUrl: product.imageUrl || null,
      sourceDomain: product.sourceDomain || null,
      ingredientsText: product.ingredientsText || ingredientList.join(", "),
      createdAt,
      updatedAt: createdAt
    };

    const formulaRecord = {
      id: `formula-${productRecord.id}`,
      productId: productRecord.id,
      fingerprint: fingerprint.fingerprint,
      ingredientsText: productRecord.ingredientsText,
      ingredientList,
      ingredientCount: ingredientList.length,
      confidenceScore: 0.94,
      sourceUrl: "",
      sourceWebsite: product.brand || "DermIntel Seed",
      extractionMethod: "knowledge-base-seed",
      ingredientSource: "knowledge-base-seed",
      matchedCount: ingredientList.length,
      unknownCount: 0,
      aliasMatchedCount: 0,
      matchRate: 1,
      reason: "Seeded from DermIntel's starter verified knowledge base.",
      verifiedAt: createdAt,
      createdAt,
      updatedAt: createdAt
    };

    memoryProducts.set(fingerprint.fingerprint, productRecord);
    memoryVerifiedFormulas.set(fingerprint.fingerprint, formulaRecord);
    registerAliases(fingerprint.fingerprint, productRecord);
  }
}

function buildKnowledgeBaseMessage(source = "knowledge-base") {
  if (source === "database-alias" || source === "memory-alias") {
    return "Using DermIntel's verified ingredient knowledge base via a learned product alias match.";
  }

  return "Using DermIntel's verified ingredient knowledge base for this product.";
}

function buildKnowledgeBaseTraceDetail(source = "knowledge-base") {
  if (source === "database-alias" || source === "memory-alias") {
    return "Verified formula found via DermIntel's learned product alias match.";
  }

  if (source === "database") {
    return "Verified formula found in DermIntel's database knowledge base.";
  }

  if (source === "memory") {
    return "Verified formula found in DermIntel's in-memory knowledge base.";
  }

  return `Verified formula found in DermIntel's knowledge base (${source}).`;
}

function toKnowledgeBaseResult({ inputUrl, websiteLabel, traceId, productRecord, formulaRecord, source = "knowledge-base" }) {
  return {
    status: "VERIFIED_INGREDIENTS_FOUND",
    verifiedIngredients: true,
    sourceUrl: formulaRecord.sourceUrl || inputUrl,
    sourceWebsite: formulaRecord.sourceWebsite || "DermIntel Knowledge Base",
    platform: websiteLabel,
    product: {
      name: productRecord.name,
      canonicalName: productRecord.canonicalName,
      brand: productRecord.brand,
      category: productRecord.category,
      variant: productRecord.variant,
      size: productRecord.size,
      description: productRecord.description || "",
      image: productRecord.imageUrl || "",
      sku: productRecord.sku || ""
    },
    extractionMethod: formulaRecord.extractionMethod || "knowledge-base",
    ingredientSource: formulaRecord.ingredientSource || source,
    confidenceScore: formulaRecord.confidenceScore ?? 0,
    ingredientsText: formulaRecord.ingredientsText || "",
    ingredientList: formulaRecord.ingredientList || [],
    ingredientCount: formulaRecord.ingredientCount || 0,
    matchedCount: formulaRecord.matchedCount ?? formulaRecord.ingredientCount ?? 0,
    unknownCount: formulaRecord.unknownCount ?? 0,
    aliasMatchedCount: formulaRecord.aliasMatchedCount ?? 0,
    matchRate: formulaRecord.matchRate ?? 1,
    processingTrace: [
      {
        label: "Product fingerprint",
        state: "completed",
        details: `Generated fingerprint for ${productRecord.brand} | ${productRecord.canonicalName}.`
      },
      {
        label: "Knowledge base lookup",
        state: "completed",
        details: buildKnowledgeBaseTraceDetail(source)
      }
    ],
    attemptedSources: [`knowledge-base:${productRecord.fingerprint}`],
    candidateAttempts: [],
    traceId,
    message: buildKnowledgeBaseMessage(source)
  };
}

async function findDatabaseProductByFingerprint(prisma, fingerprint) {
  return prisma.product.findFirst({
    where: {
      fingerprint: fingerprint.fingerprint
    }
  });
}

async function findDatabaseProductByAlias(prisma, fingerprint) {
  if (!fingerprint.brand || !fingerprint.canonicalName) {
    return null;
  }

  return prisma.product.findFirst({
    where: {
      brand: fingerprint.brand,
      canonicalName: fingerprint.canonicalName
    },
    orderBy: {
      updatedAt: "desc"
    }
  });
}

async function findBestDatabaseFormula(prisma, productId) {
  return prisma.verifiedFormula.findFirst({
    where: {
      productId
    },
    orderBy: [
      { confidenceScore: "desc" },
      { verifiedAt: "desc" }
    ]
  });
}

export async function getKnowledgeBaseResolution({ fingerprint, inputUrl, websiteLabel, traceId }) {
  const cached = await getCachedProductResolution(fingerprint.fingerprint);
  if (cached) {
    logUrlAnalysis("knowledge-base-cache-hit", {
      traceId,
      fingerprint: fingerprint.fingerprint
    });

    return {
      ...cached,
      processingTrace: [
        {
          label: "Product fingerprint",
          state: "completed",
          details: `Generated fingerprint for ${fingerprint.brand} | ${fingerprint.canonicalName}.`
        },
        {
          label: "Knowledge base lookup",
          state: "completed",
          details: "Verified formula found in DermIntel's Redis product cache."
        },
        ...(cached.processingTrace || [])
      ]
    };
  }

  ensureMemorySeeded();
  const prisma = await getPrismaClient();

  if (prisma?.product?.findFirst && prisma?.verifiedFormula?.findFirst) {
    try {
      const storedProduct = await findDatabaseProductByFingerprint(prisma, fingerprint);
      const aliasProduct = storedProduct || await findDatabaseProductByAlias(prisma, fingerprint);

      if (aliasProduct) {
        const storedFormula = await findBestDatabaseFormula(prisma, aliasProduct.id);

        if (storedFormula) {
          const source = storedProduct ? "database" : "database-alias";
          const result = toKnowledgeBaseResult({
            inputUrl,
            websiteLabel,
            traceId,
            productRecord: aliasProduct,
            formulaRecord: storedFormula,
            source
          });
          await setCachedProductResolution(fingerprint.fingerprint, result);
          logUrlAnalysis("knowledge-base-hit", {
            traceId,
            fingerprint: fingerprint.fingerprint,
            source
          });
          return result;
        }
      }
    } catch (_error) {
      // Fall back to memory below.
    }
  }

  const directProductRecord = memoryProducts.get(fingerprint.fingerprint);
  const directFormulaRecord = memoryVerifiedFormulas.get(fingerprint.fingerprint);
  if (directProductRecord && directFormulaRecord) {
    const result = toKnowledgeBaseResult({
      inputUrl,
      websiteLabel,
      traceId,
      productRecord: directProductRecord,
      formulaRecord: directFormulaRecord,
      source: "memory"
    });
    await setCachedProductResolution(fingerprint.fingerprint, result);
    logUrlAnalysis("knowledge-base-hit", {
      traceId,
      fingerprint: fingerprint.fingerprint,
      source: "memory"
    });
    return result;
  }

  const aliasFingerprint = resolveMemoryAliasFingerprint(fingerprint);
  if (!aliasFingerprint) {
    return null;
  }

  const aliasProductRecord = memoryProducts.get(aliasFingerprint);
  const aliasFormulaRecord = memoryVerifiedFormulas.get(aliasFingerprint);

  if (!aliasProductRecord || !aliasFormulaRecord) {
    return null;
  }

  const result = toKnowledgeBaseResult({
    inputUrl,
    websiteLabel,
    traceId,
    productRecord: aliasProductRecord,
    formulaRecord: aliasFormulaRecord,
    source: "memory-alias"
  });
  await setCachedProductResolution(fingerprint.fingerprint, result);
  logUrlAnalysis("knowledge-base-hit", {
    traceId,
    fingerprint: fingerprint.fingerprint,
    source: "memory-alias"
  });
  return result;
}

async function ensureIngredientRecords(prisma, ingredientList = []) {
  if (!prisma?.ingredient?.upsert) {
    return;
  }

  for (const ingredientName of ingredientList) {
    const rawSeeded = ingredientCatalog.find((entry) => getLookupKey(entry.name) === getLookupKey(ingredientName));
    const seeded = rawSeeded ? buildSeedIngredientKnowledge(rawSeeded) : null;
    const canonicalName = seeded?.name || ingredientName;

    try {
      const ingredientRecord = await prisma.ingredient.upsert({
        where: {
          name: canonicalName
        },
        update: {},
        create: buildIngredientCreateData({
          ...seeded,
          name: canonicalName,
          scientificName: seeded?.scientificName || null,
          commonNames: seeded?.commonNames || [],
          casNumber: seeded?.casNumber || null,
          category: seeded?.category || null,
          primaryPurpose: seeded?.primaryPurpose || seeded?.simpleExplanation || null,
          purpose: seeded?.purpose || "Unknown",
          displayPurpose: seeded?.displayPurpose || seeded?.purpose || "Unknown",
          howItWorks: seeded?.howItWorks || seeded?.simpleExplanation || null,
          riskLevel: seeded?.riskLevel || "LOW",
          benefits: seeded?.benefits || [],
          sideEffects: seeded?.sideEffects || [],
          suitableSkinTypes: seeded?.suitableSkinTypes || [],
          bestSkinTypes: seeded?.bestSkinTypes || seeded?.suitableSkinTypes || [],
          avoidSkinTypes: seeded?.avoidSkinTypes || [],
          functions: seeded?.functions || [],
          helps: seeded?.helps || [],
          helpsConcerns: seeded?.helpsConcerns || seeded?.helps || [],
          avoidFor: seeded?.avoidFor || [],
          tags: seeded?.tags || [],
          riskFlags: seeded?.riskFlags || [],
          evidenceLevel: seeded?.evidenceLevel || "LIMITED",
          references: seeded?.references || [],
          comedogenicRating: seeded?.comedogenicRating ?? 0,
          irritationScore: seeded?.irritationScore ?? 0,
          simpleExplanation:
            seeded?.simpleExplanation ||
            seeded?.howItWorks ||
            seeded?.primaryPurpose ||
            "Limited evidence: DermIntel verified this ingredient in a product formula but does not yet have a trusted scientific summary for it."
        })
      });

      if (prisma.ingredientAlias?.upsert) {
        for (const alias of seeded?.aliases || []) {
          await prisma.ingredientAlias.upsert({
            where: {
              normalizedAlias: getLookupKey(alias)
            },
            update: {
              alias
            },
            create: {
              ingredientId: ingredientRecord.id,
              alias,
              normalizedAlias: getLookupKey(alias)
            }
          });
        }
      }
    } catch (_error) {
      continue;
    }
  }
}

async function ensureStoreRecord(prisma, website = {}) {
  if (!prisma?.store?.upsert) {
    return null;
  }

  return prisma.store.upsert({
    where: {
      domain: website.websiteKey || website.hostname
    },
    update: {
      name: website.websiteLabel
    },
    create: {
      name: website.websiteLabel,
      domain: website.websiteKey || website.hostname || null
    }
  });
}

async function ensureProductRecord(prisma, { fingerprint, product, website, ingredientsText = "" }) {
  if (!prisma?.product?.upsert) {
    return null;
  }

  return prisma.product.upsert({
    where: {
      fingerprint: fingerprint.fingerprint
    },
    update: {
      name: product.name,
      brand: fingerprint.brand,
      canonicalName: fingerprint.canonicalName,
      variant: fingerprint.variant,
      category: fingerprint.category,
      size: fingerprint.size,
      description: product.description || "",
      imageUrl: product.image || product.imageUrl || null,
      ingredientsText: ingredientsText || "",
      sourceDomain: website.websiteKey || website.hostname || null
    },
    create: {
      name: product.name,
      brand: fingerprint.brand,
      category: fingerprint.category,
      canonicalName: fingerprint.canonicalName,
      variant: fingerprint.variant,
      size: fingerprint.size,
      ingredientsText: ingredientsText || "",
      description: product.description || "",
      imageUrl: product.image || product.imageUrl || null,
      fingerprint: fingerprint.fingerprint,
      sourceDomain: website.websiteKey || website.hostname || null
    }
  });
}

function buildAttemptRows({ resolution, inputUrl, websiteLabel, fingerprint, storeId = null, productId = null, sourceId = null }) {
  const rows = [];
  const processingSteps = Array.isArray(resolution.processingTrace) ? resolution.processingTrace : [];

  for (const step of processingSteps) {
    if (!/searching|checking|lookup|parsing/i.test(step.label)) {
      continue;
    }

    rows.push({
      id: randomUUID(),
      productId,
      sourceId,
      storeId,
      fingerprint: fingerprint.fingerprint,
      stage: step.label,
      url: inputUrl,
      sourceWebsite: websiteLabel,
      extractionMethod: step.label.toLowerCase().replace(/\s+/g, "-"),
      status: step.state === "completed" ? "COMPLETED" : step.state === "failed" ? "FAILED" : "STARTED",
      durationMs: 0,
      candidateCount: 0,
      matchedCount: 0,
      confidenceScore: 0,
      reason: step.details || null,
      createdAt: nowIso()
    });
  }

  for (const attempt of resolution.candidateAttempts || []) {
    rows.push({
      id: randomUUID(),
      productId,
      sourceId,
      storeId,
      fingerprint: fingerprint.fingerprint,
      stage: attempt.stage || "discovery",
      url: attempt.sourceUrl || resolution.sourceUrl || inputUrl,
      sourceWebsite: attempt.sourceWebsite || resolution.sourceWebsite || websiteLabel,
      extractionMethod: attempt.extractionMethod || resolution.extractionMethod || "unknown",
      status: attempt.verified ? "VERIFIED" : "FAILED",
      durationMs: 0,
      candidateCount: attempt.ingredientCount || 0,
      matchedCount: attempt.matchedCount || 0,
      confidenceScore: attempt.confidenceScore || 0,
      reason: attempt.rejectionReason || attempt.verification?.reason || null,
      createdAt: nowIso()
    });
  }

  const seen = new Set();
  return rows.filter((row) => {
    const key = [row.stage, row.url, row.sourceWebsite, row.extractionMethod, row.status, row.reason].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function getRecordedSearchAttemptsForFingerprint(fingerprintKey) {
  return memorySearchAttempts.filter((attempt) => attempt.fingerprint === fingerprintKey);
}

export async function recordResolutionAttempts({ fingerprint, product, resolution, inputUrl, website, traceId }) {
  if (!resolution) {
    return;
  }

  ensureMemorySeeded();

  const prisma = await getPrismaClient();
  let storedProduct = null;
  let storeRecord = null;

  try {
    if (prisma?.product?.upsert && product) {
      storedProduct = await ensureProductRecord(prisma, {
        fingerprint,
        product,
        website,
        ingredientsText: resolution.ingredientsText || ""
      });
    }

    if (prisma?.store?.upsert) {
      storeRecord = await ensureStoreRecord(prisma, website);
    }
  } catch (_error) {
    storedProduct = storedProduct || null;
    storeRecord = storeRecord || null;
  }

  const rows = buildAttemptRows({
    resolution,
    inputUrl,
    websiteLabel: website.websiteLabel,
    fingerprint,
    storeId: storeRecord?.id || null,
    productId: storedProduct?.id || null,
    sourceId: null
  });

  memorySearchAttempts.push(...rows.map((row) => cloneValue(row)));

  if (prisma?.searchAttempt?.createMany && rows.length) {
    try {
      await prisma.searchAttempt.createMany({
        data: rows.map(({ id, createdAt, ...row }) => row)
      });
    } catch (_error) {
      // Memory persistence already completed.
    }
  }

  logUrlAnalysis("knowledge-base-attempts-recorded", {
    traceId,
    fingerprint: fingerprint.fingerprint,
    count: rows.length,
    verifiedIngredients: Boolean(resolution.verifiedIngredients)
  });
}

export async function storeVerifiedKnowledge({
  fingerprint,
  product,
  resolution,
  inputUrl,
  website,
  traceId
}) {
  if (!resolution?.verifiedIngredients) {
    return;
  }

  ensureMemorySeeded();
  const createdAt = nowIso();
  const productRecord = {
    id: randomUUID(),
    fingerprint: fingerprint.fingerprint,
    brand: fingerprint.brand,
    name: product.name,
    canonicalName: product.canonicalName || fingerprint.canonicalName,
    variant: fingerprint.variant,
    category: fingerprint.category,
    size: fingerprint.size,
    sku: product.sku || "",
    description: product.description || "",
    imageUrl: product.image || product.imageUrl || null,
    sourceDomain: website.websiteKey || website.hostname || null,
    ingredientsText: resolution.ingredientsText || "",
    createdAt,
    updatedAt: createdAt
  };

  const formulaRecord = {
    id: randomUUID(),
    productId: productRecord.id,
    fingerprint: fingerprint.fingerprint,
    ingredientsText: resolution.ingredientsText || "",
    ingredientList: resolution.ingredientList || [],
    ingredientCount: resolution.ingredientCount || 0,
    confidenceScore: resolution.confidenceScore || 0,
    sourceUrl: resolution.sourceUrl || inputUrl,
    sourceWebsite: resolution.sourceWebsite || website.websiteLabel,
    extractionMethod: resolution.extractionMethod || "knowledge-base",
    ingredientSource: resolution.ingredientSource || resolution.sourceWebsite || "knowledge-base",
    matchedCount: resolution.matchedCount ?? resolution.ingredientCount ?? 0,
    unknownCount: resolution.unknownCount ?? 0,
    aliasMatchedCount: resolution.aliasMatchedCount ?? 0,
    matchRate: resolution.matchRate ?? 1,
    reason: resolution.message || "Stored from a verified DermIntel discovery.",
    verifiedAt: createdAt,
    createdAt,
    updatedAt: createdAt
  };

  memoryProducts.set(fingerprint.fingerprint, cloneValue(productRecord));
  memoryVerifiedFormulas.set(fingerprint.fingerprint, cloneValue(formulaRecord));
  registerAliases(fingerprint.fingerprint, productRecord);

  const prisma = await getPrismaClient();
  if (prisma?.product?.upsert && prisma?.verifiedFormula?.create) {
    try {
      const storedProduct = await ensureProductRecord(prisma, {
        fingerprint,
        product: productRecord,
        website,
        ingredientsText: productRecord.ingredientsText
      });

      const storeRecord = await ensureStoreRecord(prisma, website);

      let sourceRecord = null;
      if (prisma.source?.create) {
        sourceRecord = await prisma.source.create({
          data: {
            kind: resolution.sourceKind
              ? resolution.sourceKind
              : resolution.extractionMethod?.startsWith("official-site")
                ? "OFFICIAL_BRAND"
                : resolution.extractionMethod?.startsWith("trusted-database")
                  ? "TRUSTED_DATABASE"
                  : resolution.extractionMethod?.startsWith("distributor")
                    ? "PHARMACY"
                    : resolution.extractionMethod === "search-engine-result"
                      ? "SEARCH_ENGINE"
                      : resolution.extractionMethod === "openai-structured-output" || resolution.extractionMethod === "ai-structured-output"
                        ? "AI"
                        : website.websiteType === "official-brand-website"
                          ? "OFFICIAL_BRAND"
                          : "RETAILER",
            label: resolution.sourceWebsite || website.websiteLabel,
            domain: new URL(resolution.sourceUrl || inputUrl).hostname.replace(/^www\./, ""),
            url: resolution.sourceUrl || inputUrl,
            storeId: storeRecord?.id || null,
            productId: storedProduct.id
          }
        });
      }

      let verificationRecord = null;
      if (prisma.verification?.create) {
        verificationRecord = await prisma.verification.create({
          data: {
            status: "VERIFIED",
            confidenceScore: formulaRecord.confidenceScore,
            matchedCount: formulaRecord.matchedCount,
            unknownCount: formulaRecord.unknownCount,
            aliasMatchedCount: formulaRecord.aliasMatchedCount,
            ingredientCount: formulaRecord.ingredientCount,
            rule: "PASSED",
            reason: formulaRecord.reason,
            sourceId: sourceRecord?.id || null
          }
        });
      }

      await prisma.verifiedFormula.create({
        data: {
          productId: storedProduct.id,
          fingerprint: fingerprint.fingerprint,
          ingredientsText: formulaRecord.ingredientsText,
          ingredientList: formulaRecord.ingredientList,
          ingredientCount: formulaRecord.ingredientCount,
          confidenceScore: formulaRecord.confidenceScore,
          sourceId: sourceRecord?.id || null,
          verificationId: verificationRecord?.id || null
        }
      });

      await ensureIngredientRecords(prisma, formulaRecord.ingredientList);
    } catch (_error) {
      // Memory persistence already completed.
    }
  }

  const knowledgeBaseResult = toKnowledgeBaseResult({
    inputUrl,
    websiteLabel: website.websiteLabel,
    traceId,
    productRecord,
    formulaRecord,
    source: "stored"
  });
  await setCachedProductResolution(fingerprint.fingerprint, knowledgeBaseResult);

  logUrlAnalysis("knowledge-base-stored", {
    traceId,
    fingerprint: fingerprint.fingerprint,
    sourceWebsite: resolution.sourceWebsite || website.websiteLabel,
    ingredientCount: resolution.ingredientCount || 0
  });
}

export async function recordKnowledgeBaseMiss({ fingerprint, websiteLabel, traceId }) {
  logUrlAnalysis("knowledge-base-miss", {
    traceId,
    fingerprint: fingerprint.fingerprint,
    websiteLabel
  });
}


