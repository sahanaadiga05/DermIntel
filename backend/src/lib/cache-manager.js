const DEFAULT_TTL_MS = 1000 * 60 * 30;

const urlCache = new Map();
const productCache = new Map();

function readCache(cache, key) {
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

function writeCache(cache, key, value, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs
  });
}

export function getCachedUrlResolution(url) {
  return readCache(urlCache, url);
}

export function setCachedUrlResolution(url, value, ttlMs) {
  writeCache(urlCache, url, value, ttlMs);
}

export function getCachedProductResolution(productKey) {
  return readCache(productCache, productKey);
}

export function setCachedProductResolution(productKey, value, ttlMs) {
  writeCache(productCache, productKey, value, ttlMs);
}

