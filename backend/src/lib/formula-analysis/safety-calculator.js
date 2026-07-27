function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getWeightFactor(influenceWeight = 1) {
  return Math.max(0.12, Math.min(1, influenceWeight));
}

export function calculateSafetyScore(ingredientRows = []) {
  let score = 100;
  const explanations = [];
  const unknownCount = ingredientRows.filter((row) => !row.ingredient).length;

  for (const row of ingredientRows) {
    const weightFactor = getWeightFactor(row.influenceWeight);

    if (!row.ingredient) {
      score -= 2 * weightFactor;
      continue;
    }

    if (row.ingredient.irritationScore >= 3) {
      score -= 8 * weightFactor;
      explanations.push(`${row.displayName} raises irritation risk.`);
    } else if (row.ingredient.irritationScore >= 2) {
      score -= 4 * weightFactor;
    }

    if (row.ingredient.comedogenicRating >= 4) {
      score -= 6 * weightFactor;
      explanations.push(`${row.displayName} has a higher clogging risk.`);
    } else if (row.ingredient.comedogenicRating >= 2) {
      score -= 3 * weightFactor;
    }

    if (row.ingredient.riskFlags?.includes("allergen")) {
      score -= 8 * weightFactor;
    }

    if (row.ingredient.tags?.includes("fragrance")) {
      score -= 2 * weightFactor;
    }

    if (row.ingredient.tags?.includes("essential-oil")) {
      score -= 3 * weightFactor;
    }
  }

  score -= Math.min(10, unknownCount * 2);

  return {
    safetyScore: clampScore(score),
    safetyNotes: [...new Set(explanations)].slice(0, 4)
  };
}
