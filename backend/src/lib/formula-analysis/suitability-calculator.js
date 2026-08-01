import {
  buildProfileScoringContext,
  deriveIngredientScoringSignals,
  describeDimensions,
  findAvoidIngredientHits,
  findProfileAllergyHits,
  getMatchedBenefitDimensions,
  getSensitivityPenaltyMultiplier
} from "./profile-match-engine.js";

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniquePush(target, message) {
  if (message && !target.includes(message)) {
    target.push(message);
  }
}

function formatCodeLabel(value = "") {
  return String(value || "")
    .toLowerCase()
    .replaceAll("_", " ");
}

function getWeightFactor(influenceWeight = 0.2) {
  return Math.max(0.12, Math.min(1, influenceWeight));
}

function buildFitLabel(netContribution, negativeReasons = []) {
  if (netContribution <= -2 || negativeReasons.length >= 2) {
    return "Low Match";
  }

  if (netContribution >= 2) {
    return "Good Match";
  }

  return "Neutral";
}

function collectTopMessages(pool = [], limit = 4) {
  const sorted = [...pool].sort((left, right) => right.impact - left.impact);
  const messages = [];

  for (const entry of sorted) {
    uniquePush(messages, entry.message);
    if (messages.length >= limit) {
      break;
    }
  }

  return messages;
}

export function calculateSuitabilityScore({ ingredientRows = [], profile }) {
  const context = buildProfileScoringContext(profile || {});
  const sensitivityMultiplier = getSensitivityPenaltyMultiplier(context.skinSensitivity);
  let score = 60;
  let unknownCount = 0;
  const positivePool = [];
  const negativePool = [];
  const ingredientInsights = [];

  ingredientRows.forEach((row, index) => {
    const ingredient = row.ingredient;
    const weight = getWeightFactor(row.influenceWeight);

    if (!ingredient) {
      unknownCount += 1;
      ingredientInsights.push({
        index,
        name: row.displayName,
        netContribution: 0,
        fitLabel: "Neutral",
        matchedBenefits: [],
        positiveReasons: [],
        negativeReasons: ["DermIntel has limited knowledge for this ingredient."]
      });
      return;
    }

    const signals = deriveIngredientScoringSignals(ingredient);
    const matchedBenefits = getMatchedBenefitDimensions(signals, context);
    const allergyHits = findProfileAllergyHits(signals, context);
    const avoidHits = findAvoidIngredientHits(signals, context);
    const positiveReasons = [];
    const negativeReasons = [];
    let positive = 0;
    let negative = 0;

    if (matchedBenefits.length) {
      const contribution = Math.min(4, matchedBenefits.length) * 2.4 * weight * signals.evidenceMultiplier;
      positive += contribution;
      positiveReasons.push(`${row.displayName} supports ${describeDimensions(matchedBenefits)}.`);
    }

    if (signals.suitableSkinTypes.includes(context.skinType)) {
      positive += 2 * weight;
      uniquePush(positiveReasons, `${row.displayName} is generally compatible with ${formatCodeLabel(context.skinType)} skin.`);
    }

    if (context.hasSensitiveSkin && signals.soothing) {
      positive += 2.5 * weight * signals.evidenceMultiplier;
      uniquePush(positiveReasons, `${row.displayName} adds soothing support for reactive skin.`);
    }

    if (
      context.skinType === "DRY" &&
      matchedBenefits.some((value) => ["HYDRATION", "DEHYDRATION", "DRYNESS", "BARRIER_REPAIR"].includes(value))
    ) {
      positive += 1.8 * weight;
    }

    if (
      context.skinType === "OILY" &&
      matchedBenefits.some((value) => ["ACNE", "EXCESS_OIL", "LARGE_PORES"].includes(value))
    ) {
      positive += 1.8 * weight;
    }

    if (signals.evidenceLevel === "HIGH" && matchedBenefits.length) {
      positive += 0.9 * weight;
    } else if (signals.evidenceLevel === "MODERATE" && matchedBenefits.length) {
      positive += 0.35 * weight;
    }

    if (signals.avoidSkinTypes.includes(context.skinType)) {
      negative += 8 * weight;
      negativeReasons.push(`${row.displayName} is not ideal for ${formatCodeLabel(context.skinType)} skin.`);
    }

    if (context.prefersNonComedogenic) {
      if (ingredient.comedogenicRating >= 4) {
        negative += 8 * weight;
        negativeReasons.push(`${row.displayName} may feel too heavy or clog-prone for your profile.`);
      } else if (ingredient.comedogenicRating >= 2) {
        negative += 3.5 * weight;
      }
    }

    if (context.hasSensitiveSkin && ingredient.irritationScore >= 2) {
      negative += 5.5 * weight * sensitivityMultiplier;
      negativeReasons.push(`${row.displayName} may irritate sensitive skin.`);
    } else if (context.hasSensitiveSkin && signals.fragranceLike) {
      negative += 3.5 * weight * sensitivityMultiplier;
      negativeReasons.push(`${row.displayName} can be challenging for sensitive skin.`);
    }

    if (allergyHits.length) {
      negative += 16 * weight;
      negativeReasons.push(`${row.displayName} overlaps with one of your allergy triggers.`);
    }

    if (avoidHits.length) {
      negative += 10 * weight;
      negativeReasons.push(`${row.displayName} matches one of the ingredients you prefer to avoid.`);
    }

    const netContribution = Number((positive - negative).toFixed(2));
    score += netContribution;

    ingredientInsights.push({
      index,
      name: row.displayName,
      netContribution,
      fitLabel: buildFitLabel(netContribution, negativeReasons),
      matchedBenefits,
      evidenceLevel: signals.evidenceLevel,
      positiveReasons,
      negativeReasons
    });

    for (const message of positiveReasons) {
      positivePool.push({ message, impact: positive, name: row.displayName });
    }

    for (const message of negativeReasons) {
      negativePool.push({ message, impact: negative, name: row.displayName });
    }
  });

  score -= Math.min(6, unknownCount * 1.5);

  return {
    suitabilityScore: clampScore(score),
    positives: collectTopMessages(positivePool, 5),
    negatives: collectTopMessages(negativePool, 5),
    ingredientInsights
  };
}
