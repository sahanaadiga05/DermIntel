import { getCachedUrlResolution, setCachedUrlResolution } from "./cache-manager.js";
import { getKnowledgeBaseResolution, recordKnowledgeBaseMiss, recordResolutionAttempts, storeVerifiedKnowledge } from "./knowledge-base/product-knowledge-base.js";
import { createProductFingerprint } from "./knowledge-base/product-fingerprint.js";
import { createPipelineContext } from "./url-analysis/logger.js";
import { resolveIngredientsForProduct } from "../services/ingredient-resolver.js";
import { resolveProductMetadata } from "../services/product-resolver.js";

export async function resolveProductFromUrl(inputUrl) {
  const cached = await getCachedUrlResolution(inputUrl);
  if (cached) {
    return {
      ...cached,
      cacheHit: true,
      processingTrace: [
        {
          label: "Cache lookup",
          state: "completed",
          details: "Returning a cached verified result."
        },
        ...(cached.processingTrace || [])
      ]
    };
  }

  const context = await createPipelineContext();
  const metadata = await resolveProductMetadata(inputUrl, context);
  const fingerprint = createProductFingerprint(metadata.product);
  const knowledgeBaseHit = await getKnowledgeBaseResolution({
    fingerprint,
    inputUrl,
    websiteLabel: metadata.website.websiteLabel,
    traceId: context.traceId
  });

  if (knowledgeBaseHit) {
    const result = {
      ...knowledgeBaseHit,
      cacheHit: knowledgeBaseHit.cacheHit || false,
      processingTrace: [
        ...(metadata.processingTrace || []),
        ...(knowledgeBaseHit.processingTrace || [])
      ]
    };

    await setCachedUrlResolution(inputUrl, result);
    return result;
  }

  await recordKnowledgeBaseMiss({
    fingerprint,
    websiteLabel: metadata.website.websiteLabel,
    traceId: context.traceId
  });

  const resolution = await resolveIngredientsForProduct(
    {
      inputUrl,
      ...metadata,
      fingerprint
    },
    context
  );

  await recordResolutionAttempts({
    fingerprint,
    product: resolution.product || metadata.product,
    resolution,
    inputUrl,
    website: metadata.website,
    traceId: context.traceId
  });

  if (resolution?.verifiedIngredients) {
    await storeVerifiedKnowledge({
      fingerprint,
      product: resolution.product || metadata.product,
      resolution,
      inputUrl,
      website: metadata.website,
      traceId: context.traceId
    });
  }

  await setCachedUrlResolution(inputUrl, resolution);
  return resolution;
}

