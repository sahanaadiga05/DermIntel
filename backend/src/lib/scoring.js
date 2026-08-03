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

function normalizeProfile(profile = {}) {
  return {
    skinType: profile.skinType,
    skinSensitivity: profile.skinSensitivity || "NOT_SENSITIVE",
    concerns: profile.primarySkinConcerns || profile.concerns || [],
    goals: profile.primarySkincareGoals || profile.goals || [],
    allergyCodes: profile.cosmeticAllergies || profile.allergies || [],
    otherAllergy: profile.otherAllergy || null,
    avoidIngredients: profile.avoidIngredients || [],
    otherAvoidIngredient: profile.otherAvoidIngredient || null
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


function buildStrengthsAndWeaknesses(ingredientInsights = []) {
  const strengths = ingredientInsights
    .filter((entry) => entry.netContribution > 0.8)
    .sort((left, right) => right.netContribution - left.netContribution)
    .slice(0, 3)
    .map((entry) => entry.name);

  const weaknesses = ingredientInsights
    .filter((entry) => entry.netContribution < -0.8)
    .sort((left, right) => left.netContribution - right.netContribution)
    .slice(0, 3)
    .map((entry) => entry.name);

  return { strengths, weaknesses };
}

function toSentenceList(values = []) {
  if (!values.length) {
    return "Not enough profile-specific evidence yet.";
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function formatCodeLabel(value = "") {
  return String(value || "")
    .toLowerCase()
    .replaceAll("_", " ");
}

function buildBenefitsSummary(ingredient = {}) {
  const benefits = Array.isArray(ingredient.benefits)
    ? ingredient.benefits.slice(0, 3)
    : [];
  const functions = Array.isArray(ingredient.functions)
    ? ingredient.functions.slice(0, 3)
    : [];
  const helps = Array.isArray(ingredient.helpsConcerns || ingredient.helps)
    ? (ingredient.helpsConcerns || ingredient.helps).slice(0, 3).map(formatCodeLabel)
    : [];

  if (benefits.length) {
    return benefits.join(" ");
  }

  if (functions.length && helps.length) {
    return `${functions.join(", ")}. Usually helpful for ${toSentenceList(helps)}.`;
  }

  if (functions.length) {
    return functions.join(", ");
  }

  if (helps.length) {
    return `Usually helpful for ${toSentenceList(helps)}.`;
  }

  return ingredient.howItWorks || ingredient.primaryPurpose || ingredient.simpleExplanation || "Benefits unavailable.";
}

function buildProfileReason(insight, ingredient = {}) {
  const positiveReasons = insight?.positiveReasons || [];
  const negativeReasons = insight?.negativeReasons || [];

  if (positiveReasons.length && negativeReasons.length) {
    return `${positiveReasons[0]} The main tradeoff is that ${negativeReasons[0].charAt(0).toLowerCase()}${negativeReasons[0].slice(1)}`;
  }

  if (positiveReasons.length) {
    return positiveReasons[0];
  }

  if (negativeReasons.length) {
    return negativeReasons[0];
  }

  return ingredient.primaryPurpose || ingredient.howItWorks || ingredient.simpleExplanation || "DermIntel did not find a strong profile-specific match signal for this ingredient.";
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
      overallScore: null,
      score: null,
      confidenceScore: 0,
      confidenceDetails: [],
      verdict: null,
      strengths: [],
      weaknesses: [],
      pros: [],
      cons: [],
      message:
        "We couldn't verify the ingredient list for this product. Please paste the ingredients manually or try another source."
    };
  }

  const ingredientRows = buildScoredIngredientRows(verifiedCandidate.ingredientRows || []);
  const matchedIngredients = ingredientRows.filter((row) => row.ingredient).map((row) => row.ingredient);
  const unknownIngredients = ingredientRows
    .filter((row) => !row.ingredient)
    .map((row) => row.normalizedInput);

  const safety = calculateSafetyScore({
    ingredientRows,
    profile: normalizedProfile
  });
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

  const ingredientBreakdown = ingredientRows.map((row, index) => {
    const insight = suitability.ingredientInsights.find((entry) => entry.index === index);
    const ingredient = row.ingredient || null;

    return {
      name: row.displayName,
      estimatedRange: row.estimatedRange,
      purpose: row.purpose,
      riskLevel: row.riskLevel,
      suitability: insight?.fitLabel || "Neutral",
      explanation:
        insight?.positiveReasons?.[0] ||
        insight?.negativeReasons?.[0] ||
        ingredient?.simpleExplanation ||
        "Ingredient role not mapped yet",
      details: {
        purpose: row.purpose,
        whyIncluded:
          ingredient?.primaryPurpose ||
          ingredient?.howItWorks ||
          ingredient?.simpleExplanation ||
          "Limited evidence: DermIntel does not yet have a source-backed explanation for this ingredient.",
        benefits: buildBenefitsSummary(ingredient || {}),
        profileReason: buildProfileReason(insight, ingredient || {}),
        howItWorks:
          ingredient?.howItWorks ||
          ingredient?.simpleExplanation ||
          "Limited evidence: DermIntel does not yet have a source-backed mechanism summary for this ingredient."
      }
    };
  });

  const overallScore = Math.round((safety.safetyScore * 0.45) + (suitability.suitabilityScore * 0.55));
  const verdict = buildVerdict({
    safetyScore: safety.safetyScore,
    suitabilityScore: suitability.suitabilityScore
  });
  const { strengths, weaknesses } = buildStrengthsAndWeaknesses(suitability.ingredientInsights || []);

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
    overallScore,
    score: overallScore,
    confidenceScore: confidence.confidenceScore,
    confidenceDetails: confidence.confidenceDetails,
    verdict,
    strengths,
    weaknesses,
    pros: suitability.positives,
    cons: [...safety.safetyNotes, ...suitability.negatives].slice(0, 5),
    message: "Verified ingredients analyzed deterministically."
  };
}


