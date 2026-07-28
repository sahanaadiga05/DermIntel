import test from "node:test";
import assert from "node:assert/strict";
import { extractIngredientsFromLabelImage } from "../src/services/ocr-service.js";

function mockImageResponse({ body, contentType = "image/png", ok = true, status = 200 }) {
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body || "");
  return {
    ok,
    status,
    headers: {
      get(name) {
        return name.toLowerCase() === "content-type" ? contentType : null;
      }
    },
    async arrayBuffer() {
      return buffer;
    }
  };
}

test("OCR downloader rejects HTML returned from an image URL before Tesseract runs", async () => {
  let tesseractCalled = false;

  await assert.rejects(
    () => extractIngredientsFromLabelImage({
      imageUrl: "https://cdn.example.com/product-image.jpg",
      fetchFn: async () => mockImageResponse({
        body: "<html><body>Access denied</body></html>",
        contentType: "image/jpeg"
      }),
      tesseractFn: async () => {
        tesseractCalled = true;
        return "";
      }
    }),
    /did not return readable image bytes/i
  );

  assert.equal(tesseractCalled, false);
});

test("Tesseract fallback skips unsupported WebP bytes instead of attempting OCR", async () => {
  const originalGoogleKey = process.env.GOOGLE_VISION_API_KEY;
  const originalAzureEndpoint = process.env.AZURE_VISION_ENDPOINT;
  const originalAzureKey = process.env.AZURE_VISION_KEY;
  delete process.env.GOOGLE_VISION_API_KEY;
  delete process.env.AZURE_VISION_ENDPOINT;
  delete process.env.AZURE_VISION_KEY;

  const webpHeader = Buffer.concat([
    Buffer.from("RIFF", "ascii"),
    Buffer.from([0x10, 0x00, 0x00, 0x00]),
    Buffer.from("WEBP", "ascii"),
    Buffer.from("VP8 ", "ascii")
  ]);

  try {
    const result = await extractIngredientsFromLabelImage({
      imageBase64: webpHeader.toString("base64")
    });

    assert.equal(result.provider, "none");
    assert.equal(result.rawText, "");
    assert.equal(result.extractedIngredientsText, "");
  } finally {
    if (originalGoogleKey === undefined) delete process.env.GOOGLE_VISION_API_KEY;
    else process.env.GOOGLE_VISION_API_KEY = originalGoogleKey;
    if (originalAzureEndpoint === undefined) delete process.env.AZURE_VISION_ENDPOINT;
    else process.env.AZURE_VISION_ENDPOINT = originalAzureEndpoint;
    if (originalAzureKey === undefined) delete process.env.AZURE_VISION_KEY;
    else process.env.AZURE_VISION_KEY = originalAzureKey;
  }
});

test("OCR passes the real detected PNG MIME type to Tesseract", async () => {
  const pngHeader = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(16)
  ]);

  const result = await extractIngredientsFromLabelImage({
    imageBase64: pngHeader.toString("base64"),
    tesseractFn: async ({ mimeType }) => {
      assert.equal(mimeType, "image/png");
      return "Ingredients: Water, Glycerin, Niacinamide, Panthenol, Sodium Benzoate, Citric Acid, Xanthan Gum, Tocopherol";
    }
  });

  assert.equal(result.provider, "tesseract");
  assert.match(result.extractedIngredientsText, /Glycerin/);
});
