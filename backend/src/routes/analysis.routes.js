import { Router } from "express";
import { z } from "zod";
import { scoreVerifiedFormula } from "../services/scoring-service.js";

const router = Router();

const analysisProfileSchema = z.object({
  skinType: z.enum(["DRY", "OILY", "SENSITIVE", "COMBINATION", "NORMAL"]),
  skinSensitivity: z
    .enum(["NOT_SENSITIVE", "SLIGHTLY_SENSITIVE", "MODERATELY_SENSITIVE", "VERY_SENSITIVE"])
    .optional()
    .default("NOT_SENSITIVE"),
  primarySkinConcerns: z.array(z.string()).default([]),
  primarySkincareGoals: z.array(z.string()).default([]),
  cosmeticAllergies: z.array(z.string()).default([]),
  otherAllergy: z.string().optional().nullable().default(null)
});

const analysisSchema = z.object({
  productName: z.string().optional().default(""),
  ingredientsText: z.string().optional().default(""),
  profile: analysisProfileSchema
});

router.post("/", async (request, response, next) => {
  try {
    const payload = analysisSchema.parse(request.body);
    const result = await scoreVerifiedFormula(payload);
    response.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
