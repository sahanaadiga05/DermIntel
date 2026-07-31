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
    <main className="relative h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 soft-grid [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />
      <div className="animate-glow pointer-events-none absolute -left-32 top-16 h-80 w-80 rounded-full bg-[#cde77f]/25 blur-3xl" />
      <div className="animate-drift pointer-events-none absolute -right-24 top-40 h-96 w-96 rounded-full bg-sage/20 blur-3xl" />

      <div className="relative mx-auto flex h-full max-w-[1440px] flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={reveal}
          custom={0}
          className="mb-4 flex flex-col items-center text-center sm:mb-5"
        >
          <LoginPageMark />
        </motion.div>

        <section className="grid flex-1 items-center gap-6 py-2 lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.02fr)] lg:gap-8 lg:py-2">
          <motion.div
            initial="hidden"
            animate="visible"
            className="min-w-0 max-w-2xl"
          >
            <motion.div
              variants={reveal}
              custom={0}
              className="inline-flex items-center gap-2 rounded-full border border-pine/10 bg-white/72 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-pine"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Skincare, decoded
            </motion.div>
            <motion.h1
              variants={reveal}
              custom={0.08}
              className="display-type mt-4 text-[clamp(2.8rem,6vw,5.5rem)] font-semibold leading-[0.9] text-ink"
            >
              Know your
              <span className="block italic text-pine">formula.</span>
              Know your fit.
            </motion.h1>
            <motion.p
              variants={reveal}
              custom={0.16}
              className="mt-5 max-w-xl text-sm leading-6 text-ink/64 sm:text-base sm:leading-7"
            >
              Paste any skincare link. DermIntel finds the full ingredient list, verifies the
              source, and explains how the formula fits your skin-not somebody else's.
            </motion.p>
            <motion.div
              variants={reveal}
              custom={0.24}
              className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center"
            >
              <button
                type="button"
                onClick={handleGoogleContinue}
                disabled={isRedirecting}
                className="group inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-pine px-8 py-5 text-[1.18rem] font-bold text-white shadow-[0_22px_50px_rgba(23,63,50,.25)] transition hover:-translate-y-0.5 hover:bg-[#205441] disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
              >
                <GoogleGlyph />
                {isRedirecting ? "Opening Google..." : "Continue with Google"}
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
            className="grid min-w-0 auto-rows-[minmax(136px,_auto)] grid-cols-2 gap-3 sm:auto-rows-[minmax(146px,_auto)] sm:grid-cols-4"
          >
            <BentoCard className="col-span-2 row-span-2 h-full rounded-3xl border-gray-100 bg-white p-8 shadow-sm">
              <div className="relative z-10 flex h-full flex-col justify-between">
                <div className="w-fit">
                  <p className="display-type text-[1.85rem] font-semibold leading-none text-emerald-950 sm:text-[2.15rem]">
                    Formula Analysis
                  </p>
                </div>
                <div className="my-auto flex flex-row items-center justify-between gap-6">
                  <p className="max-w-[190px] text-left text-xs font-normal leading-relaxed text-gray-700 md:text-sm">
                    Every formula tells a story. DermIntel verifies the ingredients, breaks down
                    their purpose, and scores how well they fit your skin profile.
                  </p>
                  <div className="relative h-32 w-32 flex-shrink-0 rounded-full border-[10px] border-white/10 sm:h-36 sm:w-36 sm:border-[12px]">
                    <div className="absolute inset-[-10px] rounded-full border-[10px] border-[#cde77f] border-l-transparent rotate-45 sm:inset-[-12px] sm:border-[12px]" />
                    <Check className="absolute inset-0 m-auto h-8 w-8 text-[#cde77f] sm:h-9 sm:w-9" />
                  </div>
                </div>
              </div>
            </BentoCard>

            <BentoCard className="col-span-2 p-4 sm:col-span-2 sm:p-5">
              <div className="relative z-10 flex h-full items-center gap-4">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#eaf3cb] text-pine">
                  <ScanSearch className="h-6 w-6" />
                </div>
                <div>
                  <p className="display-type text-[1.45rem] font-semibold leading-none text-ink sm:text-[1.7rem]">Works from a product link</p>
                  <p className="mt-1 text-sm font-normal leading-6 text-ink">
                    Amazon, Nykaa, Myntra, brand stores, and more.
                  </p>
                </div>
              </div>
            </BentoCard>

            <BentoCard className="p-3.5 sm:p-5">
              <div className="relative z-10">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#eaf3cb] text-pine">
                  <ShieldCheck className="h-6 w-6 text-pine" />
                </div>
                <p className="display-type mt-5 text-[1.35rem] font-semibold leading-none text-ink sm:text-[1.55rem]">Source checked</p>
                <p className="mt-1 text-xs leading-5 text-ink/52">No made-up formulas.</p>
              </div>
            </BentoCard>

            <BentoCard className="bg-[#dcebc5] p-3.5 sm:p-5">
              <div className="relative z-10">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-2xl bg-[#eaf3cb] text-pine">
                  <FlaskConical className="h-6 w-6 text-pine" />
                </div>
                <p className="display-type mt-5 text-[1.35rem] font-semibold leading-none text-ink sm:text-[1.55rem]">Every ingredient</p>
                <p className="mt-1 text-xs leading-5 text-ink/52">Plain-language context.</p>
              </div>
            </BentoCard>
          </motion.div>
        </section>


        <div className="grid gap-2 border-t border-ink/8 pt-3 text-[11px] text-ink/50 sm:grid-cols-3 sm:text-xs">
          <p>01 - Verify the product and its formula</p>
          <p>02 - Compare against your skin passport</p>
          <p>03 - Explain scores, risks, and alternatives</p>
        </div>
      </div>
    </main>
  );
}

function LoginPageMark() {
  return (
    <div className="flex flex-col items-center gap-3.5 sm:gap-4">
      <div className="flex items-center justify-center gap-4 sm:gap-5">
        <div className="relative flex h-[5.6rem] w-[5.6rem] items-center justify-center rounded-[26px] bg-white text-pine shadow-[0_22px_52px_rgba(24,60,45,0.18)] ring-1 ring-ink/10 sm:h-[6.1rem] sm:w-[6.1rem] sm:rounded-[30px]">
          <span className="display-type -translate-y-px text-[56px] font-semibold sm:text-[64px]">D</span>
          <span className="absolute bottom-4 right-4 h-3 w-3 rounded-full bg-[#cde77f]" />
        </div>
        <h2 className="display-type text-[3.2rem] font-semibold leading-none tracking-[-0.055em] text-pine sm:text-[3.9rem] lg:text-[4.35rem]">
          DermIntel
        </h2>
      </div>
      <p className="max-w-xl text-center text-[0.78rem] font-medium tracking-[0.04em] text-ink/58 sm:text-[0.9rem]">
        Understand What Your Skin Deserves
      </p>
    </div>
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
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(23,35,28,0.06)]">
      <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
        <path
          fill="#EA4335"
          d="M12 10.2v3.9h5.5c-.24 1.26-.96 2.33-2.04 3.05l3.31 2.57c1.93-1.78 3.03-4.4 3.03-7.53 0-.72-.06-1.4-.19-2H12z"
        />
        <path
          fill="#34A853"
          d="M12 22c2.7 0 4.96-.89 6.61-2.41l-3.31-2.57c-.92.62-2.1.99-3.3.99-2.54 0-4.69-1.71-5.46-4.01l-3.42 2.64C4.78 19.92 8.13 22 12 22z"
        />
        <path
          fill="#FBBC05"
          d="M6.54 14c-.2-.62-.31-1.28-.31-2s.11-1.38.31-2L3.12 7.36C2.39 8.81 2 10.37 2 12s.39 3.19 1.12 4.64L6.54 14z"
        />
        <path
          fill="#4285F4"
          d="M12 5.99c1.47 0 2.79.51 3.83 1.5l2.87-2.87C16.95 2.98 14.69 2 12 2 8.13 2 4.78 4.08 3.12 7.36L6.54 10c.77-2.3 2.92-4.01 5.46-4.01z"
        />
      </svg>
    </span>
  );
}
