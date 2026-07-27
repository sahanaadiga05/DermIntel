import { analyzeFormula } from "../lib/scoring.js";

export async function scoreVerifiedFormula(payload) {
  return analyzeFormula(payload);
}
