"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  LoaderCircle,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { API_BASE_URL, api } from "@/lib/api";
import {
  ALLERGY_OPTIONS,
  formatDisplayValue,
  formatListValues,
  HAIR_DENSITY_OPTIONS,
  HAIR_TYPE_OPTIONS,
  SKINCARE_GOAL_OPTIONS,
  SKIN_CONCERN_OPTIONS,
  SKIN_SENSITIVITY_OPTIONS,
  SKIN_TYPE_OPTIONS
} from "@/lib/profile-options";
import { products } from "@/lib/mock-data";
import { useSessionStore } from "@/store/use-session-store";
import { BrandMark } from "@/components/brand-mark";
import { ScoreDonut } from "@/components/score-donut";
import { SectionCard } from "@/components/section-card";

export function DashboardShell() {
  const router = useRouter();
  const { user, profile, signOut } = useSessionStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [manualIngredients, setManualIngredients] = useState("");
  const [result, setResult] = useState(null);
  const [analysisMeta, setAnalysisMeta] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [inputError, setInputError] = useState("");


  const profileSummary = useMemo(() => buildProfileSummary(profile), [profile]);

  const scoreSummary = useMemo(() => {
    if (!result) {
      return null;
    }

    return {
      safety: result.safetyScore || 0,
      suitability: result.suitabilityScore || 0,
      confidence: typeof result.confidenceScore === "number" ? result.confidenceScore : null,
      safetyStatus: getScoreStatus(result.safetyScore || 0),
      suitabilityStatus: getScoreStatus(result.suitabilityScore || 0)
    };
  }, [result]);

  const verdictProductImage =
    analysisMeta?.image || result?.product?.image || result?.product?.imageUrl || "";

  async function handleAnalyze({
    nextSearchQuery = searchQuery,
    nextProductUrl = productUrl,
    nextManualIngredients = manualIngredients
  } = {}) {
    if (!profile) {
      return;
    }

    const trimmedSearch = nextSearchQuery.trim();
    const trimmedUrl = nextProductUrl.trim();
    const trimmedIngredients = nextManualIngredients.trim();

    if (!trimmedSearch && !trimmedUrl && !trimmedIngredients) {
      setInputError("Paste a product URL, type a product name, or paste ingredients to analyze.");
      return;
    }

    setIsAnalyzing(true);
    setInputError("");
    setResult(null);
    setAnalysisMeta(
      trimmedUrl
        ? {
            channel: "url",
            label: trimmedUrl,
            processingTrace: buildPendingUrlTrace(),
            message: "Starting verified ingredient search..."
          }
        : {
            channel: trimmedIngredients ? "manual" : "search",
            label: trimmedSearch || "Custom Ingredient List",
            processingTrace: buildPendingAnalysisTrace(Boolean(trimmedIngredients)),
            ingredientsText: trimmedIngredients,
            ingredientList: normalizeVerifiedIngredientList(trimmedIngredients),
            message: "Preparing personalized analysis..."
          }
    );

    try {
      let resolvedProductName = trimmedSearch;
      let resolvedIngredients = trimmedIngredients;
      let nextMeta = {
        channel: trimmedUrl ? "url" : trimmedIngredients ? "manual" : "search",
        label: trimmedUrl || trimmedSearch || "Custom Ingredient List",
        processingTrace: buildPendingAnalysisTrace(Boolean(trimmedIngredients)),
            ingredientsText: trimmedIngredients,
        ingredientList: normalizeVerifiedIngredientList(trimmedIngredients)
      };

      if (trimmedUrl) {
        const response = await api.post("/products/resolve-url", {
          url: trimmedUrl
        });
        const resolution = response.data;

        resolvedProductName = resolution.product?.name || trimmedSearch;
        resolvedIngredients = resolution.ingredientsText || trimmedIngredients;
        nextMeta = {
          channel: "url",
          status: resolution.status,
          sourceUrl: trimmedUrl,
          label: resolution.product?.name || trimmedUrl,
          image: resolution.product?.image || "",
          category: resolution.product?.category,
          brand: resolution.product?.brand,
          platform: resolution.platform,
          sourceWebsite: resolution.sourceWebsite,
          extractionMethod: resolution.extractionMethod,
          ingredientSource: resolution.ingredientSource,
          confidenceScore: resolution.confidenceScore,
          ingredientCount: resolution.ingredientCount,
          ingredientsText: resolution.ingredientsText,
          ingredientList: normalizeVerifiedIngredientList(
            resolution.ingredientList?.length ? resolution.ingredientList : resolution.ingredientsText
          ),
          cacheHit: resolution.cacheHit,
          verifiedIngredients: resolution.verifiedIngredients,
          processingTrace: resolution.processingTrace || [],
          message: resolution.message,
          failureCode: resolution.failureCode,
          communityFallbackAvailable: resolution.communityFallbackAvailable,
          recommendedAction: resolution.recommendedAction,
          productDetected: Boolean(resolution.product?.name || resolution.product?.brand || resolution.product?.variant)
        };

        if (resolution.status === "NO_VERIFIED_INGREDIENTS" || !resolution.verifiedIngredients) {
          setAnalysisMeta(nextMeta);
          setResult(null);
          setInputError(buildResolutionFailureMessage(resolution));
          return;
        }

        nextMeta = {
          ...nextMeta,
          processingTrace: appendGeneratingAnalysisStep(nextMeta.processingTrace)
        };
        setAnalysisMeta(nextMeta);
      }

      if (!resolvedProductName && !resolvedIngredients) {
        setResult(null);
        setInputError("We still need a product name or ingredient list to analyze.");
        return;
      }

      const response = await api.post("/analysis", {
        profile,
        productName: resolvedProductName,
        ingredientsText: resolvedIngredients
      });

      if (response.data.status === "NO_VERIFIED_INGREDIENTS" || response.data.verifiedIngredients === false) {
        setResult(null);
        setAnalysisMeta({
          ...nextMeta,
          processingTrace: failGeneratingAnalysisStep(nextMeta.processingTrace, response.data.message),
          message: response.data.message
        });
        setInputError(response.data.message);
        return;
      }

      setResult(response.data);
      setAnalysisMeta({
        ...nextMeta,
        processingTrace: completeGeneratingAnalysisStep(nextMeta.processingTrace)
      });
    } catch (error) {
      const serverTrace = error.response?.data?.processingTrace || [];
      const errorMessage = buildUrlResolutionErrorMessage(error);
      setResult(null);
      setAnalysisMeta((previous) =>
        trimmedUrl
          ? {
              ...(previous || {}),
              channel: "url",
              status: "URL_RESOLUTION_FAILED",
              label: "URL analysis failed",
              sourceUrl: trimmedUrl,
              sourceWebsite: formatUrlForDisplay(trimmedUrl),
              verifiedIngredients: false,
              processingTrace: buildUrlFailureTrace(serverTrace, errorMessage),
              message: errorMessage,
              failureCode: error.response ? "URL_RESOLUTION_ERROR" : "API_UNREACHABLE",
              communityFallbackAvailable: true,
              recommendedAction: "PASTE_OR_UPLOAD_INGREDIENTS"
            }
          : {
              ...(previous || {}),
              processingTrace: serverTrace
            }
      );
      setInputError(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleSignOut() {
    signOut();
    router.replace("/");
  }

  function handleEditSkinProfile() {
    router.push("/onboarding?edit=1");
  }

  const userInitials = getUserInitials(user?.name, user?.email);

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] overflow-hidden px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mb-5 overflow-hidden rounded-[26px] border border-white/50 bg-[linear-gradient(135deg,rgba(24,60,45,0.98),rgba(16,35,26,0.9))] px-4 py-4 text-white shadow-panel sm:px-6"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <BrandMark tone="dark" />
            <div className="hidden min-w-0 border-l border-white/12 pl-4 sm:block">
              <p className="truncate text-sm font-semibold text-white sm:text-base">
                Welcome back, {user?.name || "DermIntel member"}
              </p>
              <p className="mt-1 text-sm text-white/70">
                Analyze cosmetic products intelligently.
              </p>
            </div>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/8 text-sm font-semibold text-white ring-1 ring-white/10">
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user?.name || "DermIntel member"}
                className="h-11 w-11 rounded-2xl object-cover"
              />
            ) : (
              userInitials
            )}
          </div>
        </div>
      </motion.section>

      <div className="grid min-w-0 gap-5 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-4 lg:self-start xl:col-span-3">
          <SectionCard title="Your skin passport" eyebrow="Personal context" className="h-full p-5">
            <div className="rounded-[24px] bg-[linear-gradient(160deg,rgba(24,60,45,0.96),rgba(16,35,26,0.88))] p-5 text-white shadow-panel">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/12 bg-white/10 text-base font-semibold text-white ring-1 ring-white/10">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user?.name || "DermIntel member"}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    userInitials.charAt(0)
                  )}
                </div>
                <p className="text-base font-semibold text-white sm:text-lg">
                  {user?.name || "DermIntel member"}
                </p>
              </div>

              <div className="mt-5 rounded-[22px] border border-white/10 bg-white/8 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/58">
                  Profile Summary
                </p>
                <p className="mt-3 text-sm leading-7 text-white/82">{profileSummary}</p>
              </div>

              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  onClick={handleEditSkinProfile}
                  className="inline-flex w-full items-center justify-center rounded-full border border-white/18 bg-white px-4 py-3 text-sm font-semibold text-pine transition hover:bg-white/92"
                >
                  Edit Skin Profile
                </button>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/18 bg-white/8 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="min-w-0 lg:col-span-8 xl:col-span-9">
          <SectionCard title="Decode a product" eyebrow="New analysis" className="h-full">
            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(280px,.92fr)]">
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink/70">
                    Paste product URL
                  </span>
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-pine/45" />
                    <input
                      type="url"
                      value={productUrl}
                      onChange={(event) => setProductUrl(event.target.value)}
                      className="w-full min-w-0 rounded-2xl border border-ink/10 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-pine focus:ring-4 focus:ring-pine/5"
                      placeholder="https://www.nykaa.com/... or https://www.amazon.in/..."
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink/70">
                    Manual product search
                  </span>
                  <input
                    list="catalog-products"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full min-w-0 rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-pine focus:ring-4 focus:ring-pine/5"
                    placeholder="Type a face wash, serum, sunscreen, shampoo..."
                  />
                  <datalist id="catalog-products">
                    {products.map((product) => (
                      <option key={product.id} value={product.name} />
                    ))}
                  </datalist>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink/70">
                    Manual ingredient paste
                  </span>
                  <textarea
                    rows={6}
                    value={manualIngredients}
                    onChange={(event) => setManualIngredients(event.target.value)}
                    className="w-full min-w-0 resize-y rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-pine focus:ring-4 focus:ring-pine/5"
                    placeholder="Water, Glycerin, Niacinamide, Fragrance..."
                  />
                </label>

                {inputError ? (
                  <div className="rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
                    {inputError}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => handleAnalyze()}
                  disabled={isAnalyzing}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-pine px-6 py-3 text-sm font-semibold text-white shadow-panel transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isAnalyzing ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {isAnalyzing ? "Analyzing formula..." : "Analyze now"}
                </button>
              </div>

              <div className="min-w-0 overflow-hidden rounded-[24px] bg-pine p-5 text-white">
                <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                  <Sparkles className="h-4 w-4" />
                  Personalized verdict
                </div>
                <h3 className="display-type mt-3 break-words text-3xl font-semibold leading-tight">
                  {result?.productName || analysisMeta?.label || "Awaiting analysis"}
                </h3>
                {verdictProductImage ? (
                  <div className="mt-4 overflow-hidden rounded-[22px] border border-white/12 bg-white/10">
                    <img
                      src={verdictProductImage}
                      alt={result?.productName || analysisMeta?.label || "Product image"}
                      className="h-48 w-full object-cover"
                    />
                  </div>
                ) : null}
                <p className="mt-3 text-sm leading-6 text-white/76">
                  {result?.verdict ||
                    "Paste a link, type a product name, or paste ingredients to start a stricter analysis."}
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Formula snapshot" eyebrow="Scores & signals" className="mt-5">
        {result && scoreSummary ? (
          <>
            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-12">
              <div className="min-w-0 md:col-span-6 lg:col-span-4">
              <ScoreMetricCard
                label="Safety"
                value={scoreSummary.safety}
                status={scoreSummary.safetyStatus}
              />
              </div>
              <div className="min-w-0 md:col-span-6 lg:col-span-4">
              <ScoreMetricCard
                label="Suitability"
                value={scoreSummary.suitability}
                status={scoreSummary.suitabilityStatus}
              />
              </div>
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
                className="bento-card lift-card flex min-h-[260px] min-w-0 flex-col justify-between rounded-[26px] p-5 md:col-span-12 lg:col-span-4"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-pine/54">
                    Score Summary
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-ink/72">
                    <SummaryRow label="Safety Score" value={scoreSummary.safety} />
                    <SummaryRow label="Suitability Score" value={scoreSummary.suitability} />
                    {scoreSummary.confidence !== null ? (
                      <SummaryRow label="Confidence Score" value={`${scoreSummary.confidence}%`} />
                    ) : null}
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-pine/10 bg-mist px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine/56">
                      Final Verdict
                    </p>
                    <p className="mt-2 text-sm font-medium leading-6 text-ink">
                      {result.verdict}
                    </p>
                  </div>
                  {result.confidenceDetails?.length ? (
                    <div className="rounded-2xl border border-ink/8 bg-white/78 px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine/56">
                        Confidence Details
                      </p>
                      <div className="mt-3 space-y-2">
                        {result.confidenceDetails.map((detail) => (
                          <p
                            key={detail}
                            className="flex items-start gap-2 text-sm leading-6 text-ink/72"
                          >
                            <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-emerald-600" />
                            <span>{detail}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </motion.div>
            </div>
            <p className="mt-4 text-sm leading-6 text-ink/56">
              Scores are calculated using ingredient safety, irritation risk, comedogenic rating,
              uncertainty, and your personalized skin profile.
            </p>
          </>
        ) : (
          <p className="text-center text-sm leading-6 text-ink/58">
            A score appears only after DermIntel has verified ingredients from the product page,
            a trusted source, or from ingredients you pasted manually.
          </p>
        )}
      </SectionCard>

      <div className="mt-5 grid min-w-0 gap-5">
        <SectionCard title="Your personalized verdict" eyebrow="Analysis result">
          {result ? (
            <div className="grid min-w-0 gap-4 xl:grid-cols-12">
              <div className="min-w-0 space-y-4 xl:col-span-4">
                <InfoList
                  icon={<ShieldCheck className="h-4 w-4" />}
                  title="Top positives"
                  items={result?.pros}
                  emptyMessage="No standout strengths yet."
                  tone="emerald"
                />
                <InfoList
                  icon={<AlertTriangle className="h-4 w-4" />}
                  title="Watchouts"
                  items={result?.cons}
                  emptyMessage="No major warning flags detected."
                  tone="amber"
                />
              </div>

              <div className="min-w-0 space-y-4 xl:col-span-8">
                <IngredientBreakdownCard result={result} />

                <div className="rounded-[28px] border border-ink/8 bg-white/72 p-5">
                  <p className="text-sm font-semibold text-ink">Unknown ingredients</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(result?.unknownIngredients?.length
                      ? result.unknownIngredients
                      : ["None"]).map((ingredient) => (
                      <span
                        key={ingredient}
                        className="rounded-full bg-coral/10 px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-coral"
                      >
                        {ingredient}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-6 text-ink/62">
              DermIntel needs verified ingredients from a real product page or from your manual
              ingredient paste before it can generate a verdict.
            </p>
          )}
        </SectionCard>

        <SectionCard title="Better-matched alternatives" eyebrow="Recommendations">
          <div className="grid gap-4 md:grid-cols-3">
            {(result?.alternatives || []).map((product) => (
              <article
                key={product.id}
                className="lift-card min-w-0 rounded-[24px] border border-ink/8 bg-white/72 p-5"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine/56">
                  {product.category}
                </p>
                <h3 className="mt-3 text-lg font-semibold text-ink">{product.name}</h3>
                <p className="mt-2 text-sm text-ink/62">{product.brand}</p>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>
    </main>
  );
}

function ScoreMetricCard({ label, value, status }) {
  const badgeClass = getScoreBadgeClass(status);

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="bento-card lift-card flex min-h-[260px] w-full min-w-0 flex-col items-center justify-center rounded-[26px] px-4 py-5 text-center"
    >
      <ScoreDonut value={value} size={152} />
      <p className="mt-4 text-sm font-semibold text-ink">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-ink">{value}</p>
      <span
        className={`mt-3 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${badgeClass}`}
      >
        {status}
      </span>
    </motion.div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-ink/6 bg-white/72 px-3 py-2.5">
      <span className="text-ink/56">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function IngredientBreakdownCard({ result }) {
  const rows = result?.ingredientBreakdown || [];

  return (
    <div className="rounded-[28px] border border-ink/8 bg-white/72 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink">Estimated ingredient list</p>
          <p className="mt-1 text-sm leading-6 text-ink/58">
            Ingredient percentages are estimated only from verified INCI order.
          </p>
        </div>
      </div>

      <div className="no-scrollbar mt-4 max-w-full overflow-x-auto rounded-[22px] border border-ink/8 bg-white/80">
        <table className="min-w-[760px] divide-y divide-ink/8 text-sm">
          <thead className="bg-mist/70 text-left text-xs uppercase tracking-[0.18em] text-pine/62">
            <tr>
              <th className="px-4 py-3 font-semibold">Ingredient</th>
              <th className="px-4 py-3 font-semibold">Estimated %</th>
              <th className="px-4 py-3 font-semibold">Risk</th>
              <th className="px-4 py-3 font-semibold">Suitability</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/6">
            {rows.map((row) => (
              <tr key={row.name}>
                <td className="px-4 py-3">
                  <p className="font-medium capitalize text-ink">{row.name}</p>
                  <p className="mt-1 text-xs leading-5 text-ink/52">{row.explanation}</p>
                </td>
                <td className="px-4 py-3 text-ink/68">{row.estimatedRange}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getRiskBadgeClass(row.riskLevel)}`}
                  >
                    {row.riskLevel}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getSuitabilityBadgeClass(row.suitability)}`}
                  >
                    {row.suitability}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {result?.ingredientEstimateDisclaimer ? (
        <p className="mt-3 text-xs leading-5 text-ink/50">{result.ingredientEstimateDisclaimer}</p>
      ) : null}
    </div>
  );
}
function InfoList({ icon, title, items = [], emptyMessage, tone }) {
  const toneClass =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-700";

  return (
    <div className="rounded-[28px] border border-ink/8 bg-white/72 p-5">
      <div
        className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] ${toneClass}`}
      >
        {icon}
        {title}
      </div>
      <div className="mt-4 space-y-3 text-sm text-ink/72">
        {(items.length ? items : [emptyMessage]).map((item) => (
          <p key={item} className="rounded-2xl bg-mist px-4 py-3 leading-6">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function normalizeVerifiedIngredientList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function formatIngredientName(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function buildPendingUrlTrace() {
  return [
    {
      label: "Detecting website",
      state: "in_progress",
      details: "Checking which website the product URL belongs to."
    },
    {
      label: "Parsing retailer page",
      state: "pending",
      details: "Fetching the retailer page and extracting product metadata."
    },
    {
      label: "Searching retailer page",
      state: "pending",
      details: "Looking for a verified INCI list on the retailer page."
    },
    {
      label: "Checking structured metadata",
      state: "pending",
      details: "Checking JSON-LD and other structured product metadata."
    },
    {
      label: "Searching official brand",
      state: "pending",
      details: "Searching official brand pages for a verified ingredient list."
    },
    {
      label: "Searching trusted databases",
      state: "pending",
      details: "Checking trusted cosmetic databases such as INCI Decoder and CosDNA."
    },
    {
      label: "Searching distributor pages",
      state: "pending",
      details: "Checking pharmacy and distributor product pages."
    },
    {
      label: "Searching search engine results",
      state: "pending",
      details: "Checking broader web results only after trusted sources are exhausted."
    }
  ];
}

function buildPendingAnalysisTrace(isManualIngredients) {
  return [
    {
      label: isManualIngredients ? "Verifying manual ingredient input" : "Selecting product data",
      state: "completed",
      details: isManualIngredients
        ? "Using the ingredient list you pasted manually."
        : "Using the selected product information for analysis."
    },
    {
      label: "Generating AI analysis",
      state: "in_progress",
      details: "Calculating safety, suitability, and compatibility scores."
    }
  ];
}

function appendGeneratingAnalysisStep(steps = []) {
  return [
    ...steps,
    {
      label: "Generating AI analysis",
      state: "in_progress",
      details: "Verified ingredients found. Running personalized analysis."
    }
  ];
}

function completeGeneratingAnalysisStep(steps = []) {
  return steps.map((step) =>
    step.label === "Generating AI analysis"
      ? {
          ...step,
          state: "completed",
          details: "Verified ingredients analyzed successfully."
        }
      : step
  );
}

function failGeneratingAnalysisStep(steps = [], message) {
  return steps.map((step) =>
    step.label === "Generating AI analysis"
      ? {
          ...step,
          state: "failed",
          details: message || "Analysis stopped because DermIntel could not verify the ingredients."
        }
      : step
  );
}

function formatUrlForDisplay(value = "") {
  try {
    const parsed = new URL(value);
    return `${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "");
  } catch (_error) {
    return String(value || "").slice(0, 96);
  }
}

function buildUrlResolutionErrorMessage(error) {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.code === "ECONNABORTED") {
    return "DermIntel took too long to resolve this product URL. The website may be blocking automated access, or image/OCR lookup is still running. Try a cleaner product URL, or paste/upload the ingredients.";
  }

  if (!error.response) {
    return `DermIntel API is not reachable at ${API_BASE_URL}. Start the backend and try again.`;
  }

  return "That product URL could not be resolved yet. Paste ingredients too, upload the ingredient label, or try a clearer product page link.";
}

function buildUrlFailureTrace(serverTrace = [], message = "") {
  if (serverTrace.length) {
    return serverTrace.map((step, index) =>
      index === serverTrace.length - 1 && step.state !== "failed"
        ? {
            ...step,
            state: "failed",
            details: step.details || message
          }
        : step
    );
  }

  return [
    {
      label: "Connecting to DermIntel API",
      state: "failed",
      details: message || "The URL resolver request failed before DermIntel could inspect the product page."
    },
    ...buildPendingUrlTrace().slice(1)
  ];
}
function getUserInitials(name, email) {
  const seed = (name || email || "DermIntel member").trim();
  const parts = seed.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function buildProfileSummary(profile) {
  if (!profile) {
    return "Set up your skin passport once and DermIntel will tailor every future ingredient analysis to your skin, hair, and concern profile.";
  }

  const skinType = formatDisplayValue(SKIN_TYPE_OPTIONS, profile.skinType).toLowerCase();
  const sensitivity = formatDisplayValue(
    SKIN_SENSITIVITY_OPTIONS,
    profile.skinSensitivity
  ).toLowerCase();
  const hairDensity = formatDisplayValue(HAIR_DENSITY_OPTIONS, profile.hairDensity).toLowerCase();
  const hairType = formatDisplayValue(HAIR_TYPE_OPTIONS, profile.hairType).toLowerCase();
  const concerns = formatListValues(SKIN_CONCERN_OPTIONS, profile.primarySkinConcerns || [])
    .map((item) => item.toLowerCase())
    .slice(0, 3);
  const goals = formatListValues(SKINCARE_GOAL_OPTIONS, profile.primarySkincareGoals || [])
    .map((item) => item.toLowerCase())
    .slice(0, 3);
  const allergies = formatListValues(
    ALLERGY_OPTIONS,
    (profile.cosmeticAllergies || []).filter((item) => item !== "NONE" && item !== "OTHER")
  ).map((item) => item.toLowerCase());

  if (profile.otherAllergy) {
    allergies.push(profile.otherAllergy.toLowerCase());
  }

  const priorityTags = [];

  if (profile.skinType === "OILY" || profile.primarySkinConcerns?.includes("ACNE")) {
    priorityTags.push("non-comedogenic");
    priorityTags.push("acne-safe");
  }

  if (profile.skinSensitivity !== "NOT_SENSITIVE" || allergies.length) {
    priorityTags.push("fragrance-free");
    priorityTags.push("low-irritation");
  }

  if (
    profile.skinType === "DRY" ||
    profile.primarySkincareGoals?.includes("BARRIER_REPAIR") ||
    profile.primarySkincareGoals?.includes("HYDRATION")
  ) {
    priorityTags.push("skin-barrier-friendly");
  }

  if (
    profile.primarySkinConcerns?.includes("PIGMENTATION") ||
    profile.primarySkinConcerns?.includes("DARK_SPOTS") ||
    profile.primarySkincareGoals?.includes("BRIGHTENING")
  ) {
    priorityTags.push("tone-evening");
  }

  const priorities = [...new Set(priorityTags)].slice(0, 3);

  const sentences = [
    `You have ${skinType} skin with ${sensitivity} sensitivity and ${hairDensity}-density ${hairType} hair.`
  ];

  if (concerns.length) {
    sentences.push(`Your primary concerns are ${toSentenceList(concerns)}.`);
  }

  if (allergies.length) {
    sentences.push(`DermIntel will watch closely for ${toSentenceList(allergies.slice(0, 2))} triggers.`);
  }

  if (priorities.length) {
    sentences.push(`Your analyses will prioritize ${toSentenceList(priorities)} ingredients.`);
  } else if (goals.length) {
    sentences.push(`Your analyses will prioritize formulas aligned with ${toSentenceList(goals)} goals.`);
  }

  return sentences.join(" ");
}

function toSentenceList(values) {
  if (!values.length) {
    return "your profile";
  }

  if (values.length === 1) {
    return values[0];
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function getScoreStatus(value) {
  if (value >= 75) {
    return "Safe";
  }

  if (value >= 50) {
    return "Moderate";
  }

  return "Risky";
}

function getScoreBadgeClass(status) {
  if (status === "Safe") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "Moderate") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-coral/12 text-coral";
}

function getRiskBadgeClass(riskLevel) {
  if (riskLevel === "LOW") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (riskLevel === "MEDIUM") {
    return "bg-amber-50 text-amber-700";
  }

  if (riskLevel === "HIGH") {
    return "bg-coral/12 text-coral";
  }

  return "bg-slate-100 text-slate-600";
}

function getSuitabilityBadgeClass(suitability) {
  if (suitability === "Good Match") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (suitability === "Low Match") {
    return "bg-coral/12 text-coral";
  }

  return "bg-slate-100 text-slate-600";
}

function buildResolutionFailureMessage(resolution = {}) {
  const productName = resolution.product?.name || resolution.product?.brand || "this product";

  if (resolution.failureCode === "NO_PUBLIC_INGREDIENT_LIST") {
    return `DermIntel found ${productName}, but no verified ingredient list was published on the retailer page, structured metadata, official brand site, or trusted databases.`;
  }

  return resolution.message || "We couldn't verify the ingredient list for this product yet.";
}

function buildAnalysisMetaSummary(meta = {}) {
  const detectedProduct = meta.label || "this product";

  if (meta.verifiedIngredients === false) {
    return `We identified ${detectedProduct}, but we could not verify a trustworthy ingredient list from the checked sources, so DermIntel stopped before generating a formula analysis.`;
  }

  return meta.message || "Awaiting verified ingredient data.";
}

function getResolutionActions(meta = {}) {
  const actions = [];

  if (meta.productDetected) {
    actions.push("Product identity was detected successfully.");
  }

  if (meta.recommendedAction === "UPLOAD_INGREDIENT_LABEL" || meta.communityFallbackAvailable) {
    actions.push("Next best step: upload the ingredient label or paste the INCI list manually.");
  } else {
    actions.push("Next best step: paste the ingredient list manually for strict analysis.");
  }

  if (meta.failureCode === "NO_PUBLIC_INGREDIENT_LIST") {
    actions.push("DermIntel refused to guess ingredients because none of the checked sources returned a verified formula.");
  }

  return actions;
}









