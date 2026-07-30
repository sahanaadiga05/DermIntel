"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  FlaskConical,
  ScanSearch,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { buildGoogleAuthUrl } from "@/lib/api";
import { useSessionStore } from "@/store/use-session-store";

const reveal = {
  hidden: { opacity: 0, y: 18 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }
  })
};

export function LandingPage() {
  const router = useRouter();
  const { initialized, token, profile } = useSessionStore();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const googleAuthUrl = useMemo(() => buildGoogleAuthUrl("/dashboard"), []);

  useEffect(() => {
    if (initialized && token) {
      router.replace(profile ? "/dashboard" : "/onboarding");
    }
  }, [initialized, profile, router, token]);

  function handleGoogleContinue() {
    setIsRedirecting(true);
    window.location.href = googleAuthUrl;
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 soft-grid [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />
      <div className="animate-glow pointer-events-none absolute -left-32 top-16 h-80 w-80 rounded-full bg-[#cde77f]/25 blur-3xl" />
      <div className="animate-drift pointer-events-none absolute -right-24 top-40 h-96 w-96 rounded-full bg-sage/20 blur-3xl" />

      <div className="relative mx-auto max-w-[1440px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-4 rounded-[22px] border border-ink/8 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl sm:px-5">
          <BrandMark />
          <div className="hidden items-center gap-2 text-sm font-medium text-ink/58 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Verified sources. Personal results.
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-8rem)] items-center gap-10 py-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(520px,1.08fr)] lg:py-16">
          <motion.div
            initial="hidden"
            animate="visible"
            className="min-w-0 max-w-2xl"
          >
            <motion.div
              variants={reveal}
              custom={0}
              className="inline-flex items-center gap-2 rounded-full border border-pine/10 bg-white/72 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-pine"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Skincare, decoded
            </motion.div>
            <motion.h1
              variants={reveal}
              custom={0.08}
              className="display-type mt-6 text-[clamp(3.45rem,8vw,7.2rem)] font-semibold leading-[0.88] text-ink"
            >
              Know your
              <span className="block italic text-pine">formula.</span>
              Know your fit.
            </motion.h1>
            <motion.p
              variants={reveal}
              custom={0.16}
              className="mt-7 max-w-xl text-base leading-7 text-ink/64 sm:text-lg sm:leading-8"
            >
              Paste any skincare link. DermIntel finds the full ingredient list, verifies the
              source, and explains how the formula fits your skin—not somebody else’s.
            </motion.p>
            <motion.div
              variants={reveal}
              custom={0.24}
              className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
            >
              <button
                type="button"
                onClick={handleGoogleContinue}
                disabled={isRedirecting}
                className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-pine px-5 py-4 text-sm font-bold text-white shadow-[0_18px_44px_rgba(23,63,50,.22)] transition hover:-translate-y-0.5 hover:bg-[#205441] disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
              >
                <GoogleGlyph />
                {isRedirecting ? "Opening Google…" : "Continue with Google"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <p className="text-xs leading-5 text-ink/48">
                Private skin profile
                <br />
                No password required
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="grid min-w-0 auto-rows-[148px] grid-cols-2 gap-3 sm:auto-rows-[160px] sm:grid-cols-4"
          >
            <BentoCard className="col-span-2 row-span-2 bg-pine p-5 text-white sm:p-6">
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/52">
                      Formula match
                    </p>
                    <p className="display-type mt-2 text-3xl font-semibold">Daily barrier serum</p>
                  </div>
                  <span className="rounded-full bg-[#cde77f] px-3 py-1.5 text-xs font-bold text-pine">
                    Great fit
                  </span>
                </div>
                <div className="mt-auto flex items-end justify-between gap-5">
                  <div>
                    <p className="display-type text-7xl font-semibold leading-none">91</p>
                    <p className="mt-2 text-xs text-white/55">Personal suitability</p>
                  </div>
                  <div className="relative h-24 w-24 flex-none rounded-full border-[10px] border-white/10">
                    <div className="absolute inset-[-10px] rounded-full border-[10px] border-[#cde77f] border-l-transparent rotate-45" />
                    <Check className="absolute inset-0 m-auto h-7 w-7 text-[#cde77f]" />
                  </div>
                </div>
              </div>
            </BentoCard>

            <BentoCard className="col-span-2 p-5 sm:col-span-2">
              <div className="relative z-10 flex h-full items-center gap-4">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#eaf3cb] text-pine">
                  <ScanSearch className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">Works from a product link</p>
                  <p className="mt-1 text-sm leading-6 text-ink/55">
                    Amazon, Nykaa, Myntra, brand stores, and more.
                  </p>
                </div>
              </div>
            </BentoCard>

            <BentoCard className="p-4 sm:p-5">
              <div className="relative z-10">
                <ShieldCheck className="h-6 w-6 text-pine" />
                <p className="mt-5 text-sm font-bold text-ink">Source checked</p>
                <p className="mt-1 text-xs leading-5 text-ink/52">No made-up formulas.</p>
              </div>
            </BentoCard>

            <BentoCard className="bg-[#dcebc5] p-4 sm:p-5">
              <div className="relative z-10">
                <FlaskConical className="h-6 w-6 text-pine" />
                <p className="mt-5 text-sm font-bold text-ink">Every ingredient</p>
                <p className="mt-1 text-xs leading-5 text-ink/52">Plain-language context.</p>
              </div>
            </BentoCard>
          </motion.div>
        </section>

        <div className="grid gap-3 border-t border-ink/8 pt-5 text-xs text-ink/50 sm:grid-cols-3">
          <p>01 · Verify the product and its formula</p>
          <p>02 · Compare against your skin passport</p>
          <p>03 · Explain scores, risks, and alternatives</p>
        </div>
      </div>
    </main>
  );
}

function BentoCard({ className = "", children }) {
  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className={`bento-card rounded-[26px] ${className}`}
    >
      {children}
    </motion.article>
  );
}

function GoogleGlyph() {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-extrabold text-[#4285f4]">
      G
    </span>
  );
}
