export function buildVerdict({ safetyScore, suitabilityScore }) {
  if (safetyScore > 85 && suitabilityScore > 85) {
    return "Excellent choice for your profile.";
  }

  if (safetyScore > 85 && suitabilityScore >= 60) {
    return "Safe formula but only partially suited to your skin profile.";
  }

  if (safetyScore < 60) {
    return "Contains several ingredients that may increase irritation or clogging risk.";
  }

  if (suitabilityScore < 60) {
    return "Reasonably safe overall, but not the best fit for your current skin needs.";
  }

  return "A generally balanced formula with some tradeoffs depending on your skin profile.";
}
