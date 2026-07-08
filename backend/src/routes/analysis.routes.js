import { Router } from "express";
import { z } from "zod";
import { analyzeFormula } from "../lib/scoring.js";

const router = Router();

const analysisProfileSchema = z.object({
  skinType: z.enum(["DRY", "OILY", "SENSITIVE", "COMBINATION", "NORMAL"]),
  primarySkinConcerns: z.array(z.string()).default([]),
  cosmeticAllergies: z.array(z.string()).default([]),
  otherAllergy: z.string().optional().nullable().default(null)
});

const analysisSchema = z.object({
  productName: z.string().optional().default(""),
  ingredientsText: z.string().optional().default(""),
  profile: analysisProfileSchema
});

router.post("/", (request, response, next) => {
  try {
    const payload = analysisSchema.parse(request.body);
    const result = analyzeFormula(payload);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;

