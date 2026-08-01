"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { api } from "@/lib/api";
import {
  ALLERGY_OPTIONS,
  AVOID_INGREDIENT_OPTIONS,
  DEFAULT_PROFILE_FORM,
  HAIRCARE_GOAL_OPTIONS,
  HAIR_CONCERN_OPTIONS,
  HAIR_TYPE_OPTIONS,
  PROFILE_QUESTION_STEPS,
  SCALP_TYPE_OPTIONS,
  SKIN_CONCERN_OPTIONS,
  SKIN_SENSITIVITY_OPTIONS,
  SKIN_TYPE_OPTIONS,
  SKINCARE_GOAL_OPTIONS
} from "@/lib/profile-options";
import { useSessionStore } from "@/store/use-session-store";

const OPTION_GROUPS = {
  skinType: SKIN_TYPE_OPTIONS,
  skinSensitivity: SKIN_SENSITIVITY_OPTIONS,
  primarySkinConcerns: SKIN_CONCERN_OPTIONS,
  primarySkincareGoals: SKINCARE_GOAL_OPTIONS,
  cosmeticAllergies: ALLERGY_OPTIONS,
  hairType: HAIR_TYPE_OPTIONS,
  scalpType: SCALP_TYPE_OPTIONS,
  hairConcerns: HAIR_CONCERN_OPTIONS,
  haircareGoals: HAIRCARE_GOAL_OPTIONS,
  avoidIngredients: AVOID_INGREDIENT_OPTIONS
};

const OPTION_VALUE_SETS = Object.fromEntries(
  Object.entries(OPTION_GROUPS).map(([field, options]) => [field, new Set(options.map((option) => option.value))])
);

const LEGACY_HAIRCARE_GOAL_MAP = {
  HAIR_GROWTH: "HAIR_GROWTH",
  HAIR_SMOOTHENING: "SMOOTH_HAIR"
};

function filterValidSelections(values, validValues) {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(new Set(values.filter((value) => validValues.has(value))));
}

function collapseNoneSelection(values) {
  return values.includes("NONE") ? ["NONE"] : values;
}

function sanitizeSingleValue(value, validValues) {
  return typeof value === "string" && validValues.has(value) ? value : "";
}

function sanitizeProfileForForm(profile = {}) {
  const legacyHaircareGoals = Array.isArray(profile.primarySkincareGoals)
    ? profile.primarySkincareGoals
        .map((value) => LEGACY_HAIRCARE_GOAL_MAP[value])
        .filter((value) => value && OPTION_VALUE_SETS.haircareGoals.has(value))
    : [];

  const cosmeticAllergies = collapseNoneSelection(
    filterValidSelections(profile.cosmeticAllergies, OPTION_VALUE_SETS.cosmeticAllergies)
  );
  const avoidIngredients = collapseNoneSelection(
    filterValidSelections(profile.avoidIngredients, OPTION_VALUE_SETS.avoidIngredients)
  );

  return {
    ...DEFAULT_PROFILE_FORM,
    skinType: sanitizeSingleValue(profile.skinType, OPTION_VALUE_SETS.skinType),
    skinSensitivity: sanitizeSingleValue(profile.skinSensitivity, OPTION_VALUE_SETS.skinSensitivity),
    primarySkinConcerns: filterValidSelections(
      profile.primarySkinConcerns,
      OPTION_VALUE_SETS.primarySkinConcerns
    ),
    primarySkincareGoals: filterValidSelections(
      profile.primarySkincareGoals,
      OPTION_VALUE_SETS.primarySkincareGoals
    ),
    cosmeticAllergies,
    otherAllergy: cosmeticAllergies.includes("OTHER") ? profile.otherAllergy || "" : "",
    hairType: sanitizeSingleValue(profile.hairType, OPTION_VALUE_SETS.hairType),
    scalpType: sanitizeSingleValue(profile.scalpType, OPTION_VALUE_SETS.scalpType),
    hairConcerns: filterValidSelections(profile.hairConcerns, OPTION_VALUE_SETS.hairConcerns),
    haircareGoals: Array.from(
      new Set([
        ...filterValidSelections(profile.haircareGoals, OPTION_VALUE_SETS.haircareGoals),
        ...legacyHaircareGoals
      ])
    ),
    avoidIngredients,
    otherAvoidIngredient: avoidIngredients.includes("OTHER") ? profile.otherAvoidIngredient || "" : "",
    hairDensity: profile.hairDensity || "MEDIUM",
    makeupUsage: profile.makeupUsage || "OCCASIONALLY",
    ageGroup: profile.ageGroup || "",
    gender: profile.gender || ""
  };
}

function getSaveErrorMessage(saveError) {
  const apiError = saveError.response?.data;

  if (typeof apiError?.message === "string" && apiError.message.trim()) {
    return apiError.message;
  }

  if (Array.isArray(apiError?.errors) && apiError.errors.length > 0) {
    const firstError = apiError.errors[0];
    if (typeof firstError?.message === "string" && firstError.message.trim()) {
      return firstError.message;
    }
  }

  return "We could not save your profile just yet. Please try again.";
}

export function OnboardingFlow() {
  const router = useRouter();
  const { user, profile, updateProfile } = useSessionStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(DEFAULT_PROFILE_FORM);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm(sanitizeProfileForForm(profile));
    }
  }, [profile]);

  const currentStep = PROFILE_QUESTION_STEPS[stepIndex];
  const progress = ((stepIndex + 1) / PROFILE_QUESTION_STEPS.length) * 100;
  const isFinalStep = stepIndex === PROFILE_QUESTION_STEPS.length - 1;
  const currentOptions = useMemo(() => OPTION_GROUPS[currentStep.field] || [], [currentStep.field]);

  function setFieldValue(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value
    }));
    setError("");
  }

  function toggleMultiValue(field, value) {
    setForm((previous) => {
      const currentValues = previous[field] || [];
      const exists = currentValues.includes(value);
      let nextValues = exists
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value];

      if (field === "cosmeticAllergies" || field === "avoidIngredients") {
        const otherField = field === "cosmeticAllergies" ? "otherAllergy" : "otherAvoidIngredient";

        if (value === "NONE" && !exists) {
          nextValues = ["NONE"];
        } else if (value !== "NONE" && !exists) {
          nextValues = nextValues.filter((entry) => entry !== "NONE");
        }

        if (!nextValues.includes("OTHER")) {
          return {
            ...previous,
            [field]: nextValues,
            [otherField]: ""
          };
        }
      }

      return {
        ...previous,
        [field]: nextValues
      };
    });
    setError("");
  }

  function validateStep() {
    const value = form[currentStep.field];

    if (currentStep.type === "single" && !value) {
      setError("Please choose one option to continue.");
      return false;
    }

    if (currentStep.type === "multi" && (!value || value.length === 0)) {
      setError("Select at least one option to continue.");
      return false;
    }

    if (currentStep.otherField && value.includes("OTHER") && !form[currentStep.otherField].trim()) {
      setError("Please fill in the additional detail to continue.");
      return false;
    }

    return true;
  }

  function goNext() {
    if (!validateStep()) {
      return;
    }

    if (!isFinalStep) {
      setStepIndex((previous) => previous + 1);
    }
  }

  function goPrevious() {
    setError("");
    setStepIndex((previous) => Math.max(0, previous - 1));
  }

  async function handleSaveProfile() {
    if (!validateStep()) {
      return;
    }

    try {
      setIsSaving(true);
      const normalizedForm = sanitizeProfileForForm(form);
      const payload = {
        ...normalizedForm,
        hairDensity: normalizedForm.hairDensity || "MEDIUM",
        makeupUsage: normalizedForm.makeupUsage || "OCCASIONALLY",
        otherAllergy: normalizedForm.otherAllergy.trim() || null,
        otherAvoidIngredient: normalizedForm.otherAvoidIngredient.trim() || null,
        ageGroup: normalizedForm.ageGroup || null,
        gender: normalizedForm.gender || null
      };
      const response = await api.put("/profile/me", payload);
      updateProfile(response.data.profile);
      router.replace("/dashboard");
    } catch (saveError) {
      setError(getSaveErrorMessage(saveError));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] overflow-hidden px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="grid min-h-[calc(100vh-3rem)] min-w-0 gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="glass-panel min-w-0 rounded-[30px] p-5 shadow-panel lg:sticky lg:top-6 lg:self-start">
          <BrandMark />
          <div className="mt-7 rounded-[26px] bg-[linear-gradient(160deg,rgba(24,60,45,0.98),rgba(16,35,26,0.88))] p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/58">
              Skin profile setup
            </p>
            <h1 className="display-type mt-3 text-3xl font-semibold leading-[1.05]">
              Build your skin passport.
            </h1>
            <p className="mt-4 text-sm leading-6 text-white/68">
              One thoughtful setup helps every future ingredient scan feel personal, safer, and
              smarter.
            </p>
          </div>

          <div className="mt-4 space-y-3 rounded-[24px] border border-ink/8 bg-white/72 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-pine/56">
              Signed in as
            </p>
            <p className="text-lg font-semibold text-ink">{user?.name || "DermIntel User"}</p>
            <p className="break-all text-sm text-ink/62">{user?.email}</p>
            <div className="rounded-2xl bg-mist px-4 py-3 text-sm text-ink/64">
              Progress: {stepIndex + 1} of {PROFILE_QUESTION_STEPS.length}
            </div>
          </div>
        </aside>

        <section className="glass-panel flex min-w-0 flex-col overflow-hidden rounded-[30px] p-5 shadow-panel sm:p-7">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pine/56">
                  Step {stepIndex + 1}
                </p>
              </div>
              <div className="text-sm font-medium text-ink/60">
                {Math.round(progress)}% complete
              </div>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-ink/8">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#183c2d,#8eb69b)] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-center py-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep.field}
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.28 }}
                className="mx-auto w-full max-w-3xl"
              >
                <div className="mb-8">
                  <h2 className="display-type text-3xl font-semibold leading-tight text-ink sm:text-5xl">
                    {currentStep.title}
                  </h2>
                  {currentStep.description ? (
                    <p className="mt-3 max-w-2xl text-base leading-7 text-ink/64">
                      {currentStep.description}
                    </p>
                  ) : null}
                </div>

                {currentStep.type === "single" ? (
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    {currentOptions.map((option) => (
                      <OptionCard
                        key={option.value}
                        label={option.label}
                        description={option.description}
                        selected={form[currentStep.field] === option.value}
                        onClick={() => setFieldValue(currentStep.field, option.value)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                    {currentOptions.map((option) => (
                      <OptionCard
                        key={option.value}
                        label={option.label}
                        description={option.description}
                        selected={form[currentStep.field].includes(option.value)}
                        onClick={() => toggleMultiValue(currentStep.field, option.value)}
                        multi
                      />
                    ))}
                  </div>
                )}

                {currentStep.otherField && form[currentStep.field].includes("OTHER") ? (
                  <div className="mt-5">
                    <label className="block text-sm font-medium text-ink/68">
                      {currentStep.otherLabel}
                    </label>
                    <input
                      type="text"
                      value={form[currentStep.otherField]}
                      onChange={(event) => setFieldValue(currentStep.otherField, event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-pine"
                      placeholder="Type here"
                    />
                  </div>
                ) : null}

                {error ? (
                  <div className="mt-5 rounded-2xl border border-coral/18 bg-coral/8 px-4 py-3 text-sm text-coral">
                    {error}
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-auto flex flex-col gap-3 border-t border-ink/8 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={goPrevious}
              disabled={stepIndex === 0}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-ink/10 bg-white px-5 py-3 text-sm font-semibold text-ink transition disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </button>

            {isFinalStep ? (
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-pine px-6 py-3 text-sm font-semibold text-white shadow-panel transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isSaving ? "Saving your profile..." : "Save My Profile"}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-pine px-6 py-3 text-sm font-semibold text-white shadow-panel transition hover:translate-y-[-1px]"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function OptionCard({ label, description, selected, onClick, multi = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`lift-card min-w-0 rounded-[22px] border p-4 text-left transition sm:p-5 ${
        selected
          ? "border-pine bg-pine text-white shadow-panel"
          : "border-ink/8 bg-white/78 text-ink hover:border-pine/30"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{label}</h3>
          {description ? (
            <p className={`mt-2 text-sm leading-6 ${selected ? "text-white/72" : "text-ink/60"}`}>
              {description}
            </p>
          ) : null}
        </div>
        <div
          className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
            selected
              ? "border-white/60 bg-white/14 text-white"
              : "border-ink/16 bg-transparent text-transparent"
          }`}
        >
          {multi ? "+" : ""}
        </div>
      </div>
    </button>
  );
}
