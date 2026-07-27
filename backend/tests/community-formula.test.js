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

test("Community verified formula stores reusable knowledge for future URL resolutions", async () => {
  const productPage = await startServer((request, response) => {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(`
      <html>
        <head>
          <title>Barrier Calm Gel Cream</title>
          <meta property="og:title" content="Barrier Calm Gel Cream" />
        </head>
        <body>
          <p>Hydrating gel cream with barrier support.</p>
        </body>
      </html>
    `);
  });

  const apiServer = await startServer(createApp());

  try {
    const submitResponse = await fetch(`${apiServer.url}/api/products/community-formula`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${productPage.url}/barrier-calm-gel-cream`,
        ingredientsText: "Ingredients: Water, Glycerin, Niacinamide, Panthenol, Cetearyl Alcohol, Sodium Benzoate, Citric Acid, Xanthan Gum, Tocopherol",
        submittedBy: "community-user-1"
      })
    });

    const submitPayload = await submitResponse.json();
    assert.equal(submitResponse.status, 200);
    assert.equal(submitPayload.submissionStatus, "VERIFIED_AND_STORED");
    assert.equal(submitPayload.communityReviewStatus, "AUTO_VERIFIED");
    assert.equal(submitPayload.verifiedIngredients, true);

    const resolveResponse = await fetch(`${apiServer.url}/api/products/resolve-url`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: `${productPage.url}/barrier-calm-gel-cream`
      })
    });

    const resolvePayload = await resolveResponse.json();
    assert.equal(resolveResponse.status, 200);
    assert.equal(resolvePayload.verifiedIngredients, true);
    assert.ok(
      resolvePayload.processingTrace.some((step) => step.label === "Knowledge base lookup")
    );
    assert.match(resolvePayload.message, /knowledge base/i);
  } finally {
    await stopServer(apiServer.server);
    await stopServer(productPage.server);
  }
});

test("Invalid community submission is kept for review instead of being accepted", async () => {
  const apiServer = await startServer(createApp());

  try {
    const response = await fetch(`${apiServer.url}/api/products/community-formula`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        product: {
          brand: "Glow Theory",
          name: "Glow Theory Brightening Cream",
          category: "Face Cream",
          variant: "",
          size: "50ml"
        },
        ingredientsText: "Brightens dull skin, hydrates deeply, improves glow in 7 days.",
        submittedBy: "community-user-2"
      })
    });

    const payload = await response.json();
    assert.equal(response.status, 422);
    assert.equal(payload.details.submissionStatus, "PENDING_REVIEW");
    assert.equal(payload.details.communityReviewStatus, "PENDING_REVIEW");
    assert.ok(payload.details.submissionId);
    assert.ok(Array.isArray(payload.processingTrace));
    assert.ok(
      payload.processingTrace.some((step) => step.label === "Community verification" && step.state === "failed")
    );

    const reviewResponse = await fetch(`${apiServer.url}/api/products/community-formula/${payload.details.submissionId}/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        decision: "REJECTED",
        reviewNotes: "Marketing text only."
      })
    });

    const reviewPayload = await reviewResponse.json();
    assert.equal(reviewResponse.status, 200);
    assert.equal(reviewPayload.communityReviewStatus, "REJECTED");
  } finally {
    await stopServer(apiServer.server);
  }
});
