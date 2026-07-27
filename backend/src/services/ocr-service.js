function stripDataUriPrefix(value = "") {
  return value.replace(/^data:[^;]+;base64,/, "");
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

async function fetchImageAsBase64(imageUrl, fetchFn = fetch) {
  const response = await fetchFn(imageUrl);
  if (!response.ok) {
    throw new Error(`Image download failed with status ${response.status}.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
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

async function runTesseractOcr({ imageBase64 }) {
  try {
    const tesseract = await import("tesseract.js");
    const worker = await tesseract.createWorker("eng");

    try {
      const dataUri = `data:image/png;base64,${stripDataUriPrefix(imageBase64)}`;
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
  const encodedImage = imageBase64 || (imageUrl ? await fetchImageAsBase64(imageUrl, fetchFn) : "");
  if (!encodedImage) {
    return {
      provider: "none",
      rawText: "",
      extractedIngredientsText: ""
    };
  }

  let rawText = "";
  let provider = "none";

  if (process.env.GOOGLE_VISION_API_KEY) {
    rawText = await googleVisionFn({ imageBase64: encodedImage, fetchFn });
    provider = "google-vision";
  } else if (process.env.AZURE_VISION_ENDPOINT && process.env.AZURE_VISION_KEY) {
    rawText = await azureVisionFn({ imageBase64: encodedImage, fetchFn });
    provider = "azure-vision";
  }

  if (!rawText) {
    rawText = await tesseractFn({ imageBase64: encodedImage, fetchFn });
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

