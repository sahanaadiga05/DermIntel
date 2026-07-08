import { Router } from "express";
import { z } from "zod";
import { ingredientCatalog } from "../data/mock-data.js";
import { findProductByName, searchProducts } from "../lib/scoring.js";
import { resolveProductFromUrl } from "../lib/url-resolver.js";

const router = Router();

const resolveUrlSchema = z.object({
  url: z.string().url()
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

