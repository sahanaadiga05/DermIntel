import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../src/app.js";

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

test("POST /api/products/resolve-url resolves verified ingredients from a local product page", async () => {
  const productPage = await startServer((request, response) => {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(`
      <html>
        <head>
          <title>Hydra Balance Cleanser</title>
          <meta property="og:title" content="Hydra Balance Cleanser" />
        </head>
        <body>
          <div>
            <h2>Ingredients</h2>
            <div>
              Water, Glycerin, Niacinamide, Panthenol, Cetearyl Alcohol,
              Sodium Benzoate, Citric Acid, Xanthan Gum, Tocopherol
            </div>
          </div>
        </body>
      </html>
    `);
  });

  const apiServer = await startServer(createApp());

  try {
    const response = await fetch(`${apiServer.url}/api/products/resolve-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${productPage.url}/cleanser`
      })
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.verifiedIngredients, true);
    assert.ok(Array.isArray(payload.candidateAttempts));
    assert.ok(payload.candidateAttempts.length >= 1);
    assert.match(payload.ingredientsText, /glycerin/i);
  } finally {
    await stopServer(apiServer.server);
    await stopServer(productPage.server);
  }
});

test("POST /api/analysis scores a verified manual ingredient list", async () => {
  const apiServer = await startServer(createApp());

  try {
    const response = await fetch(`${apiServer.url}/api/analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        productName: "",
        ingredientsText: "Water, Glycerin, Niacinamide, Panthenol, Cetearyl Alcohol, Sodium Benzoate, Citric Acid, Xanthan Gum, Tocopherol",
        profile: {
          skinType: "DRY",
          skinSensitivity: "SLIGHTLY_SENSITIVE",
          primarySkinConcerns: ["DRYNESS"],
          primarySkincareGoals: ["HYDRATION"],
          cosmeticAllergies: []
        }
      })
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.verifiedIngredients, true);
    assert.equal(typeof payload.safetyScore, "number");
    assert.equal(typeof payload.suitabilityScore, "number");
    assert.ok(payload.ingredientBreakdown.length >= 8);
  } finally {
    await stopServer(apiServer.server);
  }
});

