"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { useSessionStore } from "@/store/use-session-store";

export default function DashboardPage() {
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

    if (!profile) {
      router.replace("/onboarding");
    }
  }, [initialized, isFetchingSession, profile, router, token]);

  if (!initialized || isFetchingSession || !token || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-pine/12" />
          <p className="mt-4 text-sm text-ink/62">Loading your dashboard...</p>
        </div>
      </main>
    );
  }

  return <DashboardShell />;
}

