import {
  buildProfileScoringContext,
  deriveIngredientScoringSignals,
  findProfileAllergyHits,
  getSensitivityPenaltyMultiplier
} from "./profile-match-engine.js";

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getWeightFactor(influenceWeight = 1) {
  return Math.max(0.12, Math.min(1, influenceWeight));
}

function uniquePush(target, message) {
  if (message && !target.includes(message)) {
    target.push(message);
  }
}

function resolveIngredientRows(input = []) {
  return Array.isArray(input) ? input : input.ingredientRows || [];
}

function resolveProfile(input = []) {
  return Array.isArray(input) ? {} : input.profile || {};
}

export function calculateSafetyScore(input = []) {
  const ingredientRows = resolveIngredientRows(input);
  const profile = resolveProfile(input);
  const context = buildProfileScoringContext(profile);
  const sensitivityMultiplier = getSensitivityPenaltyMultiplier(context.skinSensitivity);
  let score = 100;
  const explanations = [];
  const ingredientRisks = [];
  const unknownCount = ingredientRows.filter((row) => !row.ingredient).length;

  ingredientRows.forEach((row, index) => {
    const weightFactor = getWeightFactor(row.influenceWeight);

    if (!row.ingredient) {
      const penalty = 2.5 * weightFactor;
      score -= penalty;
      ingredientRisks.push({
        index,
        name: row.displayName,
        penalty,
        reasons: ["DermIntel could not map this ingredient to the current knowledge base."]
      });
      return;
    }

    const ingredient = row.ingredient;
    const signals = deriveIngredientScoringSignals(ingredient);
    const allergyHits = findProfileAllergyHits(signals, context);
    const reasons = [];
    let penalty = 0;

    if (ingredient.riskLevel === "HIGH") {
      penalty += 4 * weightFactor;
    } else if (ingredient.riskLevel === "MEDIUM") {
      penalty += 2 * weightFactor;
    }

    if (ingredient.irritationScore >= 3) {
      penalty += 8 * weightFactor;
      reasons.push(`${row.displayName} raises irritation risk.`);
    } else if (ingredient.irritationScore >= 2) {
      penalty += 4.5 * weightFactor;
    }

    if (context.hasSensitiveSkin && ingredient.irritationScore >= 1) {
      penalty += ingredient.irritationScore * 1.5 * sensitivityMultiplier * weightFactor;
      uniquePush(reasons, `${row.displayName} may stress a sensitive skin barrier.`);
    }

    if (ingredient.comedogenicRating >= 4) {
      penalty += 6 * weightFactor;
      reasons.push(`${row.displayName} has a higher clogging risk.`);
    } else if (ingredient.comedogenicRating >= 2) {
      penalty += 3 * weightFactor;
    }

    if (signals.riskFlags.includes("ALLERGEN")) {
      penalty += 4 * weightFactor;
    }

    if (signals.riskFlags.includes("IRRITANT")) {
      penalty += 3 * weightFactor;
    }

    if (signals.fragranceLike) {
      penalty += 2 * weightFactor;
    }

    if (signals.essentialOilLike) {
      penalty += 3 * weightFactor;
    }

    if (allergyHits.length) {
      penalty += 14 * weightFactor;
      reasons.push(`${row.displayName} overlaps with one of your listed allergy triggers.`);
    }

    score -= penalty;

    if (reasons.length) {
      ingredientRisks.push({
        index,
        name: row.displayName,
        penalty,
        reasons
      });
    }
  });

  score -= Math.min(10, unknownCount * 2);

  ingredientRisks
    .sort((left, right) => right.penalty - left.penalty)
    .forEach((risk) => {
      for (const reason of risk.reasons) {
        uniquePush(explanations, reason);
      }
    });

  return {
    safetyScore: clampScore(score),
    safetyNotes: explanations.slice(0, 5),
    ingredientRisks
  };
}
