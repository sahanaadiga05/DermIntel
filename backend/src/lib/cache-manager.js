import { logUrlAnalysis } from "./url-analysis/logger.js";

const VERIFIED_TTL_MS = 1000 * 60 * 60 * 24;
const BRAND_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PRODUCT_METADATA_TTL_MS = 1000 * 60 * 60 * 24;
const memoryUrlCache = new Map();
const memoryProductCache = new Map();
const memoryProductMetadataCache = new Map();
const memoryBrandCache = new Map();
let redisClientPromise;

function readMemoryCache(cache, key) {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function writeMemoryCache(cache, key, value, ttlMs = VERIFIED_TTL_MS) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

async function getRedisClient() {
  if (redisClientPromise !== undefined) {
    return redisClientPromise;
  }

  redisClientPromise = (async () => {
    if (!process.env.REDIS_URL) {
      return null;
    }

    try {
      const redisModule = await import("redis");
      const client = redisModule.createClient({
        url: process.env.REDIS_URL
      });

      client.on("error", (error) => {
        logUrlAnalysis("redis-cache-error", {
          message: error.message
        });
      });

      if (!client.isOpen) {
        await client.connect();
      }

      return client;
    } catch (error) {
      logUrlAnalysis("redis-cache-unavailable", {
        message: error.message
      });
      return null;
    }
  })();

  return redisClientPromise;
}

async function readRedisCache(namespace, key) {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  try {
    const rawValue = await client.get(`${namespace}:${key}`);
    return rawValue ? JSON.parse(rawValue) : null;
  } catch (error) {
    logUrlAnalysis("redis-cache-read-failed", {
      namespace,
      key,
      message: error.message
    });
    return null;
  }
}

async function writeRedisCache(namespace, key, value, ttlMs = VERIFIED_TTL_MS) {
  const client = await getRedisClient();
  if (!client) {
    return false;
  }

  try {
    await client.set(`${namespace}:${key}`, JSON.stringify(value), {
      PX: ttlMs
    });
    return true;
  } catch (error) {
    logUrlAnalysis("redis-cache-write-failed", {
      namespace,
      key,
      message: error.message
    });
    return false;
  }
}

export async function getCachedUrlResolution(url) {
  const redisValue = await readRedisCache("url-resolution", url);
  if (redisValue) {
    return redisValue;
  }

  return readMemoryCache(memoryUrlCache, url);
}

export async function setCachedUrlResolution(url, value, ttlMs = VERIFIED_TTL_MS) {
  if (!value?.verifiedIngredients) {
    return;
  }

  const stored = await writeRedisCache("url-resolution", url, value, ttlMs);
  if (!stored) {
    writeMemoryCache(memoryUrlCache, url, value, ttlMs);
  }
}

export async function getCachedProductResolution(productKey) {
  const redisValue = await readRedisCache("product-resolution", productKey);
  if (redisValue) {
    return redisValue;
  }

  return readMemoryCache(memoryProductCache, productKey);
}

export async function setCachedProductResolution(productKey, value, ttlMs = VERIFIED_TTL_MS) {
  if (!value?.verifiedIngredients) {
    return;
  }

  const stored = await writeRedisCache("product-resolution", productKey, value, ttlMs);
  if (!stored) {
    writeMemoryCache(memoryProductCache, productKey, value, ttlMs);
  }
}

export async function getCachedProductMetadata(productKey) {
  const redisValue = await readRedisCache("product-metadata", productKey);
  if (redisValue) {
    return redisValue;
  }

  return readMemoryCache(memoryProductMetadataCache, productKey);
}

export async function setCachedProductMetadata(productKey, value, ttlMs = PRODUCT_METADATA_TTL_MS) {
  if (!value?.product) {
    return;
  }

  const stored = await writeRedisCache("product-metadata", productKey, value, ttlMs);
  if (!stored) {
    writeMemoryCache(memoryProductMetadataCache, productKey, value, ttlMs);
  }
}

export async function getCachedBrandResolution(brandKey) {
  const redisValue = await readRedisCache("brand-resolution", brandKey);
  if (redisValue) {
    return redisValue;
  }

  return readMemoryCache(memoryBrandCache, brandKey);
}

export async function setCachedBrandResolution(brandKey, value, ttlMs = BRAND_TTL_MS) {
  if (!value?.officialDomain) {
    return;
  }

  const stored = await writeRedisCache("brand-resolution", brandKey, value, ttlMs);
  if (!stored) {
    writeMemoryCache(memoryBrandCache, brandKey, value, ttlMs);
  }
}
