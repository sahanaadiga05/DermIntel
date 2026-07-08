import { ingredients, products } from "@/lib/mock-data";

const RISK_PENALTY = {
  LOW: 2,
  MEDIUM: 9,
  HIGH: 18
};

function normalize(value = "") {
  return value.trim().toLowerCase();
}

function clampScore(value, max = 100) {
  return Math.max(0, Math.min(max, Math.round(value)));
}

function lookupIngredient(name) {
  return ingredients.find((ingredient) => ingredient.name === normalize(name));
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

function normalizeProfile(profile) {
  const cosmeticAllergies = (profile.cosmeticAllergies || [])
    .filter((allergy) => allergy !== "NONE" && allergy !== "OTHER")
    .map((allergy) => allergy.toLowerCase().replaceAll("_", " "));

  if (profile.otherAllergy) {
    cosmeticAllergies.push(profile.otherAllergy.toLowerCase());
  }

  return {
    skinType: profile.skinType,
    concerns: profile.primarySkinConcerns || [],
    allergies: cosmeticAllergies
  };
}

export function analyzeInput({ profile, productName, manualIngredients }) {
  const normalizedProfile = normalizeProfile(profile);
  const matchedProduct = products.find(
    (product) => product.name.toLowerCase() === productName.trim().toLowerCase()
  );

  const ingredientNames = matchedProduct
    ? matchedProduct.ingredients
    : manualIngredients
        .split(",")
        .map((entry) => normalize(entry))
        .filter(Boolean);

  const matchedIngredients = ingredientNames.map(lookupIngredient).filter(Boolean);
  const unknownIngredients = ingredientNames.filter(
    (name) => !ingredients.some((ingredient) => ingredient.name === name)
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
      cons.push(`${ingredient.name} may feel too heavy for oily skin.`);
    }

    if (
      normalizedProfile.skinType === "SENSITIVE" &&
      (ingredient.irritationScore >= 2 || ingredient.tags.includes("fragrance"))
    ) {
      suitabilityScore -= 18;
      cons.push(`${ingredient.name} can trigger sensitivity or redness.`);
    }

    if (normalizedProfile.skinType === "DRY" && ingredient.tags.includes("hydrating")) {
      suitabilityScore += 5;
      pros.push(`${ingredient.name} boosts hydration for dry skin.`);
    }

    if (normalizedProfile.concerns.includes("ACNE") && ingredient.tags.includes("anti-acne")) {
      suitabilityScore += 6;
      pros.push(`${ingredient.name} supports acne-focused care.`);
    }

    if (ingredient.suitableSkinTypes.includes(normalizedProfile.skinType)) {
      suitabilityScore += 4;
    }

    if (ingredient.avoidSkinTypes.includes(normalizedProfile.skinType)) {
      suitabilityScore -= 14;
      cons.push(`${ingredient.name} is usually avoided for ${normalizedProfile.skinType.toLowerCase()} skin.`);
    }

    const triggersAllergy = normalizedProfile.allergies.some((allergy) => {
      const compactAllergy = allergy.replaceAll(" ", "");
      return (
        ingredient.name.includes(allergy) ||
        ingredient.name.includes(compactAllergy) ||
        ingredient.tags.includes(allergy)
      );
    });

    if (triggersAllergy) {
      safetyScore -= 8;
      suitabilityScore -= 22;
      cons.push(`${ingredient.name} overlaps with your listed allergy trigger.`);
    }
  });

  if (unknownIngredients.length) {
    safetyScore -= unknownIngredients.length * 6;
    suitabilityScore -= unknownIngredients.length * 4;
    cons.push(
      `${unknownIngredients.length} ingredient${unknownIngredients.length > 1 ? "s are" : " is"} not yet in DermIntel's ingredient intelligence set, so the score is reduced for uncertainty.`
    );
  }

  if (ingredientNames.length >= 10) {
    safetyScore -= Math.min(10, ingredientNames.length - 9);
  }

  if (matchedIngredients.length >= 1) {
    suitabilityScore -= 2;
  }

  const alternatives = products
    .filter((product) => product.name !== matchedProduct?.name)
    .map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category
    }))
    .slice(0, 3);

  return {
    productName: matchedProduct?.name || productName || "Custom Ingredient List",
    matchedIngredients,
    unknownIngredients,
    safetyScore: clampScore(safetyScore, 96),
    suitabilityScore: clampScore(suitabilityScore, 94),
    verdict: buildVerdict(safetyScore, suitabilityScore),
    pros: [...new Set(pros)].slice(0, 3),
    cons: [...new Set(cons)].slice(0, 5),
    alternatives
  };
}
