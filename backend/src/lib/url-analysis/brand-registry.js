const BRAND_DOMAINS = {
  cetaphil: { officialDomain: "cetaphil.com", confidence: 0.99, resolutionMethod: "registry" },
  cerave: { officialDomain: "cerave.com", confidence: 0.99, resolutionMethod: "registry" },
  "cera ve": { officialDomain: "cerave.com", confidence: 0.99, resolutionMethod: "registry" },
  minimalist: { officialDomain: "beminimalist.co", confidence: 0.99, resolutionMethod: "registry" },
  pilgrim: { officialDomain: "discoverpilgrim.com", confidence: 0.98, resolutionMethod: "registry" },
  dove: { officialDomain: "dove.com", confidence: 0.98, resolutionMethod: "registry" },
  "chemist at play": { officialDomain: "innovist.com", confidence: 0.99, resolutionMethod: "registry" },
  "dot key": { officialDomain: "dotandkey.com", confidence: 0.98, resolutionMethod: "registry" },
  "dot and key": { officialDomain: "dotandkey.com", confidence: 0.98, resolutionMethod: "registry" },
  plum: { officialDomain: "plumgoodness.com", confidence: 0.98, resolutionMethod: "registry" },
  "the ordinary": { officialDomain: "theordinary.com", confidence: 0.99, resolutionMethod: "registry" },
  "the derma co": { officialDomain: "thedermaco.com", confidence: 0.98, resolutionMethod: "registry" },
  "la roche posay": { officialDomain: "laroche-posay.com", confidence: 0.99, resolutionMethod: "registry" },
  neutrogena: { officialDomain: "neutrogena.com", confidence: 0.98, resolutionMethod: "registry" },
  bioderma: { officialDomain: "bioderma.com", confidence: 0.98, resolutionMethod: "registry" },
  simple: { officialDomain: "simple.co.uk", confidence: 0.95, resolutionMethod: "registry" },
  aveeno: { officialDomain: "aveeno.com", confidence: 0.97, resolutionMethod: "registry" }
};

export function normalizeBrandRegistryKey(value = "") {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function lookupBrandRegistry(brand = "") {
  return BRAND_DOMAINS[normalizeBrandRegistryKey(brand)] || null;
}

export function getBrandRegistry() {
  return { ...BRAND_DOMAINS };
}
