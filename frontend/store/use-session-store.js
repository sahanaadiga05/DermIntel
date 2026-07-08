"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession
} from "@/lib/session-storage";

export const useSessionStore = create((set, get) => ({
  initialized: false,
  isFetchingSession: false,
  token: null,
  user: null,
  profile: null,
  hydrate: () => {
    const stored = readStoredSession();

    if (!stored) {
      set({
        initialized: true,
        token: null,
        user: null,
        profile: null
      });
      return;
    }

    set({
      initialized: true,
      token: stored.token || null,
      user: stored.user || null,
      profile: stored.profile || null
    });
  },
  setSession: (session) => {
    const nextSession = {
      token: session.token ?? get().token,
      user: session.user ?? get().user ?? null,
      profile: session.profile ?? get().profile ?? null
    };

    writeStoredSession(nextSession);
    set({
      initialized: true,
      ...nextSession
    });
  },
  refreshSession: async (tokenOverride) => {
    const activeToken = tokenOverride || get().token;

    if (!activeToken) {
      return null;
    }

    set({ isFetchingSession: true });

    try {
      const response = await api.get("/auth/me", {
        headers: {
          Authorization: `Bearer ${activeToken}`
        }
      });

      const nextSession = {
        token: activeToken,
        user: response.data.user,
        profile: response.data.profile || null
      };

      writeStoredSession(nextSession);
      set({
        initialized: true,
        isFetchingSession: false,
        ...nextSession
      });

      return response.data;
    } catch (_error) {
      clearStoredSession();
      set({
        initialized: true,
        isFetchingSession: false,
        token: null,
        user: null,
        profile: null
      });
      return null;
    }
  },
  updateProfile: (profile) => {
    const nextSession = {
      token: get().token,
      user: get().user,
      profile
    };

    writeStoredSession(nextSession);
    set({ profile });
  },
  signOut: () => {
    clearStoredSession();
    set({
      initialized: true,
      isFetchingSession: false,
      token: null,
      user: null,
      profile: null
    });
  }
}));

