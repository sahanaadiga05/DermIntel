"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { useSessionStore } from "@/store/use-session-store";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setSession, refreshSession, signOut } = useSessionStore();
  const [message, setMessage] = useState("Completing your secure DermIntel sign-in...");

  useEffect(() => {
    let isMounted = true;

    async function completeLogin() {
      const token = searchParams.get("token");
      const error = searchParams.get("error");

      if (error) {
        if (isMounted) {
          setMessage("Google sign-in could not be completed. Please try again.");
        }
        return;
      }

      if (!token) {
        if (isMounted) {
          setMessage("No session token was returned. Please restart sign-in.");
        }
        return;
      }

      try {
        setSession({ token, user: null, profile: null });
        const payload = await refreshSession(token);

        if (!payload) {
          throw new Error("Unable to restore session.");
        }

        router.replace(payload.profile ? "/dashboard" : "/onboarding");
      } catch (_error) {
        signOut();
        if (isMounted) {
          setMessage("Your session could not be restored. Please try again.");
        }
      }
    }

    completeLogin();

    return () => {
      isMounted = false;
    };
  }, [refreshSession, router, searchParams, setSession, signOut]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass-panel w-full max-w-xl rounded-[32px] p-8 text-center shadow-panel">
        <div className="mb-6 flex justify-center">
          <BrandMark />
        </div>
        <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-pine/12" />
        <h1 className="mt-6 text-2xl font-semibold text-ink">Setting up your DermIntel session</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">{message}</p>
      </div>
    </main>
  );
}

