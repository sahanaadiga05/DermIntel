"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { buildGoogleAuthUrl } from "@/lib/api";
import { useSessionStore } from "@/store/use-session-store";

const featureCards = [
  {
    icon: ShieldCheck,
    title: "Ingredient safety scoring",
    description: "Translate label chemistry into practical risk signals for your profile."
  },
  {
    icon: Sparkles,
    title: "Personalized recommendations",
    description: "Match product verdicts to your concerns, sensitivities, and goals."
  },
  {
    icon: Stethoscope,
    title: "Modern skin passport",
    description: "Keep one trusted profile that powers every future analysis automatically."
  }
];

export function LandingPage() {
  const router = useRouter();
  const { initialized, token, profile } = useSessionStore();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const googleAuthUrl = useMemo(() => buildGoogleAuthUrl("/dashboard"), []);

  useEffect(() => {
    if (!initialized || !token) {
      return;
    }

    router.replace(profile ? "/dashboard" : "/onboarding");
  }, [initialized, profile, router, token]);

  function handleGoogleContinue() {
    setIsRedirecting(true);
    window.location.href = googleAuthUrl;
  }

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-4%] h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute right-[-6%] top-[12%] h-96 w-96 rounded-full bg-sage/18 blur-3xl" />
        <div className="absolute bottom-[-12%] left-[12%] h-96 w-96 rounded-full bg-pine/8 blur-3xl" />
      </div>

      <section className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between py-4">
          <BrandMark />
          <div className="hidden rounded-full border border-ink/8 bg-white/72 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-pine/58 md:block">
            Premium skin intelligence
          </div>
        </header>

        <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[minmax(0,1.1fr)_460px]">
          <motion.section
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="max-w-3xl"
          >
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-pine/58">
              AI-powered skincare guidance
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.04] text-ink sm:text-6xl">
              Understand What Your Skin Deserves
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink/70">
              DermIntel helps you sign in once, build a permanent skin profile, and decode
              cosmetic ingredient lists with personalized safety scores, warnings, and smarter
              product recommendations.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handleGoogleContinue}
                disabled={isRedirecting}
                className="inline-flex items-center gap-3 rounded-full bg-pine px-6 py-4 text-sm font-semibold text-white shadow-panel transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <GoogleGlyph />
                {isRedirecting ? "Redirecting to Google..." : "Continue with Google"}
                <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-sm text-ink/58">Secure Google sign-in. No passwords to manage.</p>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="glass-panel rounded-[36px] p-6 shadow-panel"
          >
            <div className="rounded-[32px] bg-[linear-gradient(160deg,rgba(24,60,45,0.96),rgba(16,35,26,0.82))] p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/58">
                Why start here
              </p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight">
                Your ingredient analysis gets sharper once your profile is in place.
              </h2>
              <div className="mt-6 space-y-4">
                {featureCards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <div
                      key={card.title}
                      className="rounded-[24px] border border-white/10 bg-white/8 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold">{card.title}</h3>
                          <p className="mt-1 text-sm leading-6 text-white/68">{card.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.section>
        </div>
      </section>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#fff"
        d="M21.6 12.23c0-.76-.07-1.49-.2-2.18H12v4.13h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.31 2.99-7.47Z"
      />
      <path
        fill="#fff"
        opacity=".72"
        d="M12 22c2.7 0 4.97-.89 6.62-2.4l-3.23-2.5c-.89.6-2.03.95-3.39.95-2.61 0-4.82-1.76-5.61-4.13H3.05v2.58A9.99 9.99 0 0 0 12 22Z"
      />
      <path
        fill="#fff"
        opacity=".58"
        d="M6.39 13.92A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.31.31-1.92V7.5H3.05A9.99 9.99 0 0 0 2 12c0 1.61.38 3.13 1.05 4.5l3.34-2.58Z"
      />
      <path
        fill="#fff"
        opacity=".86"
        d="M12 5.95c1.47 0 2.8.51 3.84 1.52l2.88-2.88C16.96 2.96 14.7 2 12 2A9.99 9.99 0 0 0 3.05 7.5l3.34 2.58C7.18 7.71 9.39 5.95 12 5.95Z"
      />
    </svg>
  );
}

