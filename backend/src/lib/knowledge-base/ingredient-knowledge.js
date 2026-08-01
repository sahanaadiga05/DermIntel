import { ingredientKnowledgeOverrides } from "../../data/ingredient-knowledge-overrides.js";

const CONCERN_BENEFIT_MAP = {
  ACNE: "Helps reduce acne congestion.",
  PIGMENTATION: "Supports a more even-looking tone.",
  DARK_SPOTS: "Targets the look of dark spots.",
  DRYNESS: "Helps relieve dryness.",
  DEHYDRATION: "Helps reduce dehydration.",
  HYDRATION: "Helps keep skin hydrated.",
  FINE_LINES: "Supports smoother-looking skin.",
  WRINKLES: "Supports softer-looking wrinkle lines.",
  REDNESS: "Helps calm visible redness.",
  EXCESS_OIL: "Helps manage excess oil.",
  LARGE_PORES: "Supports a more refined-looking pore appearance.",
  UNEVEN_SKIN_TONE: "Supports more even-looking skin tone.",
  SENSITIVE_SKIN: "Can suit sensitive-feeling skin when tolerated.",
  SENSITIVE: "Can suit sensitive-feeling skin when tolerated.",
  BARRIER_DAMAGE: "Supports a weakened skin barrier.",
  BARRIER_REPAIR: "Supports the skin barrier.",
  ANTI_AGING: "Supports anti-aging goals.",
  SMOOTH_TEXTURE: "Helps improve surface texture."
};

const FUNCTION_BENEFIT_MAP = {
  HUMECTANT: "Draws water into the outer skin layers.",
  EMOLLIENT: "Softens and smooths the skin surface.",
  OCCLUSIVE: "Helps reduce transepidermal water loss.",
  SURFACTANT: "Helps lift oil and debris during cleansing.",
  PRESERVATIVE: "Helps keep the formula microbiologically stable.",
  PRESERVATIVE_BOOSTER: "Supports preservative performance.",
  ANTIOXIDANT: "Helps defend against oxidative stress.",
  ANTIOXIDANT_SUPPORT: "Helps defend against oxidative stress.",
  CHELATING_AGENT: "Helps improve formula stability.",
  SOLVENT: "Helps dissolve or carry other ingredients.",
  CONDITIONING_AGENT: "Helps improve skin feel.",
  SKIN_CONDITIONING: "Helps improve skin feel.",
  FILM_FORMING: "Forms a light film that helps reduce moisture loss.",
  THICKENER: "Improves product texture and viscosity.",
  VISCOSITY_CONTROLLING: "Improves product texture and viscosity.",
  STABILIZER: "Helps keep the formula uniform and stable.",
  PH_ADJUSTER: "Helps keep the formula in an effective pH range.",
  BOTANICAL_EXTRACT: "Adds plant-derived support to the formula.",
  ACTIVE_INGREDIENT: "Provides a direct treatment role in the formula.",
  BARRIER_SUPPORT: "Supports the skin barrier.",
  BARRIER_REPAIR: "Supports the skin barrier.",
  BRIGHTENING: "Supports a brighter, more even-looking complexion.",
  SEBUM_CONTROL: "Helps regulate excess oil.",
  KERATOLYTIC: "Helps loosen buildup on the skin surface.",
  EXFOLIANT: "Helps remove surface buildup for smoother skin.",
  COMEDOLYTIC: "Helps reduce clogged pores.",
  ANTI_INFLAMMATORY: "Helps calm inflammatory-looking skin changes.",
  SOOTHING: "Helps calm discomfort and visible irritation.",
  WATER_RETENTION_SUPPORT: "Supports water retention in the skin.",
  SKIN_REPLENISHING: "Helps replenish the feel of dehydrated skin.",
  TEXTURE_MODIFIER: "Improves product spreadability and feel.",
  EMULSION_STABILIZER: "Helps oil and water phases stay mixed.",
  ASTRINGENT: "Helps reduce the feeling of oiliness.",
  FOAMING: "Supports foam generation during cleansing.",
  CLEANSING: "Helps cleanse the skin or scalp.",
  COOLING_AGENT: "Creates a cooling sensory effect.",
  COUNTER_IRRITANT: "Creates a counter-irritant sensory effect.",
  PENETRATION_ENHANCER: "Can help other ingredients spread or penetrate more easily.",
  ANTIMICROBIAL_SUPPORT: "Provides antimicrobial support.",
  PH_ADJUSTING: "Helps keep the formula in an effective pH range."
};

function normalizeTextValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeLookupKey(value = "") {
  return normalizeTextValue(value)
    .toLowerCase()
    .replace(/[\u2122\u00AE\u00A9]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+(?:\.\d+)?%\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTextArray(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values
    .map((value) => {
      if (typeof value === "string") {
        return value.trim();
      }

      if (value && typeof value === "object") {
        return normalizeTextValue(value.alias || value.label || value.name || value.url || value.reference || "");
      }

      return "";
    })
    .filter(Boolean))];
}

function normalizeReferenceList(values = []) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed ? { citation: trimmed } : null;
      }

      if (value && typeof value === "object") {
        const title = normalizeTextValue(value.title || "");
        const citation = normalizeTextValue(value.citation || title || value.reference || value.url || "");
        const url = normalizeTextValue(value.url || "");
        const source = normalizeTextValue(value.source || "");
        const evidenceType = normalizeTextValue(value.evidenceType || "");

        if (!citation && !url) {
          return null;
        }

        return {
          ...(title ? { title } : {}),
          ...(citation ? { citation } : {}),
          ...(url ? { url } : {}),
          ...(source ? { source } : {}),
          ...(evidenceType ? { evidenceType } : {})
        };
      }

      return null;
    })
    .filter(Boolean);
}

function splitPurposeIntoFunctions(value = "") {
  const normalized = normalizeTextValue(value)
    .replace(/[\u2013\u2014]/g, "|")
    .replace(/[\uFFFD\u2022]/g, "|")
    .replace(/\s*\/\s*/g, "|")
    .replace(/\s+\|\s+/g, "|")
    .replace(/\s+-\s+/g, "|");

  if (!normalized) {
    return [];
  }

  return [...new Set(normalized
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean))];
}

function normalizeEvidenceLevel(value) {
  const normalized = normalizeTextValue(value).toUpperCase();

  switch (normalized) {
    case "HIGH":
      return "HIGH";
    case "MODERATE":
      return "MODERATE";
    case "LOW":
    case "MIXED":
    case "REFERENCE":
    case "LIMITED":
      return "LIMITED";
    default:
      return null;
  }
}

function getOverrideForIngredient(name = "") {
  const key = normalizeLookupKey(name);

  return ingredientKnowledgeOverrides[key] || null;
}

function toSentenceCase(value = "") {
  const trimmed = normalizeTextValue(value);
  if (!trimmed) {
    return "";
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function normalizeBenefitStatement(value = "") {
  const statement = toSentenceCase(value);
  if (!statement) {
    return "";
  }

  return /[.!?]$/.test(statement) ? statement : `${statement}.`;
}

function formatCodeLabel(value = "") {
  return normalizeTextValue(value)
    .toLowerCase()
    .replace(/_/g, " ");
}

function deriveCategory(rawIngredient = {}, functions = [], displayPurpose = "") {
  return (
    normalizeTextValue(rawIngredient.category || rawIngredient.classification || "") ||
    normalizeTextValue(functions[0] || "") ||
    normalizeTextValue(splitPurposeIntoFunctions(displayPurpose)[0] || "") ||
    normalizeTextValue(displayPurpose || "") ||
    "Unknown"
  );
}

function deriveCommonNames(rawIngredient = {}, aliases = [], scientificName = "") {
  const explicit = normalizeTextArray(rawIngredient.commonNames || []);
  if (explicit.length) {
    return explicit;
  }

  const derived = [...new Set([
    ...aliases,
    scientificName
  ].filter(Boolean))];

  return derived;
}

function deriveBenefits(rawIngredient = {}, functions = [], helpsConcerns = [], displayPurpose = "") {
  const explicit = normalizeTextArray(rawIngredient.benefits || []).map(normalizeBenefitStatement).filter(Boolean);
  if (explicit.length) {
    return explicit;
  }

  const derived = [];

  for (const concern of helpsConcerns) {
    const mapped = CONCERN_BENEFIT_MAP[normalizeLookupKey(concern).toUpperCase().replace(/[^A-Z0-9]+/g, "_")];
    if (mapped) {
      derived.push(mapped);
    }
  }

  for (const fn of functions) {
    const mapped = FUNCTION_BENEFIT_MAP[normalizeLookupKey(fn).toUpperCase().replace(/[^A-Z0-9]+/g, "_")];
    if (mapped) {
      derived.push(mapped);
    }
  }

  if (!derived.length && displayPurpose) {
    derived.push(`${toSentenceCase(displayPurpose)} role in the formula.`);
  }

  return [...new Set(derived.map(normalizeBenefitStatement).filter(Boolean))];
}

function derivePrimaryPurpose(rawIngredient = {}, displayPurpose = "", benefits = [], category = "") {
  return (
    normalizeTextValue(rawIngredient.primaryPurpose || "") ||
    normalizeTextValue(rawIngredient.simpleExplanation || "") ||
    normalizeTextValue(benefits[0] || "") ||
    normalizeTextValue(displayPurpose || category || "") ||
    "Limited evidence: DermIntel does not yet have a source-backed purpose summary for this ingredient."
  );
}

function deriveHowItWorks(rawIngredient = {}, primaryPurpose = "") {
  return (
    normalizeTextValue(rawIngredient.howItWorks || rawIngredient.mechanism || "") ||
    normalizeTextValue(rawIngredient.simpleExplanation || "") ||
    normalizeTextValue(primaryPurpose || "") ||
    "Limited evidence: DermIntel does not yet have a source-backed mechanism summary for this ingredient."
  );
}

export function ensureStructuredIngredientKnowledge(rawIngredient = {}) {
  const aliases = normalizeTextArray(rawIngredient.aliases);
  const purpose = normalizeTextValue(rawIngredient.purpose || rawIngredient.displayPurpose || "Unknown") || "Unknown";
  const displayPurpose = normalizeTextValue(rawIngredient.displayPurpose || rawIngredient.purpose || purpose) || "Unknown";
  const suitableSkinTypes = normalizeTextArray(rawIngredient.suitableSkinTypes || rawIngredient.skinTypes);
  const avoidSkinTypes = normalizeTextArray(rawIngredient.avoidSkinTypes);
  const functions = normalizeTextArray(rawIngredient.functions);
  const helpsConcerns = normalizeTextArray(rawIngredient.helpsConcerns || rawIngredient.helps);
  const avoidFor = normalizeTextArray(rawIngredient.avoidFor);
  const tags = normalizeTextArray(rawIngredient.tags);
  const riskFlags = normalizeTextArray(rawIngredient.riskFlags);
  const sideEffects = normalizeTextArray(rawIngredient.sideEffects || []);
  const scientificName = normalizeTextValue(rawIngredient.scientificName || "") || null;
  const commonNames = deriveCommonNames(rawIngredient, aliases, scientificName || "");
  const normalizedFunctions = functions.length ? functions : splitPurposeIntoFunctions(displayPurpose);
  const category = deriveCategory(rawIngredient, normalizedFunctions, displayPurpose);
  const benefits = deriveBenefits(rawIngredient, normalizedFunctions, helpsConcerns, displayPurpose);
  const primaryPurpose = derivePrimaryPurpose(rawIngredient, displayPurpose, benefits, category);
  const howItWorks = deriveHowItWorks(rawIngredient, primaryPurpose);
  const bestSkinTypes = normalizeTextArray(rawIngredient.bestSkinTypes || suitableSkinTypes);
  const evidenceLevel = normalizeEvidenceLevel(rawIngredient.evidenceLevel);
  const references = normalizeReferenceList(rawIngredient.references);
  const simpleExplanation = normalizeTextValue(rawIngredient.simpleExplanation || howItWorks || primaryPurpose) || howItWorks || primaryPurpose;

  return {
    ...rawIngredient,
    inciName: normalizeTextValue(rawIngredient.inciName || rawIngredient.name),
    commonNames,
    aliases,
    scientificName,
    casNumber: normalizeTextValue(rawIngredient.casNumber || "") || null,
    category,
    primaryPurpose,
    purpose,
    displayPurpose,
    functions: normalizedFunctions,
    howItWorks,
    benefits,
    helps: helpsConcerns,
    helpsConcerns,
    skinTypes: suitableSkinTypes,
    suitableSkinTypes,
    bestSkinTypes,
    avoidFor,
    avoidSkinTypes,
    tags,
    riskFlags,
    evidenceLevel,
    references,
    sideEffects,
    comedogenicRating: Number(rawIngredient.comedogenicRating ?? 0),
    irritationScore: Number(rawIngredient.irritationScore ?? 0),
    simpleExplanation
  };
}

export function buildSeedIngredientKnowledge(seedIngredient = {}) {
  const override = getOverrideForIngredient(seedIngredient.name || seedIngredient.inciName || "");
  return ensureStructuredIngredientKnowledge({
    ...seedIngredient,
    ...(override || {})
  });
}

export function buildIngredientCreateData(seedIngredient = {}) {
  const ingredient = buildSeedIngredientKnowledge(seedIngredient);

  return {
    name: ingredient.inciName || ingredient.name,
    scientificName: ingredient.scientificName,
    commonNames: ingredient.commonNames,
    casNumber: ingredient.casNumber,
    category: ingredient.category,
    primaryPurpose: ingredient.primaryPurpose,
    purpose: ingredient.purpose,
    displayPurpose: ingredient.displayPurpose,
    howItWorks: ingredient.howItWorks,
    riskLevel: ingredient.riskLevel || "LOW",
    benefits: ingredient.benefits,
    sideEffects: ingredient.sideEffects,
    suitableSkinTypes: ingredient.suitableSkinTypes,
    bestSkinTypes: ingredient.bestSkinTypes,
    avoidSkinTypes: ingredient.avoidSkinTypes,
    functions: ingredient.functions,
    helps: ingredient.helps,
    helpsConcerns: ingredient.helpsConcerns,
    avoidFor: ingredient.avoidFor,
    tags: ingredient.tags,
    riskFlags: ingredient.riskFlags,
    evidenceLevel: ingredient.evidenceLevel,
    references: ingredient.references,
    comedogenicRating: ingredient.comedogenicRating,
    irritationScore: ingredient.irritationScore,
    simpleExplanation: ingredient.simpleExplanation
  };
}
