import { z } from "zod";

const skinConcernValues = [
  "ACNE",
  "PIGMENTATION",
  "DARK_SPOTS",
  "REDNESS",
  "DRYNESS",
  "EXCESS_OIL",
  "LARGE_PORES",
  "WRINKLES",
  "FINE_LINES",
  "UNEVEN_SKIN_TONE"
];

const hairConcernValues = [
  "HAIR_FALL",
  "DANDRUFF",
  "FRIZZ",
  "DRY_HAIR",
  "SPLIT_ENDS",
  "OILY_SCALP",
  "ITCHY_SCALP",
  "HAIR_BREAKAGE"
];

const allergyValues = [
  "FRAGRANCE",
  "ALCOHOL",
  "PARABENS",
  "SULFATES",
  "ESSENTIAL_OILS",
  "LANOLIN",
  "FORMALDEHYDE_RELEASERS",
  "LATEX",
  "NONE",
  "OTHER"
];

const skincareGoalValues = [
  "HYDRATION",
  "BRIGHTENING",
  "ACNE_CONTROL",
  "OIL_CONTROL",
  "ANTI_AGING",
  "BARRIER_REPAIR",
  "HAIR_GROWTH",
  "HAIR_SMOOTHENING"
];

export const profileInputSchema = z
  .object({
    skinType: z.enum(["DRY", "OILY", "COMBINATION", "NORMAL", "SENSITIVE"]),
    hairType: z.enum(["STRAIGHT", "WAVY", "CURLY", "COILY"]),
    hairDensity: z.enum(["THIN", "MEDIUM", "THICK"]),
    skinSensitivity: z.enum([
      "NOT_SENSITIVE",
      "SLIGHTLY_SENSITIVE",
      "MODERATELY_SENSITIVE",
      "VERY_SENSITIVE"
    ]),
    primarySkinConcerns: z.array(z.enum(skinConcernValues)).min(1),
    hairConcerns: z.array(z.enum(hairConcernValues)).min(1),
    cosmeticAllergies: z.array(z.enum(allergyValues)).min(1),
    otherAllergy: z.string().trim().max(120).optional().nullable().default(null),
    makeupUsage: z.enum(["NEVER", "OCCASIONALLY", "WEEKLY", "DAILY"]),
    primarySkincareGoals: z.array(z.enum(skincareGoalValues)).min(1),
    ageGroup: z
      .enum(["BELOW_18", "AGE_18_25", "AGE_26_35", "AGE_36_45", "ABOVE_45"])
      .optional()
      .nullable()
      .default(null),
    gender: z
      .enum(["FEMALE", "MALE", "PREFER_NOT_TO_SAY", "OTHER"])
      .optional()
      .nullable()
      .default(null)
  })
  .superRefine((value, ctx) => {
    if (value.cosmeticAllergies.includes("NONE") && value.cosmeticAllergies.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose either NONE or specific allergies, not both.",
        path: ["cosmeticAllergies"]
      });
    }

    if (value.cosmeticAllergies.includes("OTHER") && !value.otherAllergy) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add your allergy details when selecting OTHER.",
        path: ["otherAllergy"]
      });
    }
  });

export function normalizeProfileInput(input) {
  return {
    ...input,
    otherAllergy: input.cosmeticAllergies.includes("OTHER") ? input.otherAllergy || null : null,
    ageGroup: input.ageGroup || null,
    gender: input.gender || null,
    completedAt: new Date().toISOString()
  };
}

