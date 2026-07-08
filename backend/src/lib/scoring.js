import { ingredientCatalog, productCatalog } from "../data/mock-data.js";

const RISK_PENALTY = {
  LOW: 2,
  MEDIUM: 9,
  HIGH: 18
};

function normalize(value = "") {
  return value.trim().toLowerCase();
}

function clamp(value, max = 100) {
  return Math.max(0, Math.min(max, Math.round(value)));
}

function normalizeProfile(profile) {
  const allergies = (profile.cosmeticAllergies || [])
    .filter((allergy) => allergy !== "NONE" && allergy !== "OTHER")
    .map((allergy) => allergy.toLowerCase().replaceAll("_", " "));

  if (profile.otherAllergy) {
    allergies.push(profile.otherAllergy.toLowerCase());
  }

  return {
    skinType: profile.skinType,
    concerns: profile.primarySkinConcerns || [],
    allergies
  };
}

function buildVerdict(safetyScore, suitabilityScore) {
  const overall = (safetyScore + suitabilityScore) / 2;

  if (overall >= 82) {
    return "Good fit overall, with only limited concerns.";
  }

  if (overall >= 68) {
    return "Moderate fit. Check the warnings before regular use.";
  }

  if (overall >= 50) {
    return "Risky fit. This formula has multiple profile conflicts.";
  }

  return "Poor fit for this profile. DermIntel would avoid this formula.";
}

export function searchProducts(query = "") {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return productCatalog;
  }

  return productCatalog.filter((product) =>
    `${product.brand} ${product.name}`.toLowerCase().includes(normalizedQuery)
  );
}

export function findProductByName(name = "") {
  return productCatalog.find((product) => product.name.toLowerCase() === normalize(name));
}

export function analyzeFormula({ profile, productName, ingredientsText = "" }) {
  const normalizedProfile = normalizeProfile(profile);
  const matchedProduct = findProductByName(productName);
  const ingredientNames = matchedProduct
    ? matchedProduct.ingredients
    : ingredientsText
        .split(",")
        .map((entry) => normalize(entry))
        .filter(Boolean);

  const matchedIngredients = ingredientNames
    .map((name) => ingredientCatalog.find((ingredient) => ingredient.name === name))
    .filter(Boolean);
  const unknownIngredients = ingredientNames.filter(
    (name) => !ingredientCatalog.some((ingredient) => ingredient.name === name)
  );

  let safetyScore = 88;
  let suitabilityScore = 84;
  const pros = [];
  const cons = [];

  matchedIngredients.forEach((ingredient) => {
    safetyScore -= RISK_PENALTY[ingredient.riskLevel];
    safetyScore -= ingredient.irritationScore * 7;
    safetyScore -= ingredient.comedogenicRating * 5;

    if (normalizedProfile.skinType === "OILY" && ingredient.comedogenicRating >= 3) {
      suitabilityScore -= 18;
      cons.push(`${ingredient.name} may clog pores or feel heavy for oily skin.`);
    }

    if (
      normalizedProfile.skinType === "SENSITIVE" &&
      (ingredient.irritationScore >= 2 || ingredient.tags.includes("fragrance"))
    ) {
      suitabilityScore -= 18;
      cons.push(`${ingredient.name} can irritate sensitive skin.`);
    }

    if (normalizedProfile.skinType === "DRY" && ingredient.tags.includes("hydrating")) {
      suitabilityScore += 5;
      pros.push(`${ingredient.name} helps reinforce hydration.`);
    }

    if (normalizedProfile.concerns.includes("ACNE") && ingredient.tags.includes("anti-acne")) {
      suitabilityScore += 6;
      pros.push(`${ingredient.name} supports acne-focused treatment goals.`);
    }

    if (ingredient.suitableSkinTypes.includes(normalizedProfile.skinType)) {
      suitabilityScore += 4;
    }

    if (ingredient.avoidSkinTypes.includes(normalizedProfile.skinType)) {
      suitabilityScore -= 14;
      cons.push(`${ingredient.name} is commonly avoided for ${normalizedProfile.skinType.toLowerCase()} skin.`);
    }

    const allergyHit = normalizedProfile.allergies.some((allergy) => {
      const compactAllergy = allergy.replaceAll(" ", "");
      return (
        ingredient.name.includes(allergy) ||
        ingredient.name.includes(compactAllergy) ||
        ingredient.tags.includes(allergy)
      );
    });

    if (allergyHit) {
      safetyScore -= 8;
      suitabilityScore -= 22;
      cons.push(`${ingredient.name} overlaps with a recorded allergy trigger.`);
    }
  });

  if (unknownIngredients.length) {
    safetyScore -= unknownIngredients.length * 6;
    suitabilityScore -= unknownIngredients.length * 4;
    cons.push(
      `${unknownIngredients.length} ingredient${unknownIngredients.length > 1 ? "s are" : " is"} not in the current intelligence database, so the score is reduced for uncertainty.`
    );
  }

  if (ingredientNames.length >= 10) {
    safetyScore -= Math.min(10, ingredientNames.length - 9);
  }

  if (matchedIngredients.length >= 1) {
    suitabilityScore -= 2;
  }

  const alternatives = productCatalog
    .filter((product) => product.name !== matchedProduct?.name)
    .slice(0, 3)
    .map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category
    }));

  return {
    product: matchedProduct || null,
    productName: matchedProduct?.name || productName || "Custom Ingredient List",
    analyzedIngredients: matchedIngredients,
    unknownIngredients,
    safetyScore: clamp(safetyScore, 96),
    suitabilityScore: clamp(suitabilityScore, 94),
    verdict: buildVerdict(safetyScore, suitabilityScore),
    pros: [...new Set(pros)].slice(0, 3),
    cons: [...new Set(cons)].slice(0, 5),
    alternatives
  };
}

