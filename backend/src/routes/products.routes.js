import { Router } from "express";
import { z } from "zod";
import { ingredientCatalog } from "../data/mock-data.js";
import { findProductByName, searchProducts } from "../lib/scoring.js";
import { resolveProductFromUrl } from "../lib/url-resolver.js";
import { reviewCommunityFormula, submitCommunityFormula } from "../services/community-formula-service.js";

const router = Router();

const resolveUrlSchema = z.object({
  url: z.string().url()
});

const communityProductSchema = z.object({
  brand: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  variant: z.string().optional().default(""),
  size: z.string().optional().default(""),
  description: z.string().optional().default(""),
  imageUrl: z.string().optional().default("")
});

const communityFormulaSchema = z.object({
  url: z.string().url().optional(),
  product: communityProductSchema.optional(),
  ingredientsText: z.string().optional().default(""),
  imageBase64: z.string().optional().default(""),
  imageUrl: z.string().optional().default(""),
  submittedBy: z.string().optional().default("")
}).superRefine((value, ctx) => {
  if (!value.url && !value.product) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide either a product URL or community product metadata."
    });
  }

  if (!value.ingredientsText && !value.imageBase64 && !value.imageUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide ingredient text or an ingredient label image."
    });
  }
});

const communityReviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  reviewNotes: z.string().optional().default("")
});

router.get("/", (request, response) => {
  const { query } = request.query;
  const products = searchProducts(query);

  response.json({ products });
});

router.post("/resolve-url", async (request, response, next) => {
  try {
    const payload = resolveUrlSchema.parse(request.body);
    const resolution = await resolveProductFromUrl(payload.url);
    response.json(resolution);
  } catch (error) {
    if (error.details?.processingTrace) {
      error.processingTrace = error.details.processingTrace;
    }
    next(error);
  }
});

router.post("/community-formula", async (request, response, next) => {
  try {
    const payload = communityFormulaSchema.parse(request.body);
    const result = await submitCommunityFormula(payload);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

router.patch("/community-formula/:submissionId/review", async (request, response, next) => {
  try {
    const payload = communityReviewSchema.parse(request.body);
    const result = await reviewCommunityFormula(request.params.submissionId, payload);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/:name", (request, response) => {
  const product = findProductByName(request.params.name);

  if (!product) {
    return response.status(404).json({ message: "Product not found." });
  }

  return response.json({
    product,
    ingredients: product.ingredients
      .map((name) => ingredientCatalog.find((ingredient) => ingredient.name === name))
      .filter(Boolean)
  });
});

export default router;
