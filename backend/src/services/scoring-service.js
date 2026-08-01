import { analyzeFormula } from "../lib/scoring.js";
import { explainDeterministicResult } from "./explanation-service.js";

function normalizeExplanationProfile(profile = {}) {
  return {
    skinType: profile.skinType || null,
    skinSensitivity: profile.skinSensitivity || "NOT_SENSITIVE",
    concerns: profile.primarySkinConcerns || profile.concerns || [],
    goals: profile.primarySkincareGoals || profile.goals || [],
    avoidIngredients: profile.avoidIngredients || []
  };
}

export async function scoreVerifiedFormula(payload) {
  const result = await analyzeFormula(payload);

  if (!result?.verifiedIngredients) {
    return result;
  }

  const explanationResult = await explainDeterministicResult({
    result,
    profile: normalizeExplanationProfile(payload.profile || {})
  });

  return {
    ...result,
    explanation: explanationResult.explanation,
    explanationSource: explanationResult.explanationSource,
    explanationModel: explanationResult.explanationModel,
    message: "Deterministic scoring completed. Explanation generated afterward."
  };
}
