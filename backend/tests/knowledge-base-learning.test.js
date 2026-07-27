import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../src/app.js";
import { createProductFingerprint } from "../src/lib/knowledge-base/product-fingerprint.js";
import { getRecordedSearchAttemptsForFingerprint } from "../src/lib/knowledge-base/product-knowledge-base.js";

function startServer(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("Product fingerprint stays stable across noisy retailer naming", () => {
  const amazonLike = createProductFingerprint({
    brand: "Chemist At Play",
    name: "Chemist At Play 2% Salicylic Acid Face Wash for Oily & Acne-Prone Skin Controls Oil, Prevents Acne & Fades Acne Marks 100ml",
    category: "Face Wash"
  });

  const canonical = createProductFingerprint({
    brand: "Chemist At Play",
    name: "Oil & Acne Control Face Wash",
    variant: "2% Salicylic Acid",
    size: "100ml",
    category: "Face Wash"
  });

  assert.equal(amazonLike.brand, canonical.brand);
  assert.equal(amazonLike.category, canonical.category);
  assert.equal(amazonLike.size, canonical.size);
  assert.equal(amazonLike.variant, canonical.variant);
});

test("DermIntel learns a verified formula and reuses it for another URL of the same product", async () => {
  const productServer = await startServer((request, response) => {
    response.writeHead(200, { "Content-Type": "text/html" });

    if (request.url === "/plum-cleanser-retailer-copy") {
      response.end(`
        <html>
          <head>
            <title>Plum Oat & Ceramide Gentle Face Wash for Sensitive Skin</title>
            <meta property="og:title" content="Plum Oat & Ceramide Gentle Face Wash for Sensitive Skin" />
          </head>
          <body>
            <p>Plum Oat & Ceramide Gentle Face Wash for sensitive skin with a soft daily cleanse.</p>
          </body>
        </html>
      `);
      return;
    }

    response.end(`
      <html>
        <head>
          <title>Plum Oat & Ceramide Gentle Face Wash 100ml</title>
          <meta property="og:title" content="Plum Oat & Ceramide Gentle Face Wash 100ml" />
        </head>
        <body>
          <section>
            <h2>Ingredients</h2>
            <div>
              Water, Glycerin, Sodium Cocoyl Isethionate, Cocamidopropyl Betaine,
              Ceramide NP, Avena Sativa Kernel Extract, Panthenol, Xanthan Gum, Citric Acid
            </div>
          </section>
        </body>
      </html>
    `);
  });

  const apiServer = await startServer(createApp());

  try {
    const firstResponse = await fetch(`${apiServer.url}/api/products/resolve-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${productServer.url}/plum-cleanser-source`
      })
    });

    const firstPayload = await firstResponse.json();
    assert.equal(firstResponse.status, 200);
    assert.equal(firstPayload.verifiedIngredients, true);
    assert.match(firstPayload.ingredientsText, /ceramide/i);

    const learnedFingerprint = createProductFingerprint(firstPayload.product);
    const recordedAttempts = getRecordedSearchAttemptsForFingerprint(learnedFingerprint.fingerprint);
    assert.ok(recordedAttempts.length > 0);
    assert.ok(recordedAttempts.some((attempt) => /parsing|searching|checking/i.test(attempt.stage)));

    const secondResponse = await fetch(`${apiServer.url}/api/products/resolve-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${productServer.url}/plum-cleanser-retailer-copy`
      })
    });

    const secondPayload = await secondResponse.json();
    assert.equal(secondResponse.status, 200);
    assert.equal(secondPayload.verifiedIngredients, true);
    assert.equal(secondPayload.candidateAttempts.length, 0);
    assert.match(secondPayload.message, /knowledge base/i);
    assert.ok(
      secondPayload.processingTrace.some(
        (step) => step.label === "Knowledge base lookup" && /knowledge base|alias|cache/i.test(step.details)
      )
    );
    assert.match(secondPayload.ingredientsText, /ceramide/i);
  } finally {
    await stopServer(apiServer.server);
    await stopServer(productServer.server);
  }
});
