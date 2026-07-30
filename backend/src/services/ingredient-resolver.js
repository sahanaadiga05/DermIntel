import { extractIngredientsWithAi } from "../lib/pipeline/ai-ingredient-extractor.js";
import { createCleanPageText } from "../lib/pipeline/page-text.js";
import { compareIngredientLists, verifyIngredientCandidate } from "../lib/url-analysis/ingredient-verifier.js";
import { logUrlAnalysis } from "../lib/url-analysis/logger.js";
import { searchDistributorPagesForIngredients } from "../lib/url-analysis/distributor-source-search.js";
import { searchOfficialWebsiteForIngredients } from "../lib/url-analysis/official-source-search.js";
import { searchSearchEngineResultsForIngredients } from "../lib/url-analysis/search-engine-source-search.js";
import { searchTrustedDatabasesForIngredients } from "../lib/url-analysis/trusted-database-search.js";
import { searchProductImagesForIngredients } from "./product-image-ingredient-fallback.js";

const MAX_RESOLVER_RUNTIME_MS = 68000;
const STAGE_TIMEOUTS = {
  initialExtraction: 3000,
  sourceDiscovery: 18000,
  broaderSearch: 10000,
  imageFallback: 22000
};
function createStep(label, state, details = "") {
  return { label, state, details };
}

function formatDuration(durationMs = 0) {
  return `${Math.max(0, Math.round(durationMs))} ms`;
}

function appendDuration(details, durationMs) {
  return `${details} (${formatDuration(durationMs)}).`;
}

function verificationTraceSteps(verification, sourceLabel) {
  return [
    createStep(
      "Normalizing ingredient names",
      "completed",
      `Matched ${verification.matchedCount} ingredients${verification.aliasMatchedCount ? `, ${verification.aliasMatchedCount} via aliases` : ""}.`
    ),
    createStep(
      "Verifying ingredient quality",
      "completed",
      `Passed verification using ${sourceLabel}. ${verification.ingredientCount} ingredients extracted.`
    )
  ];
}

function buildVerifiedResult({ inputUrl, websiteLabel, product, candidate, processingTrace, attemptedSources, candidateAttempts, traceId, message }) {
  return {
    status: "VERIFIED_INGREDIENTS_FOUND",
    verifiedIngredients: true,
    sourceUrl: candidate.sourceUrl || inputUrl,
    sourceWebsite: candidate.sourceWebsite,
    sourceKind: candidate.sourceKind || candidate.metadata?.sourceKind || null,
    platform: websiteLabel,
    product: candidate.product || product,
    extractionMethod: candidate.extractionMethod,
    ingredientSource: candidate.ingredientSource,
    confidenceScore: candidate.confidenceScore,
    ingredientsText: candidate.ingredientsText,
    ingredientList: candidate.ingredientList,
    ingredientCount: candidate.ingredientCount,
    matchedCount: candidate.matchedCount,
    unknownCount: candidate.unknownCount,
    aliasMatchedCount: candidate.aliasMatchedCount,
    matchRate: candidate.matchRate,
    processingTrace,
    attemptedSources,
    candidateAttempts,
    traceId,
    message
  };
}

function buildNoIngredientsResponse({
  inputUrl,
  sourceWebsite,
  platform,
  product,
  extractionMethod,
  processingTrace,
  attemptedSources = [],
  candidateAttempts = [],
  traceId
}) {
  return {
    status: "NO_VERIFIED_INGREDIENTS",
    verifiedIngredients: false,
    failureCode: "NO_PUBLIC_INGREDIENT_LIST",
    communityFallbackAvailable: true,
    recommendedAction: "UPLOAD_INGREDIENT_LABEL",
    sourceUrl: inputUrl,
    sourceWebsite,
    platform,
    product,
    extractionMethod,
    ingredientSource: null,
    confidenceScore: 0,
    ingredientsText: "",
    ingredientList: [],
    ingredientCount: 0,
    processingTrace,
    attemptedSources,
    candidateAttempts,
    traceId,
    message: "We couldn't find a verified ingredient list from trusted sources."
  };
}

function pushAttemptedSource(attemptedSources, source) {
  if (source && !attemptedSources.includes(source)) {
    attemptedSources.push(source);
  }
}

function summarizeSearchReport(report, emptyMessage) {
  if (!report) {
    return emptyMessage;
  }

  const parts = [];

  if (typeof report.inspectedPages === "number") {
    parts.push(`${report.inspectedPages} pages checked`);
  }

  if (typeof report.matchedPages === "number" && report.matchedPages > 0) {
    parts.push(`${report.matchedPages} matched the product`);
  }

  if (typeof report.ingredientHits === "number" && report.ingredientHits > 0) {
    parts.push(`${report.ingredientHits} ingredient sections found`);
  }

  if (typeof report.verifiedCandidates === "number" && report.verifiedCandidates > 0) {
    parts.push(`${report.verifiedCandidates} verified candidates found`);
  }

  if (parts.length) {
    return parts.join(". ") + ".";
  }

  return report.lastReason || emptyMessage;
}

function finalizeAttempts(attemptedSources) {
  return [...new Set(attemptedSources.filter(Boolean))];
}

function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === "ERR_CANCELED";
}

function createAbortError(message = "Request cancelled") {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

async function verifyCandidatePool(candidatePool = [], context = {}) {
  const attempts = [];
  const verified = [];

  for (const candidate of candidatePool) {
    const checked = await verifyIngredientCandidate(candidate, context);
    attempts.push(checked);
    if (checked.verified) {
      verified.push(checked);
    }
  }

  return { attempts, verified };
}

function createTaskResult(label, {
  candidates = [],
  attempts = [],
  report = {},
  details = "",
  durationMs = 0,
  cancelled = false,
  timedOut = false
} = {}) {
  return {
    label,
    candidates,
    attempts,
    report,
    details,
    durationMs,
    cancelled,
    timedOut
  };
}

function summarizePoolFailure(attempts = [], emptyMessage = "") {
  const lastAttempt = attempts.at(-1);
  if (!lastAttempt) {
    return emptyMessage;
  }

  if (lastAttempt.verification?.rule === "MIN_INGREDIENT_COUNT") {
    const count = lastAttempt.ingredientCount || lastAttempt.verification?.ingredientCount || 0;
    return "Found " + count + " partial/key ingredient" + (count === 1 ? "" : "s") + ", but not a complete INCI formula. Continuing to search trusted sources.";
  }

  return lastAttempt.rejectionReason || emptyMessage;
}
function createPoolTask(label, candidatePool, context, successBuilder, emptyMessage) {
  return {
    label,
    async run() {
      const startedAt = Date.now();

      if (!candidatePool.length) {
        return createTaskResult(label, {
          report: {
            lastReason: emptyMessage
          },
          details: emptyMessage,
          durationMs: Date.now() - startedAt
        });
      }

      const verified = await verifyCandidatePool(candidatePool, context);
      return createTaskResult(label, {
        candidates: verified.verified,
        attempts: verified.attempts,
        report: {
          lastReason: verified.verified.length
            ? successBuilder(verified)
            : summarizePoolFailure(verified.attempts, emptyMessage)
        },
        details: verified.verified.length
          ? successBuilder(verified)
          : summarizePoolFailure(verified.attempts, emptyMessage),
        durationMs: Date.now() - startedAt
      });
    }
  };
}

function createSearchTask(label, executor, successEmptyMessage, failureMessage) {
  return {
    label,
    async run({ signal }) {
      const startedAt = Date.now();
      const result = await executor(signal);
      return createTaskResult(label, {
        candidates: result.candidates || [],
        attempts: result.attempts || [],
        report: result.report || {},
        details: result.candidates?.length
          ? summarizeSearchReport(result.report, successEmptyMessage)
          : result.report?.lastReason || failureMessage,
        durationMs: Date.now() - startedAt
      });
    }
  };
}

function createAiTask({ fetched, inputUrl, website, product }) {
  return {
    label: "AI ingredient extraction",
    async run() {
      const startedAt = Date.now();

      if (!fetched?.ok || !fetched.html) {
        return createTaskResult("AI ingredient extraction", {
          report: {
            lastReason: "AI extraction skipped because no fetchable page content was available."
          },
          details: "AI extraction skipped because no fetchable page content was available.",
          durationMs: Date.now() - startedAt
        });
      }

      const aiCandidate = await extractIngredientsWithAi({
        pageText: createCleanPageText(fetched.html),
        sourceUrl: fetched.finalUrl || inputUrl,
        sourceWebsite: website.websiteLabel,
        product
      });

      if (!aiCandidate) {
        return createTaskResult("AI ingredient extraction", {
          report: {
            lastReason: "AI extraction did not produce a candidate ingredient list."
          },
          details: "AI extraction did not produce a candidate ingredient list.",
          durationMs: Date.now() - startedAt
        });
      }

      const aiAttempt = await verifyIngredientCandidate(aiCandidate, {
        productName: product.name,
        brand: product.brand,
        minIngredientCount: 8
      });

      return createTaskResult("AI ingredient extraction", {
        candidates: aiAttempt.verified ? [aiAttempt] : [],
        attempts: [aiAttempt],
        report: {
          lastReason: aiAttempt.verified
            ? "AI structured extraction produced a verified candidate list."
            : aiAttempt.rejectionReason || "AI extraction did not produce a verifiable ingredient list."
        },
        details: aiAttempt.verified
          ? "AI structured extraction produced a verified candidate list."
          : aiAttempt.rejectionReason || "AI extraction did not produce a verifiable ingredient list.",
        durationMs: Date.now() - startedAt
      });
    }
  };
}

async function runParallelStage(taskDefinitions, { parentSignal, timeoutMs = 0, stopOnFirst = true } = {}) {
  if (!taskDefinitions.length) {
    return {
      winner: null,
      results: [],
      cancelledLabels: [],
      timedOut: false
    };
  }

  const controller = new AbortController();
  const stageStartedAt = Date.now();
  const linkParentAbort = () => controller.abort(parentSignal?.reason || createAbortError());
  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort(parentSignal.reason || createAbortError());
    } else {
      parentSignal.addEventListener("abort", linkParentAbort, { once: true });
    }
  }

  const completedLabels = new Set();

  try {
    return await new Promise((resolve) => {
      let settled = 0;
      let resolved = false;
      const results = [];
      let timeout = null;

      const createTimeoutResults = () => {
        const reason = `Stage timed out after ${formatDuration(timeoutMs)}. Continuing without this source so the dashboard can respond.`;
        return taskDefinitions
          .filter((entry) => !completedLabels.has(entry.label))
          .map((entry) => createTaskResult(entry.label, {
            report: {
              lastReason: reason
            },
            details: reason,
            durationMs: Date.now() - stageStartedAt,
            cancelled: true,
            timedOut: true
          }));
      };

      const finish = (payload) => {
        if (resolved) {
          return;
        }

        resolved = true;
        if (timeout) {
          clearTimeout(timeout);
        }
        if (parentSignal) {
          parentSignal.removeEventListener("abort", linkParentAbort);
        }
        resolve(payload);
      };

      if (timeoutMs > 0) {
        timeout = setTimeout(() => {
          const timeoutError = createAbortError(`Stage timed out after ${formatDuration(timeoutMs)}`);
          controller.abort(timeoutError);
          finish({
            winner: null,
            results: [...results, ...createTimeoutResults()],
            cancelledLabels: [],
            timedOut: true
          });
        }, timeoutMs);
        timeout.unref?.();
      }

      for (const task of taskDefinitions) {
        Promise.resolve()
          .then(() => task.run({ signal: controller.signal }))
          .then((result) => {
            results.push(result);
            completedLabels.add(task.label);
            settled += 1;

            if (stopOnFirst && result.candidates.length > 0 && !resolved) {
              controller.abort(createAbortError(`Resolved by ${task.label}`));
              finish({
                winner: result,
                results: [...results],
                cancelledLabels: taskDefinitions.map((entry) => entry.label).filter((label) => !completedLabels.has(label)),
                timedOut: false
              });
              return;
            }

            if (settled === taskDefinitions.length) {
              const allCandidates = results.flatMap((entry) => entry.candidates || []);
              finish({
                winner: allCandidates.length
                  ? createTaskResult("Complete page comparison", {
                      candidates: allCandidates,
                      attempts: results.flatMap((entry) => entry.attempts || []),
                      details: `Compared all ${allCandidates.length} verified ingredient candidates found in this stage.`,
                      durationMs: Date.now() - stageStartedAt
                    })
                  : null,
                results: [...results],
                cancelledLabels: [],
                timedOut: false
              });
            }
          })
          .catch((error) => {
            const cancelled = controller.signal.aborted || isAbortError(error);
            const timedOut = cancelled && /timed out/i.test(String(error?.message || controller.signal.reason?.message || ""));
            const detail = timedOut
              ? `Stage timed out after ${formatDuration(timeoutMs)}. Continuing without this source so the dashboard can respond.`
              : cancelled
                ? "Cancelled after a verified ingredient list was found elsewhere."
                : error.message;
            const result = createTaskResult(task.label, {
              report: {
                lastReason: detail
              },
              details: detail,
              durationMs: Date.now() - stageStartedAt,
              cancelled,
              timedOut
            });
            results.push(result);
            completedLabels.add(task.label);
            settled += 1;

            if (settled === taskDefinitions.length && !resolved) {
              const allCandidates = results.flatMap((entry) => entry.candidates || []);
              finish({
                winner: allCandidates.length
                  ? createTaskResult("Complete page comparison", {
                      candidates: allCandidates,
                      attempts: results.flatMap((entry) => entry.attempts || []),
                      details: `Compared all ${allCandidates.length} verified ingredient candidates found in this stage.`,
                      durationMs: Date.now() - stageStartedAt
                    })
                  : null,
                results: [...results],
                cancelledLabels: [],
                timedOut
              });
            }
          });
      }
    });
  } finally {
    if (!controller.signal.aborted) {
      controller.abort(createAbortError());
    }
  }
}

function applyTaskTrace(processingTrace, taskResult) {
  const succeeded = taskResult.candidates.length > 0;
  const details = appendDuration(
    taskResult.details || taskResult.report?.lastReason || (succeeded ? "Verified ingredients found." : "No verified ingredient list found."),
    taskResult.durationMs
  );

  processingTrace.push(createStep(taskResult.label, succeeded ? "completed" : "failed", details));
}

function applyCancelledTrace(processingTrace, label, winnerLabel) {
  processingTrace.push(
    createStep(
      label,
      "failed",
      `Cancelled after verified ingredients were found in ${winnerLabel}.`
    )
  );
}

function collectTaskArtifacts(taskResults, attemptedSources, candidateAttempts, verifiedCandidates) {
  for (const result of taskResults) {
    for (const attempt of result.attempts || []) {
      candidateAttempts.push(attempt);
      pushAttemptedSource(attemptedSources, `${attempt.sourceWebsite}:${attempt.extractionMethod}`);
    }

    for (const candidate of result.candidates || []) {
      verifiedCandidates.push(candidate);
      pushAttemptedSource(attemptedSources, `${candidate.sourceWebsite}:${candidate.extractionMethod}`);
    }
  }
}

function isOfficialBrandWebsite(website = {}) {
  return website.websiteType === "official-brand-website";
}

function logStagePerformance(traceId, taskResult) {
  const report = taskResult.report || {};
  logUrlAnalysis("ingredient-resolution-stage", {
    traceId,
    stage: taskResult.label,
    durationMs: Math.round(taskResult.durationMs),
    verifiedCandidates: taskResult.candidates.length,
    attempts: taskResult.attempts.length,
    inspectedPages: report.inspectedPages ?? null,
    matchedPages: report.matchedPages ?? null,
    ingredientHits: report.ingredientHits ?? null,
    candidateUrls: Array.isArray(report.candidateUrls) ? report.candidateUrls.length : null,
    imageCount: report.imageCount ?? null,
    ocrAttempts: report.ocrAttempts ?? null,
    debugImageFolder: report.debugImageFolder || "",
    details: taskResult.details
  });
}

function createStageOneTasks({ retailerCandidates, product }) {
  const verificationContext = {
    productName: product.name,
    brand: product.brand,
    minIngredientCount: 8
  };

  const retailerPageCandidates = retailerCandidates.filter((candidate) => candidate.stage === "retailer-page" || candidate.extractionMethod === "regex-fallback");
  const structuredCandidates = retailerCandidates.filter((candidate) => candidate.stage === "structured-data" && !["json-ld", "__next_data__", "embedded-product-json"].includes(candidate.extractionMethod));
  const jsonLdCandidates = retailerCandidates.filter((candidate) => candidate.extractionMethod === "json-ld");
  const nextDataCandidates = retailerCandidates.filter((candidate) => candidate.extractionMethod === "__next_data__");
  const embeddedJsonCandidates = retailerCandidates.filter((candidate) => ["embedded-product-json", "__initial_state__"].includes(candidate.extractionMethod));

  return [
    createPoolTask(
      "Searching retailer page",
      retailerPageCandidates,
      verificationContext,
      (verified) => `Retailer page produced ${verified.verified.length} verified candidate list${verified.verified.length === 1 ? "" : "s"}`,
      "No ingredient list was found on the retailer page."
    ),
    createPoolTask(
      "Checking structured metadata",
      structuredCandidates,
      verificationContext,
      (verified) => `Structured metadata produced ${verified.verified.length} verified candidate list${verified.verified.length === 1 ? "" : "s"}`,
      "No ingredient list was found in structured metadata."
    ),
    createPoolTask(
      "Checking JSON-LD metadata",
      jsonLdCandidates,
      verificationContext,
      (verified) => `JSON-LD metadata produced ${verified.verified.length} verified candidate list${verified.verified.length === 1 ? "" : "s"}`,
      "No ingredient list was found in JSON-LD metadata."
    ),
    createPoolTask(
      "Checking __NEXT_DATA__",
      nextDataCandidates,
      verificationContext,
      (verified) => `__NEXT_DATA__ produced ${verified.verified.length} verified candidate list${verified.verified.length === 1 ? "" : "s"}`,
      "No ingredient list was found in __NEXT_DATA__."
    ),
    createPoolTask(
      "Checking embedded product JSON",
      embeddedJsonCandidates,
      verificationContext,
      (verified) => `Embedded product JSON produced ${verified.verified.length} verified candidate list${verified.verified.length === 1 ? "" : "s"}`,
      "No ingredient list was found in embedded product JSON."
    )
  ];
}

function createStageTwoTasks({ website, product, traceId }) {
  const officialTask = createSearchTask(
    "Searching official brand",
    (signal) => searchOfficialWebsiteForIngredients(product, {
      signal,
      traceId,
      searchTimeoutMs: 5000,
      fetchTimeoutMs: 5000,
      dynamicTimeoutMs: 8000
    }),
    "Official brand search completed.",
    "No official brand page contained a verified ingredient list."
  );

  const trustedTask = createSearchTask(
    "Searching trusted databases",
    (signal) => searchTrustedDatabasesForIngredients(product, {
      signal,
      searchTimeoutMs: 5000,
      fetchTimeoutMs: 5000,
      dynamicTimeoutMs: 8000
    }),
    "Trusted database search completed.",
    "No trusted cosmetic database contained a verified ingredient list."
  );

  const distributorTask = createSearchTask(
    "Searching distributor pages",
    (signal) => searchDistributorPagesForIngredients(product, {
      signal,
      searchTimeoutMs: 5000,
      fetchTimeoutMs: 5000,
      dynamicTimeoutMs: 8000
    }),
    "Distributor search completed.",
    "No distributor page contained a verified ingredient list."
  );

  if (isOfficialBrandWebsite(website)) {
    return [];
  }

  return [officialTask, trustedTask, distributorTask];
}



function createStageThreeTasks({ website, product, fetched, inputUrl }) {
  const tasks = [];

  if (!isOfficialBrandWebsite(website)) {
    tasks.push(
      createSearchTask(
        "Searching search engine results",
        (signal) => searchSearchEngineResultsForIngredients(product, {
          signal,
          searchTimeoutMs: 5000,
          fetchTimeoutMs: 5000,
          dynamicTimeoutMs: 8000
        }),
        "Broader web search completed.",
        "No broader web search result contained a verified ingredient list."
      )
    );
  }

  tasks.push(createAiTask({ fetched, inputUrl, website, product }));
  return tasks;
}

function createImageFallbackTasks({ inputUrl, website, product, traceId }) {
  return [
    createSearchTask(
      "Searching product label images",
      (signal) => searchProductImagesForIngredients({
        inputUrl,
        website,
        product,
        traceId,
        signal
      }),
      "Product label image search completed.",
      "No product label image contained a verified ingredient list."
    )
  ];
}
function getRemainingResolverBudget(startedAt = Date.now()) {
  return Math.max(1, MAX_RESOLVER_RUNTIME_MS - (Date.now() - startedAt));
}

function getEffectiveStageTimeout(configuredTimeoutMs, startedAt = Date.now()) {
  return Math.max(1, Math.min(configuredTimeoutMs, getRemainingResolverBudget(startedAt)));
}
function finalizeWinningStage({
  winner,
  processingTrace,
  attemptedSources,
  candidateAttempts,
  verifiedCandidates,
  inputUrl,
  website,
  product,
  traceId,
  context,
  stageMessage
}) {
  const chosen = compareIngredientLists(winner.candidates.length ? winner.candidates : verifiedCandidates);
  const uniqueCandidateSources = [...new Set((winner.candidates.length ? winner.candidates : verifiedCandidates).map((candidate) => candidate.sourceWebsite).filter(Boolean))];

  processingTrace.push(
    createStep(
      "Selecting best ingredient source",
      "completed",
      `Compared ${(winner.candidates.length ? winner.candidates : verifiedCandidates).length} verified candidate list${(winner.candidates.length ? winner.candidates : verifiedCandidates).length === 1 ? "" : "s"} across ${uniqueCandidateSources.length} source${uniqueCandidateSources.length === 1 ? "" : "s"} and selected ${chosen.sourceWebsite}.`
    )
  );
  processingTrace.push(...verificationTraceSteps(chosen.verification, chosen.sourceWebsite));

  const result = buildVerifiedResult({
    inputUrl,
    websiteLabel: website.websiteLabel,
    product,
    candidate: chosen,
    processingTrace,
    attemptedSources: finalizeAttempts(attemptedSources),
    candidateAttempts,
    traceId: traceId || context.traceId,
    message: stageMessage || `Using verified ingredient list from ${chosen.sourceWebsite} after an early parallel match.`
  });

  logUrlAnalysis("verified-url-analysis-complete", {
    traceId: traceId || context.traceId,
    inputUrl,
    sourceWebsite: result.sourceWebsite,
    extractionMethod: result.extractionMethod,
    ingredientCount: result.ingredientCount,
    confidenceScore: result.confidenceScore,
    candidateAttempts: candidateAttempts.length,
    totalDurationMs: Date.now() - (context.startedAt || Date.now())
  });

  return result;
}

export async function resolveIngredientsForProduct({ inputUrl, website, fetched, product, retailerCandidates = [], processingTrace = [], traceId }, context = {}) {
  const attemptedSources = [];
  const candidateAttempts = [];
  const verifiedCandidates = [];

  const resolverStartedAt = context.startedAt || Date.now();
  const stageGroups = [
    {
      tasks: createStageOneTasks({ retailerCandidates, product }),
      timeoutMs: STAGE_TIMEOUTS.initialExtraction,
      stopOnFirst: false
    },
    {
      tasks: createStageTwoTasks({ website, product, traceId: traceId || context.traceId }),
      timeoutMs: STAGE_TIMEOUTS.sourceDiscovery
    },
    {
      tasks: createStageThreeTasks({ website, product, fetched, inputUrl }),
      timeoutMs: STAGE_TIMEOUTS.broaderSearch
    },
    {
      tasks: createImageFallbackTasks({ inputUrl, website, product, traceId: traceId || context.traceId }),
      timeoutMs: STAGE_TIMEOUTS.imageFallback
    }
  ];

  for (const stageGroup of stageGroups) {
    const taskGroup = stageGroup.tasks;
    if (!taskGroup.length) {
      continue;
    }

    const stageOutcome = await runParallelStage(taskGroup, {
      timeoutMs: getEffectiveStageTimeout(stageGroup.timeoutMs, resolverStartedAt),
      stopOnFirst: stageGroup.stopOnFirst !== false
    });
    const orderedResults = taskGroup
      .map(({ label }) => stageOutcome.results.find((result) => result.label === label))
      .filter(Boolean);
    collectTaskArtifacts(orderedResults, attemptedSources, candidateAttempts, verifiedCandidates);

    for (const taskResult of orderedResults) {
      applyTaskTrace(processingTrace, taskResult);
      logStagePerformance(traceId || context.traceId, taskResult);
    }

    if (stageOutcome.winner) {
      for (const cancelledLabel of stageOutcome.cancelledLabels) {
        applyCancelledTrace(processingTrace, cancelledLabel, stageOutcome.winner.label);
      }

      return finalizeWinningStage({
        winner: stageOutcome.winner,
        processingTrace,
        attemptedSources,
        candidateAttempts,
        verifiedCandidates,
        inputUrl,
        website,
        product,
        traceId,
        context,
        stageMessage: `Using verified ingredient list from ${stageOutcome.winner.candidates[0]?.sourceWebsite || "the selected source"} after ${stageOutcome.winner.label.toLowerCase()} completed in parallel.`
      });
    }
  }

  const noIngredients = buildNoIngredientsResponse({
    inputUrl,
    sourceWebsite: website.websiteLabel,
    platform: website.websiteLabel,
    product,
    extractionMethod: fetched?.extractionMethod || "failed",
    processingTrace,
    attemptedSources: finalizeAttempts(attemptedSources),
    candidateAttempts,
    traceId: traceId || context.traceId
  });

  logUrlAnalysis("verified-url-analysis-complete", {
    traceId: traceId || context.traceId,
    inputUrl,
    sourceWebsite: noIngredients.sourceWebsite,
    extractionMethod: noIngredients.extractionMethod,
    ingredientCount: 0,
    confidenceScore: 0,
    candidateAttempts: candidateAttempts.length,
    totalDurationMs: Date.now() - (context.startedAt || Date.now())
  });

  return noIngredients;
}
