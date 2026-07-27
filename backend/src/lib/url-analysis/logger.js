import { randomUUID } from "node:crypto";

let cachedPino = null;
let cachedLogger = null;
let attemptedPinoLoad = false;

function createConsoleLogger(bindings = {}) {
  function write(level, message, details = {}) {
    const timestamp = new Date().toISOString();
    const payload = {
      ...bindings,
      ...details
    };
    const suffix = Object.keys(payload).length ? ` ${JSON.stringify(payload)}` : "";
    console.log(`[DermIntel][${level.toUpperCase()}][${timestamp}] ${message}${suffix}`);
  }

  return {
    child(childBindings = {}) {
      return createConsoleLogger({
        ...bindings,
        ...childBindings
      });
    },
    info(details, message) {
      write("info", message || "log", details || {});
    },
    warn(details, message) {
      write("warn", message || "log", details || {});
    },
    error(details, message) {
      write("error", message || "log", details || {});
    },
    debug(details, message) {
      write("debug", message || "log", details || {});
    }
  };
}

async function ensurePinoLogger() {
  if (cachedLogger) {
    return cachedLogger;
  }

  if (!attemptedPinoLoad) {
    attemptedPinoLoad = true;
    try {
      const pinoModule = await import("pino");
      cachedPino = pinoModule.default || pinoModule.pino || pinoModule;
    } catch (_error) {
      cachedPino = null;
    }
  }

  if (cachedPino) {
    cachedLogger = cachedPino({
      name: "dermintel-pipeline",
      level: process.env.LOG_LEVEL || "info",
      base: undefined
    });
    return cachedLogger;
  }

  cachedLogger = createConsoleLogger();
  return cachedLogger;
}

export function createTraceId() {
  return randomUUID();
}

export async function getPipelineLogger(bindings = {}) {
  const logger = await ensurePinoLogger();
  return logger.child ? logger.child(bindings) : logger;
}

export async function createPipelineContext(seed = {}) {
  const traceId = seed.traceId || createTraceId();
  const logger = await getPipelineLogger({ traceId });

  return {
    traceId,
    startedAt: Date.now(),
    logger,
    ...seed
  };
}

export function summarizeHtml(html = "") {
  return html
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

export function logUrlAnalysis(event, details = {}) {
  ensurePinoLogger()
    .then((logger) => {
      if (logger?.info) {
        logger.info(details, event);
      }
    })
    .catch(() => {
      const fallback = createConsoleLogger();
      fallback.info(details, event);
    });
}
