import { z } from "zod";

const EXTENSION_PREFIX = "__DERMINTEL_PROFILE__";

const skinConcernValues = [
  "ACNE",
  "PIGMENTATION",
  "DARK_SPOTS",
  "REDNESS",
  "DRYNESS",
  "EXCESS_OIL",
  "LARGE_PORES",
  "FINE_LINES",
  "WRINKLES",
  "UNEVEN_SKIN_TONE",
  "DULLNESS",
  "DEHYDRATION"
];

const hairConcernValues = [
  "DANDRUFF",
  "HAIR_FALL",
  "DRY_HAIR",
  "FRIZZ",
  "SPLIT_ENDS",
  "OILY_SCALP",
  "ITCHY_SCALP",
  "HAIR_BREAKAGE",
  "THIN_HAIR",
  "COLOR_DAMAGED_HAIR"
];

const allergyValues = [
  "FRAGRANCE",
  "ALCOHOL",
  "ESSENTIAL_OILS",
  "PARABENS",
  "SULFATES",
  "LANOLIN",
  "FORMALDEHYDE_RELEASERS",
  "NONE",
  "OTHER"
];

const skincareGoalValues = [
  "HYDRATION",
  "BRIGHTENING",
  "ACNE_CONTROL",
  "OIL_CONTROL",
  "BARRIER_REPAIR",
  "ANTI_AGING",
  "EVEN_SKIN_TONE",
  "REDUCE_REDNESS",
  "SMOOTH_TEXTURE"
];

const haircareGoalValues = [
  "DANDRUFF_CONTROL",
  "HAIR_GROWTH",
  "FRIZZ_CONTROL",
  "REPAIR_DAMAGE",
  "DEEP_HYDRATION",
  "STRENGTHEN_HAIR",
  "SHINE",
  "SMOOTH_HAIR",
  "VOLUME",
  "SCALP_HEALTH"
];

const avoidIngredientValues = [
  "SULFATES",
  "SILICONES",
  "DRYING_ALCOHOLS",
  "FRAGRANCE",
  "ESSENTIAL_OILS",
  "MINERAL_OIL",
  "PARABENS",
  "NONE",
  "OTHER"
];

function buildStoredExtensions(input = {}) {
  return {
    allergyText: input.cosmeticAllergies?.includes("OTHER") ? input.otherAllergy || null : null,
    scalpType: input.scalpType || null,
    haircareGoals: input.haircareGoals || [],
    avoidIngredients: input.avoidIngredients || [],
    otherAvoidIngredient: input.avoidIngredients?.includes("OTHER") ? input.otherAvoidIngredient || null : null
  };
}

function encodeProfileExtensions(input = {}) {
  const payload = buildStoredExtensions(input);
  return `${EXTENSION_PREFIX}${JSON.stringify(payload)}`;
}

function decodeProfileExtensions(rawValue) {
  if (!rawValue || typeof rawValue !== "string") {
    return {
      otherAllergy: null,
      scalpType: "",
      haircareGoals: [],
      avoidIngredients: [],
      otherAvoidIngredient: ""
    };
  }

  if (!rawValue.startsWith(EXTENSION_PREFIX)) {
    return {
      otherAllergy: rawValue,
      scalpType: "",
      haircareGoals: [],
      avoidIngredients: [],
      otherAvoidIngredient: ""
    };
  }

  try {
    const parsed = JSON.parse(rawValue.slice(EXTENSION_PREFIX.length));
    return {
      otherAllergy: parsed.allergyText || null,
      scalpType: parsed.scalpType || "",
      haircareGoals: Array.isArray(parsed.haircareGoals) ? parsed.haircareGoals : [],
      avoidIngredients: Array.isArray(parsed.avoidIngredients) ? parsed.avoidIngredients : [],
      otherAvoidIngredient: parsed.otherAvoidIngredient || ""
    };
  } catch (_error) {
    return {
      otherAllergy: rawValue,
      scalpType: "",
      haircareGoals: [],
      avoidIngredients: [],
      otherAvoidIngredient: ""
    };
  }
}

export const profileInputSchema = z
  .object({
    skinType: z.enum(["DRY", "OILY", "COMBINATION", "NORMAL", "SENSITIVE"]),
    hairType: z.enum(["STRAIGHT", "WAVY", "CURLY", "COILY"]),
    hairDensity: z.enum(["THIN", "MEDIUM", "THICK"]).optional().default("MEDIUM"),
    scalpType: z.enum(["DRY", "OILY", "NORMAL", "COMBINATION", "SENSITIVE"]),
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
    makeupUsage: z.enum(["NEVER", "OCCASIONALLY", "WEEKLY", "DAILY"]).optional().default("OCCASIONALLY"),
    primarySkincareGoals: z.array(z.enum(skincareGoalValues)).min(1),
    haircareGoals: z.array(z.enum(haircareGoalValues)).min(1),
    avoidIngredients: z.array(z.enum(avoidIngredientValues)).min(1),
    otherAvoidIngredient: z.string().trim().max(120).optional().nullable().default(null),
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

    if (value.avoidIngredients.includes("NONE") && value.avoidIngredients.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose either NONE or specific avoid ingredients, not both.",
        path: ["avoidIngredients"]
      });
    }

    if (value.avoidIngredients.includes("OTHER") && !value.otherAvoidIngredient) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add the ingredient you prefer to avoid when selecting OTHER.",
        path: ["otherAvoidIngredient"]
      });
    }
  });

export function normalizeProfileInput(input) {
  return {
    skinType: input.skinType,
    hairType: input.hairType,
    hairDensity: input.hairDensity || "MEDIUM",
    skinSensitivity: input.skinSensitivity,
    primarySkinConcerns: input.primarySkinConcerns,
    hairConcerns: input.hairConcerns,
    cosmeticAllergies: input.cosmeticAllergies,
    otherAllergy: encodeProfileExtensions(input),
    makeupUsage: input.makeupUsage || "OCCASIONALLY",
    primarySkincareGoals: input.primarySkincareGoals,
    ageGroup: input.ageGroup || null,
    gender: input.gender || null,
    completedAt: new Date().toISOString()
  };
}

export function expandStoredProfile(profile) {
  if (!profile) {
    return null;
  }

  const decoded = decodeProfileExtensions(profile.otherAllergy);

  return {
    ...profile,
    otherAllergy: decoded.otherAllergy,
    scalpType: decoded.scalpType,
    haircareGoals: decoded.haircareGoals,
    avoidIngredients: decoded.avoidIngredients,
    otherAvoidIngredient: decoded.otherAvoidIngredient
  };
}

