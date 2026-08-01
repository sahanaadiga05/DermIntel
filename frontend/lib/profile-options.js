export const SKIN_TYPE_OPTIONS = [
  { value: "DRY", label: "Dry", description: "Often feels tight and benefits from barrier support." },
  { value: "OILY", label: "Oily", description: "Prone to shine, congestion, or excess sebum." },
  { value: "COMBINATION", label: "Combination", description: "Oily in some zones and dry in others." },
  { value: "NORMAL", label: "Normal", description: "Balanced overall with fewer extreme reactions." },
  { value: "SENSITIVE", label: "Sensitive", description: "More reactive to fragrance, actives, or weather." }
];

export const SKIN_SENSITIVITY_OPTIONS = [
  { value: "NOT_SENSITIVE", label: "Not Sensitive", description: "Rarely reacts to new products or actives." },
  { value: "SLIGHTLY_SENSITIVE", label: "Slightly Sensitive", description: "Occasional mild stinging or redness." },
  { value: "MODERATELY_SENSITIVE", label: "Moderately Sensitive", description: "Regular reactions to fragrance or strong formulas." },
  { value: "VERY_SENSITIVE", label: "Very Sensitive", description: "Often reactive and needs extra caution." }
];

export const SKIN_CONCERN_OPTIONS = [
  { value: "ACNE", label: "Acne" },
  { value: "PIGMENTATION", label: "Pigmentation" },
  { value: "DARK_SPOTS", label: "Dark Spots" },
  { value: "REDNESS", label: "Redness" },
  { value: "DRYNESS", label: "Dryness" },
  { value: "EXCESS_OIL", label: "Excess Oil" },
  { value: "LARGE_PORES", label: "Large Pores" },
  { value: "FINE_LINES", label: "Fine Lines" },
  { value: "WRINKLES", label: "Wrinkles" },
  { value: "UNEVEN_SKIN_TONE", label: "Uneven Skin Tone" },
  { value: "DULLNESS", label: "Dullness" },
  { value: "DEHYDRATION", label: "Dehydration" }
];

export const SKINCARE_GOAL_OPTIONS = [
  { value: "HYDRATION", label: "Hydration" },
  { value: "BRIGHTENING", label: "Brightening" },
  { value: "ACNE_CONTROL", label: "Acne Control" },
  { value: "OIL_CONTROL", label: "Oil Control" },
  { value: "BARRIER_REPAIR", label: "Barrier Repair" },
  { value: "ANTI_AGING", label: "Anti-Aging" },
  { value: "EVEN_SKIN_TONE", label: "Even Skin Tone" },
  { value: "REDUCE_REDNESS", label: "Reduce Redness" },
  { value: "SMOOTH_TEXTURE", label: "Smooth Texture" }
];

export const ALLERGY_OPTIONS = [
  { value: "FRAGRANCE", label: "Fragrance" },
  { value: "ALCOHOL", label: "Alcohol" },
  { value: "ESSENTIAL_OILS", label: "Essential Oils" },
  { value: "PARABENS", label: "Parabens" },
  { value: "SULFATES", label: "Sulfates" },
  { value: "LANOLIN", label: "Lanolin" },
  { value: "FORMALDEHYDE_RELEASERS", label: "Formaldehyde Releasers" },
  { value: "NONE", label: "None" },
  { value: "OTHER", label: "Other" }
];

export const HAIR_TYPE_OPTIONS = [
  { value: "STRAIGHT", label: "Straight", description: "Lies flat with minimal curl pattern." },
  { value: "WAVY", label: "Wavy", description: "Soft bends with some natural body." },
  { value: "CURLY", label: "Curly", description: "Defined curl pattern that may need moisture balance." },
  { value: "COILY", label: "Coily", description: "Tight coils that often benefit from richer nourishment." }
];

export const SCALP_TYPE_OPTIONS = [
  { value: "DRY", label: "Dry" },
  { value: "OILY", label: "Oily" },
  { value: "NORMAL", label: "Normal" },
  { value: "COMBINATION", label: "Combination" },
  { value: "SENSITIVE", label: "Sensitive" }
];

export const HAIR_CONCERN_OPTIONS = [
  { value: "DANDRUFF", label: "Dandruff" },
  { value: "HAIR_FALL", label: "Hair Fall" },
  { value: "DRY_HAIR", label: "Dry Hair" },
  { value: "FRIZZ", label: "Frizz" },
  { value: "SPLIT_ENDS", label: "Split Ends" },
  { value: "OILY_SCALP", label: "Oily Scalp" },
  { value: "ITCHY_SCALP", label: "Itchy Scalp" },
  { value: "HAIR_BREAKAGE", label: "Hair Breakage" },
  { value: "THIN_HAIR", label: "Thin Hair" },
  { value: "COLOR_DAMAGED_HAIR", label: "Color-Damaged Hair" }
];

export const HAIRCARE_GOAL_OPTIONS = [
  { value: "DANDRUFF_CONTROL", label: "Dandruff Control" },
  { value: "HAIR_GROWTH", label: "Hair Growth" },
  { value: "FRIZZ_CONTROL", label: "Frizz Control" },
  { value: "REPAIR_DAMAGE", label: "Repair Damage" },
  { value: "DEEP_HYDRATION", label: "Deep Hydration" },
  { value: "STRENGTHEN_HAIR", label: "Strengthen Hair" },
  { value: "SHINE", label: "Shine" },
  { value: "SMOOTH_HAIR", label: "Smooth Hair" },
  { value: "VOLUME", label: "Volume" },
  { value: "SCALP_HEALTH", label: "Scalp Health" }
];

export const AVOID_INGREDIENT_OPTIONS = [
  { value: "SULFATES", label: "Sulfates" },
  { value: "SILICONES", label: "Silicones" },
  { value: "DRYING_ALCOHOLS", label: "Drying Alcohols" },
  { value: "FRAGRANCE", label: "Fragrance" },
  { value: "ESSENTIAL_OILS", label: "Essential Oils" },
  { value: "MINERAL_OIL", label: "Mineral Oil" },
  { value: "PARABENS", label: "Parabens" },
  { value: "NONE", label: "None" },
  { value: "OTHER", label: "Other" }
];

export const HAIR_DENSITY_OPTIONS = [
  { value: "THIN", label: "Thin", description: "Less hair per area and can feel lightweight quickly." },
  { value: "MEDIUM", label: "Medium", description: "Balanced fullness and average coverage." },
  { value: "THICK", label: "Thick", description: "High overall density and fuller coverage." }
];

export const MAKEUP_USAGE_OPTIONS = [
  { value: "NEVER", label: "Never" },
  { value: "OCCASIONALLY", label: "Occasionally" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "DAILY", label: "Daily" }
];

export const AGE_GROUP_OPTIONS = [
  { value: "BELOW_18", label: "Below 18" },
  { value: "AGE_18_25", label: "18-25" },
  { value: "AGE_26_35", label: "26-35" },
  { value: "AGE_36_45", label: "36-45" },
  { value: "ABOVE_45", label: "Above 45" }
];

export const GENDER_OPTIONS = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "PREFER_NOT_TO_SAY", label: "Prefer Not to Say" },
  { value: "OTHER", label: "Other" }
];

export const DEFAULT_PROFILE_FORM = {
  skinType: "",
  skinSensitivity: "",
  primarySkinConcerns: [],
  primarySkincareGoals: [],
  cosmeticAllergies: [],
  otherAllergy: "",
  hairType: "",
  scalpType: "",
  hairConcerns: [],
  haircareGoals: [],
  avoidIngredients: [],
  otherAvoidIngredient: "",
  hairDensity: "MEDIUM",
  makeupUsage: "OCCASIONALLY",
  ageGroup: "",
  gender: ""
};

export const PROFILE_QUESTION_STEPS = [
  {
    field: "skinType",
    type: "single",
    title: "What is your skin type?"
  },
  {
    field: "skinSensitivity",
    type: "single",
    title: "How sensitive is your skin?"
  },
  {
    field: "primarySkinConcerns",
    type: "multi",
    title: "What are your top skin concerns?"
  },
  {
    field: "primarySkincareGoals",
    type: "multi",
    title: "What are your skincare goals?"
  },
  {
    field: "cosmeticAllergies",
    type: "multi",
    title: "Do you have any ingredient allergies or sensitivities?",
    otherField: "otherAllergy",
    otherLabel: "Tell us the ingredient allergy or sensitivity"
  },
  {
    field: "hairType",
    type: "single",
    title: "What best describes your hair type?"
  },
  {
    field: "scalpType",
    type: "single",
    title: "What is your scalp type?"
  },
  {
    field: "hairConcerns",
    type: "multi",
    title: "What are your top hair or scalp concerns?"
  },
  {
    field: "haircareGoals",
    type: "multi",
    title: "What are your haircare goals?"
  },
  {
    field: "avoidIngredients",
    type: "multi",
    title: "Which product ingredients do you prefer to avoid?",
    otherField: "otherAvoidIngredient",
    otherLabel: "Tell us the ingredient you prefer to avoid"
  }
];

export function formatDisplayValue(options, value) {
  return options.find((option) => option.value === value)?.label || value || "";
}

export function formatListValues(options, values = []) {
  return values.map((value) => formatDisplayValue(options, value));
}

