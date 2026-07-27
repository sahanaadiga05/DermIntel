import { ingredientCatalog } from "../../data/mock-data.js";

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
    .replace(/[™®©]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+(?:\.\d+)?%\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function mergeIngredient(prismaIngredient, fallbackIngredient) {
  const prismaAliases = prismaIngredient?.aliases || [];
  const fallbackAliases = fallbackIngredient?.aliases || [];
  const aliases = [...new Set([...fallbackAliases, ...prismaAliases.map((entry) => entry.alias || entry)])];

  return {
    ...fallbackIngredient,
    ...(prismaIngredient || {}),
    aliases,
    displayPurpose: prismaIngredient?.purpose || fallbackIngredient?.displayPurpose || fallbackIngredient?.purpose || "Unknown",
    purpose: prismaIngredient?.purpose || fallbackIngredient?.purpose || "Unknown",
    riskLevel: prismaIngredient?.riskLevel || fallbackIngredient?.riskLevel || "UNKNOWN",
    comedogenicRating: prismaIngredient?.comedogenicRating ?? fallbackIngredient?.comedogenicRating ?? 0,
    irritationScore: prismaIngredient?.irritationScore ?? fallbackIngredient?.irritationScore ?? 0,
    suitableSkinTypes: prismaIngredient?.suitableSkinTypes || fallbackIngredient?.suitableSkinTypes || [],
    avoidSkinTypes: prismaIngredient?.avoidSkinTypes || fallbackIngredient?.avoidSkinTypes || [],
    tags: fallbackIngredient?.tags || [],
    riskFlags: fallbackIngredient?.riskFlags || [],
    simpleExplanation: prismaIngredient?.simpleExplanation || fallbackIngredient?.simpleExplanation || "Ingredient knowledge base entry is incomplete.",
    evidenceLevel: prismaIngredient?.evidenceLevel || fallbackIngredient?.evidenceLevel || "reference",
    references: prismaIngredient?.references || fallbackIngredient?.references || []
  };
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

  const fallbackMap = new Map(ingredientCatalog.map((ingredient) => [getLookupKey(ingredient.name), ingredient]));
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
