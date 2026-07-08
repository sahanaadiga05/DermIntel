export const products = [
  {
    id: "prod-1",
    name: "Cetaphil Moisturizing Cream",
    brand: "Cetaphil",
    category: "Moisturizer",
    ingredients: ["glycerin", "niacinamide", "ceramide np", "fragrance"]
  },
  {
    id: "prod-2",
    name: "CeraVe PM Facial Lotion",
    brand: "CeraVe",
    category: "Moisturizer",
    ingredients: ["glycerin", "niacinamide", "ceramide np", "hyaluronic acid"]
  },
  {
    id: "prod-3",
    name: "Minimalist Acne Repair Serum",
    brand: "Minimalist",
    category: "Serum",
    ingredients: ["niacinamide", "salicylic acid", "glycerin"]
  },
  {
    id: "prod-4",
    name: "Rich Coconut Body Cream",
    brand: "Glow Theory",
    category: "Moisturizer",
    ingredients: ["coconut oil", "fragrance", "alcohol denat"]
  }
];

export const recentSearches = [
  "Cetaphil Moisturizing Cream",
  "Minimalist Acne Repair Serum",
  "CeraVe PM Facial Lotion"
];

export const ingredients = [
  {
    name: "glycerin",
    purpose: "Humectant",
    riskLevel: "LOW",
    benefits: ["Hydration", "Barrier support"],
    comedogenicRating: 0,
    irritationScore: 0,
    suitableSkinTypes: ["DRY", "SENSITIVE", "OILY"],
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
    suitableSkinTypes: ["OILY", "SENSITIVE", "COMBINATION"],
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
    avoidSkinTypes: ["OILY", "ACNE"],
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

