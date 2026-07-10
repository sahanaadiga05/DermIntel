import { Suspense } from "react";
import { OnboardingPageClient } from "./page-client";

function LoadingFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-pine/12" />
        <p className="mt-4 text-sm text-ink/62">Preparing your skin profile setup...</p>
      </div>
    </main>
  );
}

export default function OnboardingPage({ searchParams }) {
  const editValue = searchParams?.edit;
  const isEditing = Array.isArray(editValue) ? editValue[0] === "1" : editValue === "1";

  return (
    <Suspense fallback={<LoadingFallback />}>
      <OnboardingPageClient isEditing={isEditing} />
    </Suspense>
  );
}
