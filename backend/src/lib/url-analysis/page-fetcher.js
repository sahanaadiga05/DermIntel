import axios from "axios";
import { logUrlAnalysis } from "./logger.js";

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0"
];

const DEFAULT_HEADERS = {
  "User-Agent": USER_AGENTS[0],
  Accept: "text/html,application/xhtml+xml"
};

function createAbortError(message = "Request cancelled") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : createAbortError();
  }
}

function isProbablyJavascriptDriven(html = "") {
  const normalized = html.toLowerCase();
  const hasIngredientSignals = /ingredients?|inci|composition|product details|description/i.test(html);
  const hasProductSignals = /og:title|twitter:title|<title|application\/ld\+json|__next_data__|__initial_state__/i.test(html);
  const heavyScriptBundle = /<script[^>]+src=["'][^"']+(?:webpack|runtime|bundle|main)[^"']+["']/i.test(html);

  if (normalized.includes("enable javascript") || normalized.includes("captcha")) {
    return true;
  }

  if (html.length < 1200 && heavyScriptBundle) {
    return true;
  }

  if (!hasIngredientSignals && !hasProductSignals && html.length < 2200) {
    return true;
  }

  return false;
}

function pickUserAgent(attempt = 1) {
  return USER_AGENTS[(attempt - 1) % USER_AGENTS.length] || DEFAULT_HEADERS["User-Agent"];
}

function isRetryableHttpStatus(status) {
  return [408, 425, 429, 500, 502, 503, 504].includes(Number(status));
}

function getRetryDelay(attempt, error) {
  const retryAfterHeader = error?.response?.headers?.["retry-after"];
  const retryAfterSeconds = Number(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(retryAfterSeconds * 1000, 4000);
  }

  const baseDelay = Math.min(300 * (2 ** Math.max(0, attempt - 1)), 2500);
  const jitter = Math.floor(Math.random() * 250);
  return baseDelay + jitter;
}

function shouldRetry(error, attempt, retries) {
  if (attempt >= retries) {
    return false;
  }

  const status = error?.response?.status;
  if (isRetryableHttpStatus(status)) {
    return true;
  }

  return ["ECONNRESET", "ECONNABORTED", "ETIMEDOUT", "EAI_AGAIN"].includes(error?.code);
}

function shouldAttemptDynamicFallbackAfterStaticFailure(error) {
  const status = Number(error?.response?.status || 0);
  if (status && isRetryableHttpStatus(status)) {
    return true;
  }

  return ["ECONNRESET", "ECONNABORTED", "ETIMEDOUT", "EAI_AGAIN", "ERR_NETWORK"].includes(error?.code);
}
function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : createAbortError());
      return;
    }

    let abortHandler = null;
    const timer = setTimeout(() => {
      if (abortHandler) {
        signal?.removeEventListener("abort", abortHandler);
      }
      resolve();
    }, ms);

    abortHandler = () => {
      clearTimeout(timer);
      reject(signal.reason instanceof Error ? signal.reason : createAbortError());
    };

    signal?.addEventListener("abort", abortHandler, { once: true });
  });
}

async function runWithRetry(task, { retries = 2, label, signal }) {
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    throwIfAborted(signal);

    try {
      return await task(attempt);
    } catch (error) {
      if (error.name === "AbortError" || axios.isCancel?.(error) || error.code === "ERR_CANCELED") {
        throw createAbortError();
      }

      lastError = error;
      const status = error?.response?.status;
      logUrlAnalysis(`${label} attempt failed`, {
        attempt,
        statusCode: status || 0,
        message: error.message
      });

      if (!shouldRetry(error, attempt, retries)) {
        break;
      }

      await delay(getRetryDelay(attempt, error), signal);
    }
  }

  throw lastError;
}

export async function fetchStaticHtml(url, { timeoutMs = 5000, retries = 2, signal } = {}) {
  return runWithRetry(
    async (attempt) => {
      throwIfAborted(signal);
      const startedAt = Date.now();
      const response = await axios.get(url, {
        timeout: timeoutMs,
        signal,
        headers: {
          ...DEFAULT_HEADERS,
          "User-Agent": pickUserAgent(attempt),
          "Accept-Language": "en-US,en;q=0.9"
        },
        maxRedirects: 5
      });

      return {
        ok: typeof response.data === "string" && response.data.length > 0,
        html: typeof response.data === "string" ? response.data : "",
        status: response.status,
        statusCode: response.status,
        method: "html",
        mode: "html",
        responseTime: Date.now() - startedAt,
        finalUrl: response.request?.res?.responseUrl || url
      };
    },
    { retries, label: "Static fetch", signal }
  );
}

export async function fetchDynamicHtml(url, { timeoutMs = 8000, signal } = {}) {
  const startedAt = Date.now();
  let browser = null;
  let page = null;
  let detached = false;

  const abortHandler = async () => {
    try {
      if (page && !page.isClosed()) {
        await page.close();
      }
    } catch (_error) {
      // Ignore cleanup failures.
    }

    try {
      if (browser) {
        await browser.close();
      }
    } catch (_error) {
      // Ignore cleanup failures.
    }
  };

  try {
    throwIfAborted(signal);
    signal?.addEventListener("abort", abortHandler, { once: true });

    const playwright = await import("playwright");
    browser = await playwright.chromium.launch({ headless: true });
    page = await browser.newPage({
      userAgent: DEFAULT_HEADERS["User-Agent"],
      locale: "en-US",
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("networkidle", { timeout: Math.min(3500, timeoutMs) }).catch(() => {});

    const ingredientControls = page.locator(
      "button,summary,[role='button'],[role='tab'],a[href^='#']"
    ).filter({ hasText: /(?:full\s+)?ingredients?(?:\s+list)?|inci|composition/i });
    const controlCount = Math.min(await ingredientControls.count(), 8);
    for (let index = 0; index < controlCount; index += 1) {
      const control = ingredientControls.nth(index);
      if (await control.isVisible().catch(() => false)) {
        await control.click({ timeout: 1200 }).catch(() => {});
      }
    }
    if (controlCount > 0) {
      await page.waitForTimeout(350);
    }

    throwIfAborted(signal);
    const html = await page.content();
    const finalUrl = page.url();
    await browser.close();
    browser = null;
    detached = true;
    signal?.removeEventListener("abort", abortHandler);

    return {
      ok: Boolean(html),
      html,
      status: 200,
      statusCode: 200,
      method: "playwright",
      mode: "playwright",
      responseTime: Date.now() - startedAt,
      finalUrl
    };
  } catch (error) {
    if (!detached) {
      signal?.removeEventListener("abort", abortHandler);
    }

    if (error.name === "AbortError") {
      return {
        ok: false,
        html: "",
        status: 0,
        statusCode: 0,
        method: "playwright",
        mode: "playwright",
        responseTime: Date.now() - startedAt,
        finalUrl: url,
        errorMessage: "Request cancelled"
      };
    }

    return {
      ok: false,
      html: "",
      status: 0,
      statusCode: 0,
      method: "playwright",
      mode: "playwright",
      responseTime: Date.now() - startedAt,
      finalUrl: url,
      errorMessage: error.message
    };
  } finally {
    try {
      if (page && !page.isClosed()) {
        await page.close();
      }
    } catch (_error) {
      // Ignore cleanup failures.
    }

    try {
      if (browser) {
        await browser.close();
      }
    } catch (_error) {
      // Ignore cleanup failures.
    }
  }
}

export async function fetchPageWithStrategies(url, {
  signal,
  staticTimeoutMs = 5000,
  dynamicTimeoutMs = 8000,
  retries = 1
} = {}) {
  const attempts = [];

  try {
    throwIfAborted(signal);
    const htmlResponse = await fetchStaticHtml(url, { timeoutMs: staticTimeoutMs, retries, signal });
    attempts.push({
      method: htmlResponse.method,
      mode: htmlResponse.mode,
      ok: htmlResponse.ok,
      status: htmlResponse.status,
      statusCode: htmlResponse.statusCode,
      responseTime: htmlResponse.responseTime,
      finalUrl: htmlResponse.finalUrl
    });

    if (htmlResponse.ok && !isProbablyJavascriptDriven(htmlResponse.html)) {
      return {
        ok: true,
        html: htmlResponse.html,
        status: htmlResponse.status,
        statusCode: htmlResponse.statusCode,
        method: htmlResponse.method,
        responseTime: htmlResponse.responseTime,
        finalUrl: htmlResponse.finalUrl,
        extractionMethod: "html",
        attempts
      };
    }

    throwIfAborted(signal);
    const dynamicResponse = await fetchDynamicHtml(url, { timeoutMs: dynamicTimeoutMs, signal });
    attempts.push({
      method: dynamicResponse.method,
      mode: dynamicResponse.mode,
      ok: dynamicResponse.ok,
      status: dynamicResponse.status,
      statusCode: dynamicResponse.statusCode,
      responseTime: dynamicResponse.responseTime,
      finalUrl: dynamicResponse.finalUrl,
      errorMessage: dynamicResponse.errorMessage || null
    });

    if (dynamicResponse.ok) {
      return {
        ok: true,
        html: dynamicResponse.html,
        status: dynamicResponse.status,
        statusCode: dynamicResponse.statusCode,
        method: dynamicResponse.method,
        responseTime: dynamicResponse.responseTime,
        finalUrl: dynamicResponse.finalUrl,
        extractionMethod: "playwright",
        attempts
      };
    }

    return {
      ok: htmlResponse.ok,
      html: htmlResponse.html,
      status: htmlResponse.status,
      statusCode: htmlResponse.statusCode,
      method: htmlResponse.method,
      responseTime: htmlResponse.responseTime,
      finalUrl: htmlResponse.finalUrl,
      extractionMethod: htmlResponse.ok ? "html" : "failed",
      attempts,
      errorMessage: dynamicResponse.errorMessage || "Unable to fetch page content."
    };
  } catch (error) {
    const statusCode = Number(error?.response?.status || 0);
    const errorMessage = error.name === "AbortError"
      ? "Request cancelled"
      : statusCode === 429
        ? "Rate limited by the website after retry attempts (HTTP 429)."
        : error.message;

    attempts.push({
      method: "html",
      mode: "html",
      ok: false,
      status: statusCode,
      statusCode,
      responseTime: 0,
      finalUrl: url,
      errorMessage
    });

    if (error.name !== "AbortError" && shouldAttemptDynamicFallbackAfterStaticFailure(error)) {
      throwIfAborted(signal);
      const dynamicResponse = await fetchDynamicHtml(url, { timeoutMs: dynamicTimeoutMs, signal });
      attempts.push({
        method: dynamicResponse.method,
        mode: dynamicResponse.mode,
        ok: dynamicResponse.ok,
        status: dynamicResponse.status,
        statusCode: dynamicResponse.statusCode,
        responseTime: dynamicResponse.responseTime,
        finalUrl: dynamicResponse.finalUrl,
        errorMessage: dynamicResponse.errorMessage || null
      });

      if (dynamicResponse.ok) {
        return {
          ok: true,
          html: dynamicResponse.html,
          status: dynamicResponse.status,
          statusCode: dynamicResponse.statusCode,
          method: dynamicResponse.method,
          responseTime: dynamicResponse.responseTime,
          finalUrl: dynamicResponse.finalUrl,
          extractionMethod: "playwright",
          attempts
        };
      }
    }

    return {
      ok: false,
      html: "",
      status: statusCode,
      statusCode,
      method: "failed",
      responseTime: 0,
      finalUrl: url,
      extractionMethod: "failed",
      attempts,
      errorMessage
    };
  }
}

export { shouldAttemptDynamicFallbackAfterStaticFailure };
