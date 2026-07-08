"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Globe,
  Link2,
  LoaderCircle,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound
} from "lucide-react";
import { useRouter } from "next/navigation";
import { analyzeInput } from "@/lib/analyzer";
import { api } from "@/lib/api";
import {
  formatDisplayValue,
  formatListValues,
  GENDER_OPTIONS,
  MAKEUP_USAGE_OPTIONS,
  SKINCARE_GOAL_OPTIONS,
  SKIN_TYPE_OPTIONS
} from "@/lib/profile-options";
import { products, recentSearches } from "@/lib/mock-data";
import { useSessionStore } from "@/store/use-session-store";
import { BrandMark } from "@/components/brand-mark";
import { ScoreDonut } from "@/components/score-donut";
import { SectionCard } from "@/components/section-card";

const defaultProduct = products[0].name;
const LOADING_STEPS = [
  "Validating URL",
  "Downloading webpage",
  "Extracting product information",
  "Looking for ingredients",
  "Searching official website",
  "Searching local database",
  "Running ingredient analysis"
];

export function DashboardShell() {
  const router = useRouter();
  const { user, profile, signOut } = useSessionStore();
  const [searchQuery, setSearchQuery] = useState(defaultProduct);
  const [productUrl, setProductUrl] = useState("");
  const [manualIngredients, setManualIngredients] = useState("");
  const [result, setResult] = useState(null);
  const [analysisMeta, setAnalysisMeta] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeLoadingIndex, setActiveLoadingIndex] = useState(0);
  const [inputError, setInputError] = useState("");

  useEffect(() => {
    if (!profile) {
      return;
    }

    setResult(
      analyzeInput({
        profile,
        productName: defaultProduct,
        manualIngredients: ""
      })
    );
    setAnalysisMeta({
      channel: "search",
      label: defaultProduct,
      processingTrace: []
    });
  }, [profile]);

  useEffect(() => {
    if (!isAnalyzing) {
      setActiveLoadingIndex(0);
      return;
    }

    const timer = window.setInterval(() => {
      setActiveLoadingIndex((previous) => (previous + 1) % LOADING_STEPS.length);
    }, 700);

    return () => window.clearInterval(timer);
  }, [isAnalyzing]);

  const profileSummary = useMemo(() => {
    if (!profile) {
      return [];
    }

    return [
      `Skin type: ${formatDisplayValue(SKIN_TYPE_OPTIONS, profile.skinType)}`,
      `Makeup use: ${formatDisplayValue(MAKEUP_USAGE_OPTIONS, profile.makeupUsage)}`,
      `Goals: ${formatListValues(SKINCARE_GOAL_OPTIONS, profile.primarySkincareGoals).join(", ")}`,
      profile.gender ? `Gender: ${formatDisplayValue(GENDER_OPTIONS, profile.gender)}` : null
    ].filter(Boolean);
  }, [profile]);

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

    try {
      let resolvedProductName = trimmedSearch;
      let resolvedIngredients = trimmedIngredients;
      let nextMeta = {
        channel: trimmedUrl ? "url" : trimmedIngredients ? "manual" : "search",
        label: trimmedUrl || trimmedSearch || "Custom Ingredient List",
        processingTrace: []
      };

      if (trimmedUrl) {
        const response = await api.post("/products/resolve-url", {
          url: trimmedUrl
        });
        const resolution = response.data;

        resolvedProductName =
          resolution.suggestedProduct?.name ||
          resolution.product?.name ||
          resolution.resolvedName ||
          trimmedSearch;
        resolvedIngredients = resolution.suggestedProduct
          ? ""
          : resolution.ingredientsText || trimmedIngredients;
        nextMeta = {
          channel: "url",
          label: resolution.product?.name || resolution.resolvedName,
          category: resolution.product?.category,
          brand: resolution.product?.brand,
          platform: resolution.platform,
          ingredientSource: resolution.ingredientSource,
          cacheHit: resolution.cacheHit,
          fallbackRequired: resolution.fallbackRequired,
          processingTrace: resolution.processingTrace || [],
          message: resolution.message
        };

        if (resolution.fallbackRequired && !resolvedIngredients) {
          setAnalysisMeta(nextMeta);
          setResult(null);
          setInputError(resolution.message);
          return;
        }
      }

      if (!resolvedProductName && !resolvedIngredients) {
        setResult(null);
        setInputError("We still need a product name or ingredient list to analyze.");
        return;
      }

      const analysis = analyzeInput({
        profile,
        productName: resolvedProductName,
        manualIngredients: resolvedIngredients
      });

      setResult(analysis);
      setAnalysisMeta(nextMeta);
    } catch (error) {
      const serverTrace = error.response?.data?.processingTrace || [];
      setResult(null);
      setAnalysisMeta((previous) => ({
        ...(previous || {}),
        processingTrace: serverTrace
      }));
      setInputError(
        error.response?.data?.message ||
          "That product URL could not be resolved yet. Paste ingredients too, or try a clearer product page link."
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  function handleSignOut() {
    signOut();
    router.replace("/");
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-6 overflow-hidden rounded-[36px] border border-white/60 bg-[linear-gradient(135deg,rgba(24,60,45,0.95),rgba(16,35,26,0.84))] p-8 text-white shadow-panel"
      >
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-4 flex items-center gap-4">
              <BrandMark tone="dark" />
            </div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-white/65">
              Welcome back, {user?.name || "DermIntel member"}
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl">
              Paste a product URL or ingredients and let DermIntel chase the best ingredient source.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-white/76 sm:text-lg">
              Amazon, Flipkart, Myntra, Nykaa, Purplle, Tira, and official brand pages now flow
              through a modular URL analysis engine with layered fallbacks.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3 text-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-white/55">Signed in</p>
              <p className="mt-1 font-medium text-white">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/18 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-6">
          <SectionCard title="Skin Passport" eyebrow="Your Profile">
            <div className="rounded-[28px] bg-pine p-5 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{user?.name || "DermIntel member"}</p>
                  <p className="text-xs text-white/68">{user?.email}</p>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {profileSummary.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-ink/8 bg-white/72 px-4 py-3 text-sm text-ink/72"
                >
                  {item}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Recent Searches" eyebrow="Dashboard">
            <div className="space-y-3">
              {recentSearches.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => {
                    setSearchQuery(term);
                    setProductUrl("");
                    handleAnalyze({
                      nextSearchQuery: term,
                      nextProductUrl: "",
                      nextManualIngredients: ""
                    });
                  }}
                  className="flex w-full items-center justify-between rounded-2xl border border-ink/8 bg-white/70 px-4 py-3 text-left text-sm transition hover:border-pine/30"
                >
                  <span>{term}</span>
                  <Search className="h-4 w-4 text-pine/60" />
                </button>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Analyze Product" eyebrow="Input Channels">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
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
                      className="w-full rounded-2xl border border-ink/10 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-pine"
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
                    className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-pine"
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
                    className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-pine"
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

              <div className="rounded-[28px] bg-pine p-5 text-white">
                <div className="flex items-center gap-2 text-sm font-medium text-white/70">
                  <Sparkles className="h-4 w-4" />
                  Personalized verdict
                </div>
                <h3 className="mt-3 text-2xl font-semibold">
                  {result?.productName || analysisMeta?.label || "Awaiting analysis"}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/76">
                  {result?.verdict ||
                    analysisMeta?.message ||
                    "Paste a link, type a product name, or paste ingredients to start a stricter analysis."}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {(profile?.primarySkinConcerns || []).map((concern) => (
                    <span
                      key={concern}
                      className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs uppercase tracking-[0.22em]"
                    >
                      {concern.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
                {analysisMeta ? (
                  <div className="mt-5 space-y-2 rounded-2xl border border-white/12 bg-white/8 p-4 text-sm">
                    <div className="flex items-center gap-2 text-white/75">
                      <Globe className="h-4 w-4" />
                      Source: {analysisMeta.channel}
                    </div>
                    <p className="font-medium text-white">{analysisMeta.label}</p>
                    {analysisMeta.platform ? (
                      <p className="text-white/68">Platform: {analysisMeta.platform}</p>
                    ) : null}
                    {analysisMeta.category ? (
                      <p className="text-white/68">Detected category: {analysisMeta.category}</p>
                    ) : null}
                    {analysisMeta.brand ? (
                      <p className="text-white/68">Detected brand: {analysisMeta.brand}</p>
                    ) : null}
                    {analysisMeta.ingredientSource ? (
                      <p className="text-white/68">
                        Ingredient source: {analysisMeta.ingredientSource}
                      </p>
                    ) : null}
                    {analysisMeta.cacheHit ? (
                      <p className="text-white/68">Returned from DermIntel cache for speed.</p>
                    ) : null}
                    {analysisMeta.message ? (
                      <p className="text-white/68">{analysisMeta.message}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <SectionCard title="Processing Flow" eyebrow="Background Steps">
              {isAnalyzing ? (
                <div className="space-y-3">
                  {LOADING_STEPS.map((step, index) => (
                    <div
                      key={step}
                      className={`rounded-2xl border px-4 py-3 text-sm transition ${
                        index <= activeLoadingIndex
                          ? "border-pine bg-pine/8 text-ink"
                          : "border-ink/8 bg-white/72 text-ink/50"
                      }`}
                    >
                      <span className="font-medium">
                        {index < activeLoadingIndex
                          ? "[done]"
                          : index === activeLoadingIndex
                            ? "[...]"
                            : "[ ]"}
                      </span>{" "}
                      {step}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {(
                    analysisMeta?.processingTrace?.length
                      ? analysisMeta.processingTrace
                      : [
                          {
                            label: "No URL pipeline run yet.",
                            state: "idle",
                            details: "Use a product link to see the retrieval steps."
                          }
                        ]
                  ).map((step) => (
                    <div
                      key={`${step.label}-${step.state}`}
                      className="rounded-2xl border border-ink/8 bg-white/72 px-4 py-3 text-sm text-ink/72"
                    >
                      <p className="font-semibold text-ink">
                        {step.state === "completed"
                          ? "[done]"
                          : step.state === "failed"
                            ? "[!]"
                            : step.state === "skipped"
                              ? "[-]"
                              : "[ ]"}{" "}
                        {step.label}
                      </p>
                      <p className="mt-1 text-ink/58">{step.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Score Snapshot" eyebrow="Charts">
              {result ? (
                <>
                  <div className="flex flex-col items-center gap-6">
                    <ScoreDonut value={result.safetyScore || 0} label="Safety" />
                    <ScoreDonut value={result.suitabilityScore || 0} label="Suitability" />
                  </div>
                  <p className="mt-5 text-center text-sm leading-6 text-ink/58">
                    Scores now start from a stricter baseline and drop further for uncertainty,
                    pore-clogging risk, irritation, and allergy overlap.
                  </p>
                </>
              ) : (
                <p className="text-center text-sm leading-6 text-ink/58">
                  A score appears only after DermIntel has either found ingredients automatically
                  or you paste them manually.
                </p>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Personalized Verdict" eyebrow="Analysis Result">
            {result ? (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="space-y-4">
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

                <div className="space-y-4">
                  <div className="rounded-[28px] border border-ink/8 bg-white/72 p-5">
                    <p className="text-sm font-semibold text-ink">Matched ingredients</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(result?.matchedIngredients || []).map((ingredient) => (
                        <span
                          key={ingredient.name}
                          className="rounded-full bg-mist px-3 py-2 text-xs font-medium uppercase tracking-[0.12em] text-pine"
                        >
                          {ingredient.name}
                        </span>
                      ))}
                    </div>
                  </div>

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
                DermIntel needs a real product page or a pasted ingredient list before it can
                generate a verdict.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Alternative Picks" eyebrow="Recommendations">
            <div className="grid gap-4 md:grid-cols-3">
              {(result?.alternatives || []).map((product) => (
                <article
                  key={product.id}
                  className="rounded-[24px] border border-ink/8 bg-white/72 p-5 transition hover:-translate-y-1"
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
      </div>
    </main>
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
