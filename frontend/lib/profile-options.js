export const SKIN_TYPE_OPTIONS = [
  { value: "DRY", label: "Dry", description: "Often feels tight and benefits from barrier support." },
  { value: "OILY", label: "Oily", description: "Prone to shine, congestion, or excess sebum." },
  { value: "COMBINATION", label: "Combination", description: "Oily in some zones and dry in others." },
  { value: "NORMAL", label: "Normal", description: "Balanced overall with fewer extreme reactions." },
  { value: "SENSITIVE", label: "Sensitive", description: "More reactive to fragrance, actives, or weather." }
];

export const HAIR_TYPE_OPTIONS = [
  { value: "STRAIGHT", label: "Straight", description: "Lies flat with minimal curl pattern." },
  { value: "WAVY", label: "Wavy", description: "Soft bends with some natural body." },
  { value: "CURLY", label: "Curly", description: "Defined curl pattern that may need moisture balance." },
  { value: "COILY", label: "Coily", description: "Tight coils that often benefit from richer nourishment." }
];

export const HAIR_DENSITY_OPTIONS = [
  { value: "THIN", label: "Thin", description: "Less hair per area and can feel lightweight quickly." },
  { value: "MEDIUM", label: "Medium", description: "Balanced fullness and average coverage." },
  { value: "THICK", label: "Thick", description: "High overall density and fuller coverage." }
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
  { value: "WRINKLES", label: "Wrinkles" },
  { value: "FINE_LINES", label: "Fine Lines" },
  { value: "UNEVEN_SKIN_TONE", label: "Uneven Skin Tone" }
];

export const HAIR_CONCERN_OPTIONS = [
  { value: "HAIR_FALL", label: "Hair Fall" },
  { value: "DANDRUFF", label: "Dandruff" },
  { value: "FRIZZ", label: "Frizz" },
  { value: "DRY_HAIR", label: "Dry Hair" },
  { value: "SPLIT_ENDS", label: "Split Ends" },
  { value: "OILY_SCALP", label: "Oily Scalp" },
  { value: "ITCHY_SCALP", label: "Itchy Scalp" },
  { value: "HAIR_BREAKAGE", label: "Hair Breakage" }
];

export const ALLERGY_OPTIONS = [
  { value: "FRAGRANCE", label: "Fragrance" },
  { value: "ALCOHOL", label: "Alcohol" },
  { value: "PARABENS", label: "Parabens" },
  { value: "SULFATES", label: "Sulfates" },
  { value: "ESSENTIAL_OILS", label: "Essential Oils" },
  { value: "LANOLIN", label: "Lanolin" },
  { value: "FORMALDEHYDE_RELEASERS", label: "Formaldehyde Releasers" },
  { value: "LATEX", label: "Latex" },
  { value: "NONE", label: "None" },
  { value: "OTHER", label: "Other" }
];

export const MAKEUP_USAGE_OPTIONS = [
  { value: "NEVER", label: "Never" },
  { value: "OCCASIONALLY", label: "Occasionally" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "DAILY", label: "Daily" }
];

export const SKINCARE_GOAL_OPTIONS = [
  { value: "HYDRATION", label: "Hydration" },
  { value: "BRIGHTENING", label: "Brightening" },
  { value: "ACNE_CONTROL", label: "Acne Control" },
  { value: "OIL_CONTROL", label: "Oil Control" },
  { value: "ANTI_AGING", label: "Anti-Aging" },
  { value: "BARRIER_REPAIR", label: "Barrier Repair" },
  { value: "HAIR_GROWTH", label: "Hair Growth" },
  { value: "HAIR_SMOOTHENING", label: "Hair Smoothening" }
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
  hairType: "",
  hairDensity: "",
  skinSensitivity: "",
  primarySkinConcerns: [],
  hairConcerns: [],
  cosmeticAllergies: [],
  otherAllergy: "",
  makeupUsage: "",
  primarySkincareGoals: [],
  ageGroup: "",
  gender: ""
};

export const PROFILE_QUESTION_STEPS = [
  {
    field: "skinType",
    type: "single",
    title: "What best describes your skin type?",
    description: "This becomes one of the strongest signals in DermIntel's suitability engine."
  },
  {
    field: "hairType",
    type: "single",
    title: "Which hair type feels most accurate today?",
    description: "This helps us keep future scalp and hair recommendations relevant too."
  },
  {
    field: "hairDensity",
    type: "single",
    title: "How would you describe your hair density?",
    description: "Density helps us interpret how rich or lightweight a formula should feel."
  },
  {
    field: "skinSensitivity",
    type: "single",
    title: "How reactive is your skin to new products?",
    description: "We use this to surface irritation warnings earlier and more clearly."
  },
  {
    field: "primarySkinConcerns",
    type: "multi",
    title: "Which skin concerns matter most right now?",
    description: "Choose the issues you want DermIntel to prioritize in its verdicts."
  },
  {
    field: "hairConcerns",
    type: "multi",
    title: "What hair concerns should we keep in mind?",
    description: "These will guide future scalp and haircare suggestions."
  },
  {
    field: "cosmeticAllergies",
    type: "multi",
    title: "Do you avoid any cosmetic triggers or allergens?",
    description: "We will flag formulas that overlap with these watchouts."
  },
  {
    field: "makeupUsage",
    type: "single",
    title: "How often do you wear makeup?",
    description: "This helps us balance ingredient recommendations with real-world habits."
  },
  {
    field: "primarySkincareGoals",
    type: "multi",
    title: "What are your main skincare goals?",
    description: "These goals help us rank products beyond basic safety."
  },
  {
    field: "ageGroup",
    type: "single",
    title: "Which age group do you fall into?",
    description: "Optional. This helps personalize how we frame long-term skin goals.",
    optional: true
  },
  {
    field: "gender",
    type: "single",
    title: "How would you like gender represented on your profile?",
    description: "Optional. You can skip this and continue without affecting analysis quality.",
    optional: true
  }
];

export function formatDisplayValue(options, value) {
  return options.find((option) => option.value === value)?.label || value || "";
}

export function formatListValues(options, values = []) {
  return values.map((value) => formatDisplayValue(options, value));
}

