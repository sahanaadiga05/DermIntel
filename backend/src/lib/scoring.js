import { productCatalog } from "../data/mock-data.js";
import { verifyIngredientCandidate } from "./url-analysis/ingredient-verifier.js";
import { calculateConfidenceScore } from "./formula-analysis/confidence-calculator.js";
import { estimateConcentration } from "./formula-analysis/concentration-estimator.js";
import { calculateSafetyScore } from "./formula-analysis/safety-calculator.js";
import { calculateSuitabilityScore } from "./formula-analysis/suitability-calculator.js";
import { buildVerdict } from "./formula-analysis/verdict-builder.js";

function normalize(value = "") {
  return value.trim().toLowerCase();
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
    skinSensitivity: profile.skinSensitivity || "NOT_SENSITIVE",
    concerns: profile.primarySkinConcerns || [],
    goals: profile.primarySkincareGoals || [],
    allergies
  };
}

function buildScoredIngredientRows(ingredientRows = []) {
  return ingredientRows.map((row, index) => {
    const displayName = row.ingredient?.name || row.canonicalName || row.normalizedInput;
    const concentration = estimateConcentration(index, displayName);

    return {
      rawName: row.rawName,
      normalizedInput: row.normalizedInput,
      displayName,
      ingredient: row.ingredient,
      matchType: row.matchType,
      estimatedRange: concentration.estimatedRange,
      influenceWeight: concentration.influenceWeight,
      estimationReason: concentration.estimationReason,
      purpose:
        row.ingredient?.displayPurpose ||
        row.ingredient?.purpose ||
        "Ingredient role not mapped yet",
      riskLevel: row.ingredient?.riskLevel || "UNKNOWN"
    };
  });
}

function buildAlternatives(matchedProduct) {
  return productCatalog
    .filter((product) => product.name !== matchedProduct?.name)
    .slice(0, 3)
    .map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category
    }));
}

export function searchProducts(query = "") {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return productCatalog;
  }

  return productCatalog.filter((product) =>
    `${product.brand} ${product.name} ${product.category}`.toLowerCase().includes(normalizedQuery)
  );
}

export function findProductByName(name = "") {
  return productCatalog.find((product) => product.name.toLowerCase() === normalize(name));
}

export async function analyzeFormula({ profile, productName, ingredientsText = "" }) {
  const matchedProduct = findProductByName(productName);
  const normalizedProfile = normalizeProfile(profile);

  const candidate = matchedProduct
    ? {
        sourceUrl: "catalog://product",
        sourceWebsite: matchedProduct.brand,
        stage: "catalog",
        extractionMethod: "catalog-verified",
        ingredientSource: "catalog",
        rawExtractedIngredients: matchedProduct.ingredientsText,
        parsedIngredientList: matchedProduct.ingredients,
        metadata: {},
        product: matchedProduct
      }
    : {
        sourceUrl: "manual://ingredients",
        sourceWebsite: "Manual Input",
        stage: "manual",
        extractionMethod: "manual-input",
        ingredientSource: "manual",
        rawExtractedIngredients: ingredientsText,
        parsedIngredientList: [],
        metadata: {}
      };

  const verifiedCandidate = await verifyIngredientCandidate(candidate, {
    productName: matchedProduct?.name || productName || "Custom Ingredient List",
    brand: matchedProduct?.brand || "Manual Input",
    minIngredientCount: 8
  });

  if (!verifiedCandidate.verified) {
    return {
      status: "NO_VERIFIED_INGREDIENTS",
      verifiedIngredients: false,
      product: matchedProduct || null,
      productName: matchedProduct?.name || productName || "Custom Ingredient List",
      matchedIngredients: [],
      analyzedIngredients: [],
      unknownIngredients: verifiedCandidate.parsedIngredientList || [],
      ingredientBreakdown: [],
      ingredientEstimateDisclaimer: null,
      safetyScore: null,
      suitabilityScore: null,
      confidenceScore: 0,
      confidenceDetails: [],
      verdict: null,
      pros: [],
      cons: [],
      alternatives: [],
      message:
        "We couldn't verify the ingredient list for this product. Please paste the ingredients manually or try another source."
    };
  }

  const ingredientRows = buildScoredIngredientRows(verifiedCandidate.ingredientRows || []);
  const matchedIngredients = ingredientRows.filter((row) => row.ingredient).map((row) => row.ingredient);
  const unknownIngredients = ingredientRows
    .filter((row) => !row.ingredient)
    .map((row) => row.normalizedInput);

  const safety = calculateSafetyScore(ingredientRows);
  const suitability = calculateSuitabilityScore({
    ingredientRows,
    profile: normalizedProfile
  });
  const confidence = calculateConfidenceScore({
    sourceMeta: {
      sourceWebsite: verifiedCandidate.sourceWebsite || matchedProduct?.brand || "Manual Input",
      extractionMethod: verifiedCandidate.extractionMethod || (matchedProduct ? "catalog-verified" : "manual-input"),
      brand: matchedProduct?.brand || verifiedCandidate.sourceWebsite || ""
    },
    ingredientRows
  });

  const ingredientBreakdown = ingredientRows.map((row) => ({
    name: row.displayName,
    estimatedRange: row.estimatedRange,
    purpose: row.purpose,
    riskLevel: row.riskLevel,
    suitability:
      row.ingredient?.avoidSkinTypes?.includes(normalizedProfile.skinType)
        ? "Low Match"
        : row.ingredient?.suitableSkinTypes?.includes(normalizedProfile.skinType)
          ? "Good Match"
          : "Neutral",
    explanation: row.ingredient?.simpleExplanation || "Ingredient role not mapped yet"
  }));

  const verdict = buildVerdict({
    safetyScore: safety.safetyScore,
    suitabilityScore: suitability.suitabilityScore
  });

  return {
    status: "VERIFIED_INGREDIENTS_FOUND",
    verifiedIngredients: true,
    product: matchedProduct || null,
    productName: matchedProduct?.name || productName || "Custom Ingredient List",
    matchedIngredients,
    analyzedIngredients: matchedIngredients,
    unknownIngredients,
    ingredientBreakdown,
    ingredientEstimateDisclaimer: "Estimated from ingredient order-not actual concentration.",
    safetyScore: safety.safetyScore,
    suitabilityScore: suitability.suitabilityScore,
    confidenceScore: confidence.confidenceScore,
    confidenceDetails: confidence.confidenceDetails,
    verdict,
    pros: suitability.positives,
    cons: [...safety.safetyNotes, ...suitability.negatives].slice(0, 5),
    alternatives: buildAlternatives(matchedProduct),
    message: "Verified ingredients analyzed successfully."
  };
}
