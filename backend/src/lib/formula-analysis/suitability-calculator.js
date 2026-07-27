function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniquePush(target, message) {
  if (message && !target.includes(message)) {
    target.push(message);
  }
}

export function calculateSuitabilityScore({ ingredientRows = [], profile }) {
  let score = 70;
  const positives = [];
  const negatives = [];
  const allergies = (profile.allergies || []).map((item) => item.toLowerCase());

  for (const row of ingredientRows) {
    const ingredient = row.ingredient;
    const weight = row.influenceWeight || 0.2;

    if (!ingredient) {
      continue;
    }

    if ((profile.goals || []).includes("HYDRATION") && ingredient.tags?.includes("hydrating")) {
      score += 5 * weight;
      uniquePush(positives, `${row.displayName} supports hydration.`);
    }

    if ((profile.goals || []).includes("BARRIER_REPAIR") && ingredient.tags?.includes("barrier-support")) {
      score += 4 * weight;
      uniquePush(positives, `${row.displayName} supports the skin barrier.`);
    }

    if ((profile.concerns || []).includes("ACNE") && ingredient.tags?.includes("anti-acne")) {
      score += 6 * weight;
      uniquePush(positives, `${row.displayName} helps acne-prone skin.`);
    }

    if (profile.skinSensitivity !== "NOT_SENSITIVE" && ingredient.tags?.includes("soothing")) {
      score += 4 * weight;
      uniquePush(positives, `${row.displayName} adds soothing support.`);
    }

    if (ingredient.avoidSkinTypes?.includes(profile.skinType)) {
      score -= 6 * weight;
      uniquePush(negatives, `${row.displayName} is not ideal for ${profile.skinType.toLowerCase()} skin.`);
    }

    if (profile.skinType === "OILY" && ingredient.comedogenicRating >= 4) {
      score -= 8 * weight;
      uniquePush(negatives, `${row.displayName} may feel too heavy for oily skin.`);
    }

    if (profile.skinSensitivity !== "NOT_SENSITIVE" && ingredient.irritationScore >= 2) {
      score -= 10 * weight;
      uniquePush(negatives, `${row.displayName} may irritate sensitive skin.`);
    }

    const allergyHit = allergies.some((allergy) =>
      row.displayName.toLowerCase().includes(allergy) || ingredient.tags?.includes(allergy)
    );
    if (allergyHit) {
      score -= 15 * weight;
      uniquePush(negatives, `${row.displayName} overlaps with one of your allergy triggers.`);
    }
  }

  return {
    suitabilityScore: clampScore(score),
    positives: positives.slice(0, 4),
    negatives: negatives.slice(0, 5)
  };
}
