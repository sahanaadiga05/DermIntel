"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { api } from "@/lib/api";
import {
  AGE_GROUP_OPTIONS,
  ALLERGY_OPTIONS,
  DEFAULT_PROFILE_FORM,
  GENDER_OPTIONS,
  HAIR_CONCERN_OPTIONS,
  HAIR_DENSITY_OPTIONS,
  HAIR_TYPE_OPTIONS,
  MAKEUP_USAGE_OPTIONS,
  PROFILE_QUESTION_STEPS,
  SKIN_CONCERN_OPTIONS,
  SKIN_SENSITIVITY_OPTIONS,
  SKIN_TYPE_OPTIONS,
  SKINCARE_GOAL_OPTIONS
} from "@/lib/profile-options";
import { useSessionStore } from "@/store/use-session-store";

const OPTION_GROUPS = {
  skinType: SKIN_TYPE_OPTIONS,
  hairType: HAIR_TYPE_OPTIONS,
  hairDensity: HAIR_DENSITY_OPTIONS,
  skinSensitivity: SKIN_SENSITIVITY_OPTIONS,
  primarySkinConcerns: SKIN_CONCERN_OPTIONS,
  hairConcerns: HAIR_CONCERN_OPTIONS,
  cosmeticAllergies: ALLERGY_OPTIONS,
  makeupUsage: MAKEUP_USAGE_OPTIONS,
  primarySkincareGoals: SKINCARE_GOAL_OPTIONS,
  ageGroup: AGE_GROUP_OPTIONS,
  gender: GENDER_OPTIONS
};

export function OnboardingFlow() {
  const router = useRouter();
  const { user, profile, updateProfile } = useSessionStore();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(DEFAULT_PROFILE_FORM);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        ...DEFAULT_PROFILE_FORM,
        ...profile,
        otherAllergy: profile.otherAllergy || "",
        ageGroup: profile.ageGroup || "",
        gender: profile.gender || ""
      });
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
      const currentValues = previous[field];
      const exists = currentValues.includes(value);
      let nextValues = exists
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value];

      if (field === "cosmeticAllergies") {
        if (value === "NONE" && !exists) {
          nextValues = ["NONE"];
        } else if (value !== "NONE" && !exists) {
          nextValues = nextValues.filter((entry) => entry !== "NONE");
        }

        if (!nextValues.includes("OTHER")) {
          return {
            ...previous,
            [field]: nextValues,
            otherAllergy: ""
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

    if (currentStep.optional) {
      return true;
    }

    if (currentStep.type === "single" && !value) {
      setError("Please choose one option to continue.");
      return false;
    }

    if (currentStep.type === "multi" && (!value || value.length === 0)) {
      setError("Select at least one option to continue.");
      return false;
    }

    if (currentStep.field === "cosmeticAllergies" && value.includes("OTHER") && !form.otherAllergy.trim()) {
      setError("Tell us which allergy should be noted.");
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
      const payload = {
        ...form,
        otherAllergy: form.otherAllergy.trim() || null,
        ageGroup: form.ageGroup || null,
        gender: form.gender || null
      };
      const response = await api.put("/profile/me", payload);
      updateProfile(response.data.profile);
      router.replace("/dashboard");
    } catch (saveError) {
      setError(
        saveError.response?.data?.message ||
          "We could not save your profile just yet. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid min-h-[calc(100vh-3rem)] gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="glass-panel rounded-[36px] p-6 shadow-panel">
          <BrandMark />
          <div className="mt-8 rounded-[28px] bg-[linear-gradient(160deg,rgba(24,60,45,0.96),rgba(16,35,26,0.82))] p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/58">
              Skin profile setup
            </p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight">
              Build your permanent DermIntel passport.
            </h1>
            <p className="mt-4 text-sm leading-7 text-white/72">
              One thoughtful setup helps every future ingredient scan feel personal, safer, and
              smarter.
            </p>
          </div>

          <div className="mt-6 space-y-4 rounded-[28px] border border-ink/8 bg-white/72 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-pine/56">
              Signed in as
            </p>
            <p className="text-lg font-semibold text-ink">{user?.name || "DermIntel User"}</p>
            <p className="text-sm text-ink/62">{user?.email}</p>
            <div className="rounded-2xl bg-mist px-4 py-3 text-sm text-ink/64">
              Progress: {stepIndex + 1} of {PROFILE_QUESTION_STEPS.length}
            </div>
          </div>
        </aside>

        <section className="glass-panel flex flex-col rounded-[36px] p-6 shadow-panel">
          <div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pine/56">
                  Step {stepIndex + 1}
                </p>
                <p className="mt-2 text-sm text-ink/58">
                  {currentStep.optional ? "Optional question" : "Required question"}
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

          <div className="flex flex-1 flex-col justify-center py-8">
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
                  <h2 className="text-3xl font-semibold text-ink sm:text-4xl">
                    {currentStep.title}
                  </h2>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-ink/64">
                    {currentStep.description}
                  </p>
                </div>

                {currentStep.type === "single" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
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
                  <div className="grid gap-4 sm:grid-cols-2">
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

                {currentStep.field === "cosmeticAllergies" && form.cosmeticAllergies.includes("OTHER") ? (
                  <div className="mt-5">
                    <label className="block text-sm font-medium text-ink/68">
                      Tell us the allergy or trigger
                    </label>
                    <input
                      type="text"
                      value={form.otherAllergy}
                      onChange={(event) => setFieldValue("otherAllergy", event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-pine"
                      placeholder="Example: specific preservative or botanical extract"
                    />
                  </div>
                ) : null}

                {error ? (
                  <div className="mt-5 rounded-2xl border border-coral/18 bg-coral/8 px-4 py-3 text-sm text-coral">
                    {error}
                  </div>
                ) : null}

                {currentStep.optional ? (
                  <p className="mt-5 text-sm text-ink/52">
                    You can leave this blank and continue if you prefer.
                  </p>
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
      className={`rounded-[28px] border p-5 text-left transition ${
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

