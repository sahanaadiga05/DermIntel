function stripDataUriPrefix(value = "") {
  return value.replace(/^data:[^;]+;base64,/, "");
}

const TESSERACT_SUPPORTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/bmp"
]);

function normalizeContentType(value = "") {
  return String(value || "").split(";")[0].trim().toLowerCase();
}

function detectImageMimeType(buffer = Buffer.alloc(0), contentType = "") {
  const normalizedContentType = normalizeContentType(contentType);

  if (buffer.length >= 12) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
    if (buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WEBP") return "image/webp";
    if (buffer.slice(0, 6).toString("ascii").startsWith("GIF")) return "image/gif";
    if (buffer.slice(4, 12).toString("ascii").includes("ftyp")) return "image/avif";
  }

  if (buffer.length >= 4) {
    if (buffer.slice(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00]))) return "image/tiff";
    if (buffer.slice(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))) return "image/tiff";
    if (buffer.slice(0, 2).toString("ascii") === "BM") return "image/bmp";
  }

  if (normalizedContentType.startsWith("image/")) {
    return normalizedContentType;
  }

  return normalizedContentType || "application/octet-stream";
}

function looksLikeTextPayload(buffer = Buffer.alloc(0)) {
  const sample = buffer.slice(0, 160).toString("utf8").trim().toLowerCase();
  return sample.startsWith("<!doctype") || sample.startsWith("<html") || sample.startsWith("{") || sample.startsWith("[");
}

function decodeEscapedText(value = "") {
  return value
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[â€¢Â·]/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractIngredientSection(rawText = "") {
  const normalized = rawText
    .replace(/\r/g, "\n")
    .replace(/[|]/g, "\n")
    .replace(/[â€¢Â·]/g, ", ")
    .replace(/\n{2,}/g, "\n")
    .trim();

  const headingMatch = normalized.match(/ingredients?\s*:?([\s\S]{20,4000})/i);
  const working = headingMatch?.[1] || normalized;
  const trimmed = working.split(/(?:directions|how to use|usage|warnings|warning|caution|manufacturer|marketed by|country of origin|customer care)/i)[0];

  return decodeEscapedText(trimmed)
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function fetchImageForOcr(imageUrl, fetchFn = fetch) {
  const response = await fetchFn(imageUrl);
  if (!response.ok) {
    throw new Error(`Image download failed with status ${response.status}.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers?.get?.("content-type") || "";
  const mimeType = detectImageMimeType(buffer, contentType);

  if (!mimeType.startsWith("image/") || looksLikeTextPayload(buffer)) {
    throw new Error(`Downloaded image URL did not return readable image bytes. Content-Type: ${contentType || "unknown"}.`);
  }

  return {
    base64: buffer.toString("base64"),
    mimeType,
    byteLength: buffer.length
  };
}

async function runGoogleVisionOcr({ imageBase64, fetchFn = fetch }) {
  if (!process.env.GOOGLE_VISION_API_KEY) {
    return null;
  }

  const response = await fetchFn(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      requests: [
        {
          image: {
            content: stripDataUriPrefix(imageBase64)
          },
          features: [
            {
              type: "TEXT_DETECTION"
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Google Vision OCR failed with status ${response.status}.`);
  }

  const payload = await response.json();
  return payload.responses?.[0]?.fullTextAnnotation?.text || payload.responses?.[0]?.textAnnotations?.[0]?.description || "";
}

async function runAzureVisionOcr({ imageBase64, fetchFn = fetch }) {
  if (!process.env.AZURE_VISION_ENDPOINT || !process.env.AZURE_VISION_KEY) {
    return null;
  }

  const endpoint = process.env.AZURE_VISION_ENDPOINT.replace(/\/$/, "");
  const response = await fetchFn(`${endpoint}/computervision/imageanalysis:analyze?api-version=2023-02-01-preview&features=read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": process.env.AZURE_VISION_KEY
    },
    body: JSON.stringify({
      data: stripDataUriPrefix(imageBase64)
    })
  });

  if (!response.ok) {
    throw new Error(`Azure Vision OCR failed with status ${response.status}.`);
  }

  const payload = await response.json();
  return payload.readResult?.content || "";
}

async function runTesseractOcr({ imageBase64, mimeType = "image/png" }) {
  const normalizedMimeType = normalizeContentType(mimeType) || "image/png";
  if (!TESSERACT_SUPPORTED_MIME_TYPES.has(normalizedMimeType)) {
    return "";
  }

  try {
    const tesseract = await import("tesseract.js");
    const worker = await tesseract.createWorker("eng");

    try {
      const dataUri = `data:${normalizedMimeType};base64,${stripDataUriPrefix(imageBase64)}`;
      const result = await worker.recognize(dataUri);
      return result?.data?.text || "";
    } finally {
      await worker.terminate();
    }
  } catch (_error) {
    return "";
  }
}

export async function extractIngredientsFromLabelImage({
  imageBase64 = "",
  imageUrl = "",
  fetchFn = fetch,
  googleVisionFn = runGoogleVisionOcr,
  azureVisionFn = runAzureVisionOcr,
  tesseractFn = runTesseractOcr
} = {}) {
  const imagePayload = imageBase64
    ? {
        base64: imageBase64,
        mimeType: detectImageMimeType(Buffer.from(stripDataUriPrefix(imageBase64), "base64"))
      }
    : imageUrl
      ? await fetchImageForOcr(imageUrl, fetchFn)
      : null;

  if (!imagePayload?.base64) {
    return {
      provider: "none",
      rawText: "",
      extractedIngredientsText: ""
    };
  }

  let rawText = "";
  let provider = "none";

  if (process.env.GOOGLE_VISION_API_KEY) {
    rawText = await googleVisionFn({ imageBase64: imagePayload.base64, fetchFn });
    provider = "google-vision";
  } else if (process.env.AZURE_VISION_ENDPOINT && process.env.AZURE_VISION_KEY) {
    rawText = await azureVisionFn({ imageBase64: imagePayload.base64, fetchFn });
    provider = "azure-vision";
  }

  if (!rawText) {
    rawText = await tesseractFn({ imageBase64: imagePayload.base64, mimeType: imagePayload.mimeType, fetchFn });
    provider = rawText ? "tesseract" : provider;
  }

  return {
    provider,
    rawText: decodeEscapedText(rawText),
    extractedIngredientsText: extractIngredientSection(rawText)
  };
}

export function parseIngredientsFromCommunityText(rawText = "") {
  return extractIngredientSection(rawText);
}

