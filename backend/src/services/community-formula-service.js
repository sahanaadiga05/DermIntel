import { randomUUID } from "node:crypto";
import { getKnowledgeBaseResolution, storeVerifiedKnowledge } from "../lib/knowledge-base/product-knowledge-base.js";
import { createProductFingerprint } from "../lib/knowledge-base/product-fingerprint.js";
import { createPipelineContext, logUrlAnalysis } from "../lib/url-analysis/logger.js";
import { enrichProductIdentity } from "../lib/url-analysis/search-utils.js";
import { verifyIngredientList } from "../lib/url-analysis/ingredient-verifier.js";
import { normalizeProductName } from "../lib/product-normalizer.js";
import { resolveProductMetadata } from "./product-resolver.js";
import { extractIngredientsFromLabelImage, parseIngredientsFromCommunityText } from "./ocr-service.js";

let prismaClientPromise;
const memoryCommunitySubmissions = new Map();

function createStep(label, state, details = "") {
  return { label, state, details };
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

function normalizeCommunityProduct(product = {}) {
  return enrichProductIdentity({
    name: normalizeProductName(product.name || product.productName || "Community Product"),
    brand: normalizeProductName(product.brand || ""),
    category: normalizeProductName(product.category || "Product"),
    variant: normalizeProductName(product.variant || ""),
    size: normalizeProductName(product.size || ""),
    description: product.description || "",
    image: product.image || product.imageUrl || ""
  });
}

async function resolveSubmissionProduct(payload, context) {
  if (payload.url) {
    const resolved = await resolveProductMetadata(payload.url, context);
    return {
      inputUrl: payload.url,
      website: resolved.website,
      product: resolved.product,
      metadataTrace: resolved.processingTrace || []
    };
  }

  const product = normalizeCommunityProduct(payload.product || {});
  return {
    inputUrl: "",
    website: {
      websiteLabel: "Community Upload",
      websiteKey: "community-upload",
      hostname: "community-upload",
      websiteType: "community"
    },
    product,
    metadataTrace: [
      createStep("Product identification", "completed", `Using community-provided product metadata for ${product.brand} ${product.name}.`)
    ]
  };
}

async function persistCommunitySubmission(record) {
  memoryCommunitySubmissions.set(record.id, record);
  const prisma = await getPrismaClient();
  if (!prisma?.communityFormulaSubmission?.create) {
    return record;
  }

  try {
    return await prisma.communityFormulaSubmission.create({
      data: {
        productId: record.productId || null,
        fingerprint: record.fingerprint,
        submittedBy: record.submittedBy || null,
        sourceUrl: record.sourceUrl || null,
        imageUrl: record.imageUrl || null,
        rawOcrText: record.rawOcrText || null,
        extractedIngredientsText: record.extractedIngredientsText || null,
        ingredientList: record.ingredientList || [],
        extractionMethod: record.extractionMethod || null,
        verificationStatus: record.verificationStatus,
        reviewStatus: record.reviewStatus,
        reviewNotes: record.reviewNotes || null,
        confidenceScore: record.confidenceScore || 0,
        verifiedFormulaId: record.verifiedFormulaId || null
      }
    });
  } catch (_error) {
    return record;
  }
}

async function updateCommunitySubmission(submissionId, update) {
  const existing = memoryCommunitySubmissions.get(submissionId);
  if (existing) {
    memoryCommunitySubmissions.set(submissionId, {
      ...existing,
      ...update,
      updatedAt: new Date().toISOString()
    });
  }

  const prisma = await getPrismaClient();
  if (!prisma?.communityFormulaSubmission?.update) {
    return memoryCommunitySubmissions.get(submissionId) || null;
  }

  try {
    return await prisma.communityFormulaSubmission.update({
      where: {
        id: submissionId
      },
      data: update
    });
  } catch (_error) {
    return memoryCommunitySubmissions.get(submissionId) || null;
  }
}

export async function submitCommunityFormula(payload, options = {}) {
  const context = options.traceId ? { ...(await createPipelineContext({ traceId: options.traceId })) } : await createPipelineContext();
  const processingTrace = [];
  const resolved = await resolveSubmissionProduct(payload, context);
  processingTrace.push(...resolved.metadataTrace);

  const fingerprint = createProductFingerprint(resolved.product);
  processingTrace.push(
    createStep("Product fingerprint", "completed", `Generated fingerprint for ${fingerprint.brand} | ${fingerprint.canonicalName}.`)
  );

  const existingKnowledge = await getKnowledgeBaseResolution({
    fingerprint,
    inputUrl: resolved.inputUrl || payload.url || "",
    websiteLabel: resolved.website.websiteLabel,
    traceId: context.traceId
  });

  if (existingKnowledge) {
    return {
      submissionId: null,
      submissionStatus: "ALREADY_VERIFIED",
      communityReviewStatus: "AUTO_VERIFIED",
      ...existingKnowledge,
      processingTrace: [...processingTrace, ...(existingKnowledge.processingTrace || [])],
      message: "This product already has a verified formula in DermIntel's knowledge base."
    };
  }

  let rawOcrText = "";
  let extractedIngredientsText = parseIngredientsFromCommunityText(payload.ingredientsText || "");
  let extractionMethod = payload.ingredientsText ? "community-manual-text" : "";

  if (!extractedIngredientsText && (payload.imageBase64 || payload.imageUrl)) {
    const ocrResult = await extractIngredientsFromLabelImage({
      imageBase64: payload.imageBase64 || "",
      imageUrl: payload.imageUrl || ""
    });
    rawOcrText = ocrResult.rawText || "";
    extractedIngredientsText = ocrResult.extractedIngredientsText || "";
    extractionMethod = ocrResult.provider && ocrResult.provider !== "none"
      ? `community-ocr:${ocrResult.provider}`
      : "community-ocr-unavailable";
    processingTrace.push(
      createStep(
        "OCR extraction",
        extractedIngredientsText ? "completed" : "failed",
        extractedIngredientsText
          ? `Extracted ingredient label text using ${ocrResult.provider}.`
          : "No ingredient text could be extracted from the uploaded label image."
      )
    );
  } else {
    processingTrace.push(
      createStep(
        "OCR extraction",
        extractedIngredientsText ? "completed" : "failed",
        extractedIngredientsText
          ? "Using community-submitted ingredient text."
          : "No community ingredient text or readable label image was provided."
      )
    );
  }

  if (!extractedIngredientsText) {
    const error = new Error("We couldn't read an ingredient list from the uploaded content.");
    error.statusCode = 422;
    error.details = {
      failureCode: "OCR_REQUIRED"
    };
    error.processingTrace = processingTrace;
    throw error;
  }

  const verification = await verifyIngredientList({
    ingredientsText: extractedIngredientsText,
    sourceWebsite: "Community Verified Formula",
    extractionMethod: extractionMethod || "community-upload",
    productName: resolved.product.name,
    brand: resolved.product.brand,
    minIngredientCount: 8
  });

  processingTrace.push(
    createStep(
      "Community verification",
      verification.verified ? "completed" : "failed",
      verification.reason
    )
  );

  const submissionId = randomUUID();
  const baseSubmissionRecord = {
    id: submissionId,
    productId: null,
    fingerprint: fingerprint.fingerprint,
    submittedBy: payload.submittedBy || null,
    sourceUrl: resolved.inputUrl || payload.url || null,
    imageUrl: payload.imageUrl || null,
    rawOcrText: rawOcrText || null,
    extractedIngredientsText,
    ingredientList: verification.ingredientList || [],
    extractionMethod: extractionMethod || "community-upload",
    verificationStatus: verification.verified ? "VERIFIED" : "FAILED",
    reviewStatus: verification.verified ? "AUTO_VERIFIED" : "PENDING_REVIEW",
    reviewNotes: verification.verified ? "Automatically verified from community contribution." : verification.reason,
    confidenceScore: verification.confidenceScore || 0,
    verifiedFormulaId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await persistCommunitySubmission(baseSubmissionRecord);

  if (!verification.verified) {
    const error = new Error("The uploaded ingredient label could not be verified automatically.");
    error.statusCode = 422;
    error.details = {
      failureCode: verification.rule || "VERIFICATION_FAILED",
      submissionId,
      submissionStatus: "PENDING_REVIEW",
      communityReviewStatus: "PENDING_REVIEW",
      verification
    };
    error.processingTrace = processingTrace;
    throw error;
  }

  const syntheticResolution = {
    status: "VERIFIED_INGREDIENTS_FOUND",
    verifiedIngredients: true,
    sourceUrl: payload.imageUrl || resolved.inputUrl || "",
    sourceWebsite: "Community Verified Formula",
    extractionMethod: extractionMethod || "community-upload",
    ingredientSource: "community-verified-formula",
    confidenceScore: verification.confidenceScore || 0,
    ingredientsText: verification.ingredientsText,
    ingredientList: verification.ingredientList,
    ingredientCount: verification.ingredientCount,
    matchedCount: verification.matchedCount,
    unknownCount: verification.unknownCount,
    aliasMatchedCount: verification.aliasMatchedCount,
    matchRate: verification.matchRate,
    candidateAttempts: [],
    processingTrace,
    message: "Stored from a community-verified ingredient label upload.",
    sourceKind: "COMMUNITY",
    product: resolved.product
  };

  await storeVerifiedKnowledge({
    fingerprint,
    product: resolved.product,
    resolution: syntheticResolution,
    inputUrl: resolved.inputUrl || payload.url || "",
    website: resolved.website,
    traceId: context.traceId
  });

  await updateCommunitySubmission(submissionId, {
    reviewStatus: "AUTO_VERIFIED",
    reviewNotes: "Automatically verified and stored in knowledge base."
  });

  const knowledgeBaseResolution = await getKnowledgeBaseResolution({
    fingerprint,
    inputUrl: resolved.inputUrl || payload.url || "",
    websiteLabel: resolved.website.websiteLabel,
    traceId: context.traceId
  });

  logUrlAnalysis("community-formula-stored", {
    traceId: context.traceId,
    submissionId,
    fingerprint: fingerprint.fingerprint,
    brand: resolved.product.brand,
    productName: resolved.product.name
  });

  return {
    submissionId,
    submissionStatus: "VERIFIED_AND_STORED",
    communityReviewStatus: "AUTO_VERIFIED",
    ...(knowledgeBaseResolution || syntheticResolution),
    processingTrace: [...processingTrace, ...(knowledgeBaseResolution?.processingTrace || [])],
    message: "Community verified formula stored successfully. Future users can now reuse this formula instantly."
  };
}

export async function reviewCommunityFormula(submissionId, { decision, reviewNotes = "" } = {}) {
  const prisma = await getPrismaClient();
  let submission = memoryCommunitySubmissions.get(submissionId) || null;

  if (prisma?.communityFormulaSubmission?.findUnique) {
    try {
      submission = await prisma.communityFormulaSubmission.findUnique({
        where: {
          id: submissionId
        }
      }) || submission;
    } catch (_error) {
      submission = submission || null;
    }
  }

  if (!submission) {
    const error = new Error("Community formula submission not found.");
    error.statusCode = 404;
    throw error;
  }

  const nextStatus = decision === "APPROVED" ? "APPROVED" : "REJECTED";
  const updated = await updateCommunitySubmission(submissionId, {
    reviewStatus: nextStatus,
    reviewNotes: reviewNotes || (nextStatus === "APPROVED" ? "Approved by reviewer." : "Rejected by reviewer.")
  });

  return {
    submissionId,
    submissionStatus: updated?.verificationStatus || submission.verificationStatus,
    communityReviewStatus: nextStatus,
    reviewNotes: updated?.reviewNotes || reviewNotes || null
  };
}
