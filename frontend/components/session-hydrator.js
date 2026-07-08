"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/store/use-session-store";

export function SessionHydrator() {
  const { initialized, token, user, hydrate, refreshSession, isFetchingSession } = useSessionStore();

  useEffect(() => {
    if (!initialized) {
      hydrate();
    }
  }, [hydrate, initialized]);

  useEffect(() => {
    if (!initialized || !token || user || isFetchingSession) {
      return;
    }

    refreshSession();
  }, [initialized, isFetchingSession, refreshSession, token, user]);

  return null;
}

