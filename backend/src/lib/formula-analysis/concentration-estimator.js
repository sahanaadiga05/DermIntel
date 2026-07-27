const POSITION_RANGES = [
  { min: 0, max: 2, range: "10-50%", weight: 1 },
  { min: 3, max: 5, range: "5-15%", weight: 0.8 },
  { min: 6, max: 9, range: "2-8%", weight: 0.6 },
  { min: 10, max: 19, range: "0.5-3%", weight: 0.35 },
  { min: 20, max: Number.POSITIVE_INFINITY, range: "0.1-1%", weight: 0.18 }
];

const LOW_CONCENTRATION_CUTOFF = new Set(["fragrance", "phenoxyethanol", "sodium benzoate", "citric acid"]);

export function estimateConcentration(index, ingredientName = "") {
  const normalizedName = ingredientName.toLowerCase();
  const base = POSITION_RANGES.find((entry) => index >= entry.min && index <= entry.max) || POSITION_RANGES[POSITION_RANGES.length - 1];

  if (index >= 10 && LOW_CONCENTRATION_CUTOFF.has(normalizedName)) {
    return {
      estimatedRange: "<0.5%",
      influenceWeight: 0.12,
      estimationReason: "Estimated from ingredient order-not actual concentration."
    };
  }

  return {
    estimatedRange: base.range,
    influenceWeight: base.weight,
    estimationReason: "Estimated from ingredient order-not actual concentration."
  };
}
