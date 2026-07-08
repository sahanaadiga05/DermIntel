export const users = [];

export const profiles = [];

export const ingredientCatalog = [
  {
    id: "ing-1",
    name: "glycerin",
    purpose: "Humectant",
    riskLevel: "LOW",
    comedogenicRating: 0,
    irritationScore: 0,
    suitableSkinTypes: ["DRY", "SENSITIVE", "OILY"],
    avoidSkinTypes: [],
    tags: ["hydrating"],
    simpleExplanation: "Helps pull water into the skin and supports moisture balance."
  },
  {
    id: "ing-2",
    name: "niacinamide",
    purpose: "Vitamin B3 active",
    riskLevel: "LOW",
    comedogenicRating: 0,
    irritationScore: 0,
    suitableSkinTypes: ["OILY", "SENSITIVE", "COMBINATION"],
    avoidSkinTypes: [],
    tags: ["anti-acne", "barrier-support"],
    simpleExplanation: "Supports barrier repair and can help calm excess oil."
  },
  {
    id: "ing-3",
    name: "salicylic acid",
    purpose: "BHA exfoliant",
    riskLevel: "MEDIUM",
    comedogenicRating: 0,
    irritationScore: 2,
    suitableSkinTypes: ["OILY", "COMBINATION"],
    avoidSkinTypes: ["SENSITIVE"],
    tags: ["anti-acne", "active"],
    simpleExplanation: "Helps unclog pores, but can be drying for reactive skin."
  },
  {
    id: "ing-4",
    name: "fragrance",
    purpose: "Sensory additive",
    riskLevel: "MEDIUM",
    comedogenicRating: 0,
    irritationScore: 3,
    suitableSkinTypes: [],
    avoidSkinTypes: ["SENSITIVE"],
    tags: ["fragrance", "irritant"],
    simpleExplanation: "Improves scent, but may trigger irritation for sensitive users."
  },
  {
    id: "ing-5",
    name: "alcohol denat",
    purpose: "Solvent",
    riskLevel: "MEDIUM",
    comedogenicRating: 0,
    irritationScore: 3,
    suitableSkinTypes: [],
    avoidSkinTypes: ["SENSITIVE", "DRY"],
    tags: ["drying", "irritant"],
    simpleExplanation: "Makes formulas feel light, though it can weaken the moisture barrier."
  },
  {
    id: "ing-6",
    name: "coconut oil",
    purpose: "Emollient",
    riskLevel: "LOW",
    comedogenicRating: 4,
    irritationScore: 1,
    suitableSkinTypes: ["DRY"],
    avoidSkinTypes: ["OILY"],
    tags: ["heavy-oil", "occlusive"],
    simpleExplanation: "A rich moisturizer that can feel too heavy on breakout-prone skin."
  },
  {
    id: "ing-7",
    name: "ceramide np",
    purpose: "Barrier lipid",
    riskLevel: "LOW",
    comedogenicRating: 0,
    irritationScore: 0,
    suitableSkinTypes: ["DRY", "SENSITIVE"],
    avoidSkinTypes: [],
    tags: ["barrier-support", "hydrating"],
    simpleExplanation: "Reinforces the skin barrier and helps reduce moisture loss."
  },
  {
    id: "ing-8",
    name: "hyaluronic acid",
    purpose: "Humectant",
    riskLevel: "LOW",
    comedogenicRating: 0,
    irritationScore: 0,
    suitableSkinTypes: ["DRY", "SENSITIVE", "OILY"],
    avoidSkinTypes: [],
    tags: ["hydrating"],
    simpleExplanation: "Binds water and improves hydration without heaviness."
  }
];

export const productCatalog = [
  {
    id: "prod-1",
    name: "Cetaphil Moisturizing Cream",
    brand: "Cetaphil",
    category: "Moisturizer",
    ingredientsText: "glycerin, niacinamide, ceramide np, fragrance",
    ingredients: ["glycerin", "niacinamide", "ceramide np", "fragrance"]
  },
  {
    id: "prod-2",
    name: "CeraVe PM Facial Lotion",
    brand: "CeraVe",
    category: "Moisturizer",
    ingredientsText: "glycerin, niacinamide, ceramide np, hyaluronic acid",
    ingredients: ["glycerin", "niacinamide", "ceramide np", "hyaluronic acid"]
  },
  {
    id: "prod-3",
    name: "Minimalist Acne Repair Serum",
    brand: "Minimalist",
    category: "Serum",
    ingredientsText: "niacinamide, salicylic acid, glycerin",
    ingredients: ["niacinamide", "salicylic acid", "glycerin"]
  },
  {
    id: "prod-4",
    name: "Rich Coconut Body Cream",
    brand: "Glow Theory",
    category: "Moisturizer",
    ingredientsText: "coconut oil, fragrance, alcohol denat",
    ingredients: ["coconut oil", "fragrance", "alcohol denat"]
  }
];

