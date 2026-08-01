import assert from "node:assert/strict";
import test from "node:test";
import { explainDeterministicResult } from "../src/services/explanation-service.js";

test("phase-3 explanation falls back to deterministic copy when OpenAI is unavailable", async () => {
  const originalKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const result = await explainDeterministicResult({
      result: {
        productName: "Example Barrier Serum",
        score: 84,
        safetyScore: 88,
        suitabilityScore: 81,
        verdict: "Good Match",
        strengths: ["Niacinamide", "Ceramide NP"],
        weaknesses: ["Fragrance"],
        pros: ["Niacinamide supports oil control."],
        cons: ["Fragrance may irritate sensitive skin."]
      },
      profile: {
        skinType: "OILY",
        skinSensitivity: "SLIGHTLY_SENSITIVE",
        concerns: ["ACNE", "PIGMENTATION"],
        goals: ["OIL_CONTROL"],
        avoidIngredients: []
      }
    });

    assert.equal(result.explanationSource, "deterministic-fallback");
    assert.equal(result.explanationModel, null);
    assert.match(result.explanation, /84\/100/);
    assert.match(result.explanation, /Niacinamide/i);
    assert.match(result.explanation, /Fragrance/i);
  } finally {
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }
});
