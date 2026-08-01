import { ingredientCatalog } from "../../data/mock-data.js";
import { buildSeedIngredientKnowledge, ensureStructuredIngredientKnowledge } from "./ingredient-knowledge.js";

let prismaClientPromise;
let cachedKnowledgeBase = null;
let cachedAt = 0;
const CACHE_TTL_MS = 1000 * 60 * 10;

function now() {
  return Date.now();
}

async function getPrismaClient() {
  if (prismaClientPromise !== undefined) {
    return prismaClientPromise;
  }

  prismaClientPromise = (async () => {
    if (!process.env.DATABASE_URL) {
      return null;
    }

    try {
      const prismaModule = await import("@prisma/client");
      const client = new prismaModule.PrismaClient();
      await client.$connect();
      return client;
    } catch (_error) {
      return null;
    }
  })();

  return prismaClientPromise;
}

function getLookupKey(value = "") {
  return value
    .toLowerCase()
    .replace(/[\u2122\u00AE\u00A9]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+(?:\.\d+)?%\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function mergeIngredient(prismaIngredient, fallbackIngredient) {
  const prismaAliases = prismaIngredient?.aliases || [];
  const fallbackAliases = fallbackIngredient?.aliases || [];
  const aliases = [...new Set([...fallbackAliases, ...prismaAliases.map((entry) => entry.alias || entry)])];

  return ensureStructuredIngredientKnowledge({
    ...fallbackIngredient,
    ...(prismaIngredient || {}),
    aliases,
    scientificName: prismaIngredient?.scientificName || fallbackIngredient?.scientificName || null,
    commonNames: prismaIngredient?.commonNames || fallbackIngredient?.commonNames || [],
    casNumber: prismaIngredient?.casNumber || fallbackIngredient?.casNumber || null,
    category: prismaIngredient?.category || fallbackIngredient?.category || null,
    primaryPurpose: prismaIngredient?.primaryPurpose || fallbackIngredient?.primaryPurpose || null,
    displayPurpose:
      prismaIngredient?.displayPurpose ||
      prismaIngredient?.purpose ||
      fallbackIngredient?.displayPurpose ||
      fallbackIngredient?.purpose ||
      "Unknown",
    purpose: prismaIngredient?.purpose || fallbackIngredient?.purpose || "Unknown",
    howItWorks: prismaIngredient?.howItWorks || fallbackIngredient?.howItWorks || null,
    riskLevel: prismaIngredient?.riskLevel || fallbackIngredient?.riskLevel || "UNKNOWN",
    benefits: prismaIngredient?.benefits || fallbackIngredient?.benefits || [],
    sideEffects: prismaIngredient?.sideEffects || fallbackIngredient?.sideEffects || [],
    comedogenicRating: prismaIngredient?.comedogenicRating ?? fallbackIngredient?.comedogenicRating ?? 0,
    irritationScore: prismaIngredient?.irritationScore ?? fallbackIngredient?.irritationScore ?? 0,
    suitableSkinTypes: prismaIngredient?.suitableSkinTypes || fallbackIngredient?.suitableSkinTypes || [],
    bestSkinTypes: prismaIngredient?.bestSkinTypes || fallbackIngredient?.bestSkinTypes || fallbackIngredient?.suitableSkinTypes || [],
    avoidSkinTypes: prismaIngredient?.avoidSkinTypes || fallbackIngredient?.avoidSkinTypes || [],
    functions: prismaIngredient?.functions || fallbackIngredient?.functions || [],
    helps: prismaIngredient?.helps || fallbackIngredient?.helps || [],
    helpsConcerns: prismaIngredient?.helpsConcerns || fallbackIngredient?.helpsConcerns || fallbackIngredient?.helps || [],
    avoidFor: prismaIngredient?.avoidFor || fallbackIngredient?.avoidFor || [],
    tags: prismaIngredient?.tags || fallbackIngredient?.tags || [],
    riskFlags: prismaIngredient?.riskFlags || fallbackIngredient?.riskFlags || [],
    simpleExplanation:
      prismaIngredient?.simpleExplanation ||
      prismaIngredient?.howItWorks ||
      prismaIngredient?.primaryPurpose ||
      fallbackIngredient?.simpleExplanation ||
      fallbackIngredient?.howItWorks ||
      fallbackIngredient?.primaryPurpose ||
      "Ingredient knowledge base entry is incomplete.",
    evidenceLevel: prismaIngredient?.evidenceLevel || fallbackIngredient?.evidenceLevel || null,
    references: prismaIngredient?.references || fallbackIngredient?.references || []
  });
}

export async function getIngredientKnowledgeBase() {
  if (cachedKnowledgeBase && now() - cachedAt < CACHE_TTL_MS) {
    return cachedKnowledgeBase;
  }

  const prisma = await getPrismaClient();
  let prismaIngredients = [];

  if (prisma?.ingredient?.findMany) {
    try {
      prismaIngredients = await prisma.ingredient.findMany({
        include: prisma.ingredientAlias?.findMany ? { aliases: true } : undefined
      });
    } catch (_error) {
      try {
        prismaIngredients = await prisma.ingredient.findMany();
      } catch (_nestedError) {
        prismaIngredients = [];
      }
    }
  }

  const fallbackMap = new Map(ingredientCatalog.map((ingredient) => {
    const enrichedIngredient = buildSeedIngredientKnowledge(ingredient);
    return [getLookupKey(enrichedIngredient.name), enrichedIngredient];
  }));
  const prismaMap = new Map(prismaIngredients.map((ingredient) => [getLookupKey(ingredient.name), ingredient]));
  const keys = new Set([...fallbackMap.keys(), ...prismaMap.keys()]);

  cachedKnowledgeBase = [...keys]
    .map((key) => mergeIngredient(prismaMap.get(key), fallbackMap.get(key)))
    .filter(Boolean);
  cachedAt = now();

  return cachedKnowledgeBase;
}

export async function findCanonicalIngredient(value = "") {
  const catalog = await getIngredientKnowledgeBase();
  const key = getLookupKey(value);
  return catalog.find((ingredient) => getLookupKey(ingredient.name) === key) || null;
}

