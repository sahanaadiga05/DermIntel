"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { OnboardingFlow } from "@/components/onboarding-flow";
import { useSessionStore } from "@/store/use-session-store";

export default function OnboardingPage() {
  const router = useRouter();
  const { initialized, isFetchingSession, token, profile } = useSessionStore();

  useEffect(() => {
    if (!initialized || isFetchingSession) {
      return;
    }

    if (!token) {
      router.replace("/");
      return;
    }

    if (profile) {
      router.replace("/dashboard");
    }
  }, [initialized, isFetchingSession, profile, router, token]);

  if (!initialized || isFetchingSession || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-pine/12" />
          <p className="mt-4 text-sm text-ink/62">Preparing your skin profile setup...</p>
        </div>
      </main>
    );
  }

  return <OnboardingFlow />;
}

