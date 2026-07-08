import { processProductUrl } from "./url-processor.js";

export async function resolveProductFromUrl(inputUrl) {
  return processProductUrl(inputUrl);
}

