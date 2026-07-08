import axios from "axios";

function looksDynamicallyRendered(html = "") {
  const normalized = html.toLowerCase();
  return (
    html.length < 1500 ||
    normalized.includes("enable javascript") ||
    normalized.includes("captcha") ||
    normalized.includes("loading...")
  );
}

async function tryPlaywrightRender(url) {
  try {
    const playwright = await import("playwright");
    const browser = await playwright.chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 15000 });
    const html = await page.content();
    await browser.close();
    return html;
  } catch (_error) {
    return "";
  }
}

export async function downloadWebpage(url) {
  try {
    const response = await axios.get(url, {
      timeout: 12000,
      headers: {
        "User-Agent": "DermIntelBot/1.0 (+https://dermintel.local)"
      }
    });

    let html = typeof response.data === "string" ? response.data : "";
    let renderMode = "static";

    if (html && looksDynamicallyRendered(html)) {
      const rendered = await tryPlaywrightRender(url);

      if (rendered) {
        html = rendered;
        renderMode = "playwright";
      }
    }

    return {
      ok: Boolean(html),
      html,
      statusCode: response.status,
      renderMode
    };
  } catch (error) {
    return {
      ok: false,
      html: "",
      statusCode: error.response?.status || 0,
      renderMode: "failed",
      errorMessage: error.message
    };
  }
}

