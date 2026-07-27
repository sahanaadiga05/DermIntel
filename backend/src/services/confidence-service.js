import { calculateConfidenceScore } from "../lib/formula-analysis/confidence-calculator.js";

export function buildConfidence(payload) {
  return calculateConfidenceScore(payload);
}
