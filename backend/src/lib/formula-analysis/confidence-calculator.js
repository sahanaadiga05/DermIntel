function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateConfidenceScore({ sourceMeta = {}, ingredientRows = [] }) {
  let confidence = 40;
  const explanations = [];
  const sourceWebsite = sourceMeta.sourceWebsite?.toLowerCase() || "";
  const brandKey = sourceMeta.brand?.toLowerCase().trim() || "";

  if (sourceMeta.extractionMethod?.startsWith("official-site") || (brandKey && sourceWebsite.includes(brandKey))) {
    confidence += 30;
    explanations.push("Official manufacturer ingredient list found");
  } else if (sourceMeta.extractionMethod === "html" || sourceMeta.extractionMethod === "playwright") {
    confidence += 18;
    explanations.push("Ingredient list extracted directly from the product page");
  }

  const normalizedMatches = ingredientRows.filter((row) => row.matchType !== "unknown").length;
  const total = ingredientRows.length || 1;
  const matchRate = normalizedMatches / total;

  if (matchRate >= 0.9) {
    confidence += 20;
    explanations.push(`${Math.round(matchRate * 100)}% ingredient match`);
  } else if (matchRate >= 0.7) {
    confidence += 12;
    explanations.push(`${Math.round(matchRate * 100)}% ingredient match`);
  }

  explanations.push("Concentration estimated from ingredient order");

  const unknownCount = ingredientRows.filter((row) => row.matchType === "unknown").length;
  confidence -= unknownCount * 5;

  if (sourceMeta.extractionMethod === "ocr") {
    confidence -= 10;
  }

  if (sourceMeta.sourceWebsite && !sourceMeta.extractionMethod?.startsWith("official-site") && !brandKey) {
    confidence -= 4;
  }

  return {
    confidenceScore: clampScore(confidence),
    confidenceDetails: explanations
  };
}
