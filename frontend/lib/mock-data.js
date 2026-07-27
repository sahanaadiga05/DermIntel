export const products = [
  {
    id: "prod-1",
    name: "Cetaphil Gentle Skin Cleanser",
    brand: "Cetaphil",
    category: "Face Wash",
    ingredients: [
      "water",
      "glycerin",
      "cetearyl alcohol",
      "panthenol",
      "niacinamide",
      "pantolactone",
      "xanthan gum",
      "sodium cocoyl isethionate",
      "sodium benzoate",
      "citric acid"
    ]
  },
  {
    id: "prod-2",
    name: "Cetaphil Moisturizing Cream",
    brand: "Cetaphil",
    category: "Moisturizer",
    ingredients: ["water", "glycerin", "cetearyl alcohol", "petrolatum", "niacinamide", "ceramide np", "panthenol"]
  },
  {
    id: "prod-3",
    name: "CeraVe PM Facial Lotion",
    brand: "CeraVe",
    category: "Moisturizer",
    ingredients: ["water", "glycerin", "niacinamide", "ceramide np", "hyaluronic acid", "panthenol"]
  },
  {
    id: "prod-4",
    name: "Minimalist Acne Repair Serum",
    brand: "Minimalist",
    category: "Serum",
    ingredients: ["water", "niacinamide", "salicylic acid", "glycerin", "panthenol"]
  },
  {
    id: "prod-5",
    name: "Dove Original Beauty Bar",
    brand: "Dove",
    category: "Body Wash",
    ingredients: ["sodium cocoyl isethionate", "water", "fragrance", "glycerin"]
  }
];

export const recentSearches = [
  "Cetaphil Gentle Skin Cleanser",
  "Cetaphil Moisturizing Cream",
  "Minimalist Acne Repair Serum"
];

export const ingredients = [
  {
    name: "water",
    purpose: "Solvent",
    riskLevel: "LOW",
    benefits: [],
    comedogenicRating: 0,
    irritationScore: 0,
    suitableSkinTypes: ["DRY", "SENSITIVE", "OILY", "COMBINATION", "NORMAL"],
    avoidSkinTypes: [],
    tags: ["base"]
  },
  {
    name: "glycerin",
    purpose: "Humectant",
    riskLevel: "LOW",
    benefits: ["Hydration", "Barrier support"],
    comedogenicRating: 0,
    irritationScore: 0,
    suitableSkinTypes: ["DRY", "SENSITIVE", "OILY", "COMBINATION", "NORMAL"],
    avoidSkinTypes: [],
    tags: ["hydrating"]
  },
  {
    name: "niacinamide",
    purpose: "Vitamin B3 active",
    riskLevel: "LOW",
    benefits: ["Brightening", "Sebum balance"],
    comedogenicRating: 0,
    irritationScore: 0,
    suitableSkinTypes: ["OILY", "SENSITIVE", "COMBINATION", "NORMAL", "DRY"],
    avoidSkinTypes: [],
    tags: ["anti-acne", "barrier-support"]
  },
  {
    name: "salicylic acid",
    purpose: "Exfoliant",
    riskLevel: "MEDIUM",
    benefits: ["Pore care", "Acne support"],
    comedogenicRating: 0,
    irritationScore: 2,
    suitableSkinTypes: ["OILY", "COMBINATION"],
    avoidSkinTypes: ["SENSITIVE"],
    tags: ["anti-acne", "active"]
  },
  {
    name: "fragrance",
    purpose: "Sensory additive",
    riskLevel: "MEDIUM",
    benefits: [],
    comedogenicRating: 0,
    irritationScore: 3,
    suitableSkinTypes: [],
    avoidSkinTypes: ["SENSITIVE"],
    tags: ["fragrance", "irritant"]
  },
  {
    name: "alcohol denat",
    purpose: "Solvent",
    riskLevel: "MEDIUM",
    benefits: ["Lightweight finish"],
    comedogenicRating: 0,
    irritationScore: 3,
    suitableSkinTypes: [],
    avoidSkinTypes: ["SENSITIVE", "DRY"],
    tags: ["irritant", "drying"]
  },
  {
    name: "coconut oil",
    purpose: "Emollient",
    riskLevel: "LOW",
    benefits: ["Softening"],
    comedogenicRating: 4,
    irritationScore: 1,
    suitableSkinTypes: ["DRY"],
    avoidSkinTypes: ["OILY"],
    tags: ["heavy-oil", "occlusive"]
  },
  {
    name: "ceramide np",
    purpose: "Barrier lipid",
    riskLevel: "LOW",
    benefits: ["Barrier repair"],
    comedogenicRating: 0,
    irritationScore: 0,
    suitableSkinTypes: ["DRY", "SENSITIVE"],
    avoidSkinTypes: [],
    tags: ["barrier-support", "hydrating"]
  },
  {
    name: "hyaluronic acid",
    purpose: "Humectant",
    riskLevel: "LOW",
    benefits: ["Hydration"],
    comedogenicRating: 0,
    irritationScore: 0,
    suitableSkinTypes: ["DRY", "SENSITIVE", "OILY"],
    avoidSkinTypes: [],
    tags: ["hydrating"]
  }
];

