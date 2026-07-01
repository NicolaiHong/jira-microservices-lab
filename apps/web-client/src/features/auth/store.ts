import { create } from "zustand";

import type { AuthResponse, User } from "./types";

const STORAGE_KEY = "jira-like-web-client.session";

interface PersistedSession {
  accessToken: string;
  refreshToken?: string | null;
  user: User;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  hydrate: () => void;
  setSession: (session: AuthResponse) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isHydrated: false,
  hydrate: () => {
    if (get().isHydrated || typeof window === "undefined") {
      return;
    }

    const rawSession = window.localStorage.getItem(STORAGE_KEY);

    if (!rawSession) {
      set({ isHydrated: true });
      return;
    }

    try {
      const session = JSON.parse(rawSession) as PersistedSession;

      set({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken ?? null,
        user: session.user,
        isAuthenticated: Boolean(session.accessToken && session.user),
        isHydrated: true,
      });
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      set({ isHydrated: true });
    }
  },
  setSession: (session) => {
    const nextSession = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken ?? null,
      user: session.user,
    };

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSession));
    }

    set({
      ...nextSession,
      isAuthenticated: true,
      isHydrated: true,
    });
  },
  clearSession: () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }

    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isHydrated: true,
    });
  },
}));
