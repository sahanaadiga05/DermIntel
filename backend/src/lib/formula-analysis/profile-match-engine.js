const CONCERN_DIMENSION_MAP = {
  ACNE: ["ACNE", "EXCESS_OIL", "LARGE_PORES"],
  PIGMENTATION: ["PIGMENTATION", "DARK_SPOTS", "UNEVEN_SKIN_TONE"],
  DARK_SPOTS: ["DARK_SPOTS", "PIGMENTATION", "UNEVEN_SKIN_TONE"],
  REDNESS: ["REDNESS", "BARRIER_REPAIR"],
  DRYNESS: ["DRYNESS", "HYDRATION", "DEHYDRATION", "BARRIER_REPAIR"],
  EXCESS_OIL: ["EXCESS_OIL", "ACNE", "LARGE_PORES"],
  LARGE_PORES: ["LARGE_PORES", "ACNE", "EXCESS_OIL", "SMOOTH_TEXTURE"],
  FINE_LINES: ["FINE_LINES", "ANTI_AGING", "SMOOTH_TEXTURE"],
  WRINKLES: ["WRINKLES", "ANTI_AGING", "SMOOTH_TEXTURE"],
  UNEVEN_SKIN_TONE: ["UNEVEN_SKIN_TONE", "PIGMENTATION", "DARK_SPOTS"],
  DULLNESS: ["BRIGHTENING", "UNEVEN_SKIN_TONE", "SMOOTH_TEXTURE"],
  DEHYDRATION: ["DEHYDRATION", "HYDRATION", "DRYNESS", "BARRIER_REPAIR"]
};

const GOAL_DIMENSION_MAP = {
  HYDRATION: ["HYDRATION", "DEHYDRATION", "DRYNESS", "BARRIER_REPAIR"],
  BRIGHTENING: ["PIGMENTATION", "DARK_SPOTS", "UNEVEN_SKIN_TONE"],
  ACNE_CONTROL: ["ACNE", "EXCESS_OIL", "LARGE_PORES", "SMOOTH_TEXTURE"],
  OIL_CONTROL: ["EXCESS_OIL", "ACNE", "LARGE_PORES"],
  BARRIER_REPAIR: ["BARRIER_REPAIR", "HYDRATION", "DRYNESS", "DEHYDRATION", "REDNESS"],
  ANTI_AGING: ["ANTI_AGING", "FINE_LINES", "WRINKLES", "SMOOTH_TEXTURE"],
  EVEN_SKIN_TONE: ["UNEVEN_SKIN_TONE", "PIGMENTATION", "DARK_SPOTS"],
  REDUCE_REDNESS: ["REDNESS", "BARRIER_REPAIR"],
  SMOOTH_TEXTURE: ["SMOOTH_TEXTURE", "LARGE_PORES", "FINE_LINES"]
};

const FUNCTION_DIMENSION_MAP = {
  HUMECTANT: ["HYDRATION", "DEHYDRATION", "DRYNESS"],
  BARRIER_SUPPORT: ["BARRIER_REPAIR", "HYDRATION", "DEHYDRATION", "DRYNESS"],
  BARRIER_REPAIR: ["BARRIER_REPAIR", "HYDRATION", "DEHYDRATION", "DRYNESS"],
  WATER_RETENTION_SUPPORT: ["BARRIER_REPAIR", "HYDRATION", "DEHYDRATION", "DRYNESS"],
  SKIN_REPLENISHING: ["HYDRATION", "SMOOTH_TEXTURE", "ANTI_AGING"],
  SKIN_CONDITIONING: ["DRYNESS", "HYDRATION", "BARRIER_REPAIR", "SMOOTH_TEXTURE"],
  SOOTHING: ["REDNESS", "BARRIER_REPAIR"],
  ANTI_INFLAMMATORY: ["REDNESS", "BARRIER_REPAIR", "ACNE"],
  BRIGHTENING: ["PIGMENTATION", "DARK_SPOTS", "UNEVEN_SKIN_TONE"],
  SEBUM_CONTROL: ["EXCESS_OIL", "ACNE", "LARGE_PORES"],
  KERATOLYTIC: ["ACNE", "SMOOTH_TEXTURE", "LARGE_PORES"],
  EXFOLIANT: ["ACNE", "SMOOTH_TEXTURE", "LARGE_PORES", "UNEVEN_SKIN_TONE"],
  COMEDOLYTIC: ["ACNE", "LARGE_PORES", "EXCESS_OIL"],
  ANTIOXIDANT: ["ANTI_AGING", "FINE_LINES", "WRINKLES", "SMOOTH_TEXTURE"],
  ANTIOXIDANT_SUPPORT: ["ANTI_AGING", "FINE_LINES", "WRINKLES", "SMOOTH_TEXTURE"],
  ANTIMICROBIAL_SUPPORT: ["ACNE"],
  EMOLLIENT: ["DRYNESS", "HYDRATION", "BARRIER_REPAIR"],
  OCCLUSIVE: ["DRYNESS", "HYDRATION", "BARRIER_REPAIR"],
  FILM_FORMING: ["HYDRATION", "SMOOTH_TEXTURE"],
  ASTRINGENT: ["EXCESS_OIL", "LARGE_PORES"]
};

const TAG_DIMENSION_MAP = {
  HYDRATING: ["HYDRATION", "DEHYDRATION", "DRYNESS"],
  BARRIER_SUPPORT: ["BARRIER_REPAIR", "HYDRATION", "DEHYDRATION", "DRYNESS"],
  TONE_EVENING: ["PIGMENTATION", "DARK_SPOTS", "UNEVEN_SKIN_TONE"],
  ANTI_ACNE: ["ACNE", "EXCESS_OIL", "LARGE_PORES"],
  OIL_CONTROL: ["EXCESS_OIL", "ACNE"],
  SOOTHING: ["REDNESS", "BARRIER_REPAIR"],
  ANTIOXIDANT: ["ANTI_AGING", "FINE_LINES", "WRINKLES", "SMOOTH_TEXTURE"]
};

const ALLERGY_TRIGGER_MAP = {
  FRAGRANCE: ["FRAGRANCE", "FRAGRANCE_ALLERGY", "PARFUM", "PERFUME"],
  ALCOHOL: ["ALCOHOL", "ALCOHOL_DENAT", "DENATURED_ALCOHOL", "ETHANOL", "DRYING_ALCOHOLS"],
  ESSENTIAL_OILS: ["ESSENTIAL_OILS", "ESSENTIAL_OIL", "ESSENTIAL-OIL"],
  PARABENS: ["PARABENS", "PARABEN"],
  SULFATES: ["SULFATES", "SULFATE", "ALPHA_OLEFIN_SULFONATE", "SODIUM_C14_16_ALPHA_OLEFIN_SULFONATE"],
  LANOLIN: ["LANOLIN"],
  FORMALDEHYDE_RELEASERS: ["FORMALDEHYDE_RELEASERS", "FORMALDEHYDE_RELEASER"]
};

const AVOID_TRIGGER_MAP = {
  FRAGRANCE: ALLERGY_TRIGGER_MAP.FRAGRANCE,
  ESSENTIAL_OILS: ALLERGY_TRIGGER_MAP.ESSENTIAL_OILS,
  PARABENS: ALLERGY_TRIGGER_MAP.PARABENS,
  DRYING_ALCOHOLS: ["ALCOHOL", "ALCOHOL_DENAT", "DENATURED_ALCOHOL", "ETHANOL", "DRYING_ALCOHOLS"],
  SULFATES: ALLERGY_TRIGGER_MAP.SULFATES,
  SILICONES: ["SILICONE", "SILICONES", "DIMETHICONE", "CYCLOPENTASILOXANE"],
  MINERAL_OIL: ["MINERAL_OIL", "MINERAL OIL"],
  OTHER: []
};

const DIMENSION_LABELS = {
  ACNE: "acne support",
  PIGMENTATION: "pigmentation support",
  DARK_SPOTS: "dark spot support",
  UNEVEN_SKIN_TONE: "even tone support",
  REDNESS: "redness support",
  DRYNESS: "dryness support",
  HYDRATION: "hydration support",
  DEHYDRATION: "dehydration support",
  EXCESS_OIL: "oil control support",
  LARGE_PORES: "pore-refining support",
  SMOOTH_TEXTURE: "texture-smoothing support",
  BARRIER_REPAIR: "barrier support",
  ANTI_AGING: "anti-aging support",
  FINE_LINES: "fine line support",
  WRINKLES: "wrinkle support"
};

function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeCode(value = "") {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function normalizeCodeList(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map((value) => normalizeCode(value)).filter(Boolean))];
}

function normalizeCustomTerms(value = "") {
  return String(value || "")
    .split(/[,;]+/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function addMappedDimensions(target, values = [], map = {}) {
  for (const value of values) {
    target.add(value);
    for (const mappedValue of map[value] || []) {
      target.add(mappedValue);
    }
  }
}

function buildDesiredDimensions({ concerns, goals, skinType, skinSensitivity }) {
  const desired = new Set();
  addMappedDimensions(desired, concerns, CONCERN_DIMENSION_MAP);
  addMappedDimensions(desired, goals, GOAL_DIMENSION_MAP);

  if (skinType === "DRY") {
    addMappedDimensions(desired, ["DRYNESS", "HYDRATION", "BARRIER_REPAIR"]);
  }

  if (skinType === "OILY") {
    addMappedDimensions(desired, ["EXCESS_OIL", "ACNE", "LARGE_PORES"]);
  }

  if (skinSensitivity && skinSensitivity !== "NOT_SENSITIVE") {
    addMappedDimensions(desired, ["REDNESS", "BARRIER_REPAIR"]);
  }

  return desired;
}

export function buildProfileScoringContext(profile = {}) {
  const concerns = normalizeCodeList(profile.concerns || profile.primarySkinConcerns || []);
  const goals = normalizeCodeList(profile.goals || profile.primarySkincareGoals || []);
  const allergyCodes = normalizeCodeList(profile.allergyCodes || profile.cosmeticAllergies || profile.allergies || [])
    .filter((code) => code !== "NONE" && code !== "OTHER");
  const avoidIngredients = normalizeCodeList(profile.avoidIngredients || [])
    .filter((code) => code !== "NONE" && code !== "OTHER");
  const skinType = normalizeCode(profile.skinType);
  const skinSensitivity = normalizeCode(profile.skinSensitivity || "NOT_SENSITIVE");

  return {
    skinType,
    skinSensitivity,
    concerns,
    goals,
    allergyCodes,
    avoidIngredients,
    customAllergyTerms: normalizeCustomTerms(profile.otherAllergy),
    customAvoidTerms: normalizeCustomTerms(profile.otherAvoidIngredient),
    desiredDimensions: buildDesiredDimensions({
      concerns,
      goals,
      skinType,
      skinSensitivity
    }),
    prefersNonComedogenic:
      skinType === "OILY" ||
      concerns.includes("ACNE") ||
      concerns.includes("EXCESS_OIL") ||
      goals.includes("ACNE_CONTROL") ||
      goals.includes("OIL_CONTROL"),
    hasSensitiveSkin:
      skinType === "SENSITIVE" ||
      skinSensitivity !== "NOT_SENSITIVE" ||
      concerns.includes("REDNESS")
  };
}

function getEvidenceMultiplier(evidenceLevel = "") {
  switch (normalizeCode(evidenceLevel)) {
    case "HIGH":
      return 1.15;
    case "MODERATE":
      return 1;
    case "MIXED":
      return 0.82;
    case "LOW":
      return 0.75;
    case "REFERENCE":
      return 0.65;
    default:
      return 0.7;
  }
}

function buildLookupCorpus(ingredient = {}) {
  const values = [
    ingredient.name,
    ingredient.inciName,
    ingredient.scientificName,
    ingredient.purpose,
    ingredient.displayPurpose,
    ...(ingredient.aliases || []),
    ...(ingredient.tags || []),
    ...(ingredient.functions || []),
    ...(ingredient.helps || []),
    ...(ingredient.avoidFor || []),
    ...(ingredient.riskFlags || [])
  ].filter(Boolean);

  return {
    lookupCodes: new Set(values.map((value) => normalizeCode(value)).filter(Boolean)),
    lookupText: values.map((value) => normalizeText(value)).join(" ")
  };
}

export function deriveIngredientScoringSignals(ingredient = {}) {
  const helps = normalizeCodeList(ingredient.helps || []);
  const functions = normalizeCodeList(ingredient.functions || []);
  const tags = normalizeCodeList(ingredient.tags || []);
  const avoidFor = normalizeCodeList(ingredient.avoidFor || []);
  const riskFlags = normalizeCodeList(ingredient.riskFlags || []);
  const suitableSkinTypes = normalizeCodeList(ingredient.suitableSkinTypes || ingredient.skinTypes || []);
  const avoidSkinTypes = normalizeCodeList(ingredient.avoidSkinTypes || []);
  const benefitDimensions = new Set();

  addMappedDimensions(benefitDimensions, helps);
  addMappedDimensions(benefitDimensions, functions, FUNCTION_DIMENSION_MAP);
  addMappedDimensions(benefitDimensions, tags, TAG_DIMENSION_MAP);

  return {
    ...buildLookupCorpus(ingredient),
    helps,
    functions,
    tags,
    avoidFor,
    riskFlags,
    suitableSkinTypes,
    avoidSkinTypes,
    benefitDimensions: [...benefitDimensions],
    evidenceLevel: normalizeCode(ingredient.evidenceLevel),
    evidenceMultiplier: getEvidenceMultiplier(ingredient.evidenceLevel),
    soothing:
      functions.includes("SOOTHING") ||
      functions.includes("ANTI_INFLAMMATORY") ||
      tags.includes("SOOTHING") ||
      benefitDimensions.has("REDNESS"),
    fragranceLike:
      tags.includes("FRAGRANCE") ||
      avoidFor.includes("FRAGRANCE_ALLERGY") ||
      riskFlags.includes("ALLERGEN"),
    essentialOilLike: tags.includes("ESSENTIAL_OIL") || tags.includes("ESSENTIAL_OILS")
  };
}

function triggerMatchesSignals(signals, trigger = "") {
  const normalizedCode = normalizeCode(trigger);
  const normalizedText = normalizeText(trigger);

  return (
    (normalizedCode && signals.lookupCodes.has(normalizedCode)) ||
    (normalizedText && signals.lookupText.includes(normalizedText))
  );
}

export function findProfileAllergyHits(signals, context) {
  const hits = [];

  for (const allergyCode of context.allergyCodes || []) {
    const triggers = ALLERGY_TRIGGER_MAP[allergyCode] || [allergyCode];
    if (triggers.some((trigger) => triggerMatchesSignals(signals, trigger))) {
      hits.push(allergyCode);
    }
  }

  for (const customTerm of context.customAllergyTerms || []) {
    if (triggerMatchesSignals(signals, customTerm)) {
      hits.push(customTerm);
    }
  }

  return [...new Set(hits)];
}

export function findAvoidIngredientHits(signals, context) {
  const hits = [];

  for (const avoidCode of context.avoidIngredients || []) {
    const triggers = AVOID_TRIGGER_MAP[avoidCode] || [avoidCode];
    if (triggers.some((trigger) => triggerMatchesSignals(signals, trigger))) {
      hits.push(avoidCode);
    }
  }

  for (const customTerm of context.customAvoidTerms || []) {
    if (triggerMatchesSignals(signals, customTerm)) {
      hits.push(customTerm);
    }
  }

  return [...new Set(hits)];
}

export function getSensitivityPenaltyMultiplier(skinSensitivity = "NOT_SENSITIVE") {
  switch (normalizeCode(skinSensitivity)) {
    case "VERY_SENSITIVE":
      return 1.6;
    case "MODERATELY_SENSITIVE":
      return 1.35;
    case "SLIGHTLY_SENSITIVE":
      return 1.15;
    default:
      return 1;
  }
}

export function getMatchedBenefitDimensions(signals, context) {
  return signals.benefitDimensions.filter((dimension) => context.desiredDimensions.has(dimension));
}

export function describeDimensions(dimensions = []) {
  return dimensions
    .map((dimension) => DIMENSION_LABELS[dimension] || normalizeText(dimension))
    .slice(0, 2)
    .join(" and ");
}
