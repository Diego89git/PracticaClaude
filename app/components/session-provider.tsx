"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

export interface Usuario {
  name: string;
}

export interface ScoreEntry {
  game: string;
  score: number;
  name: string;
}

interface SessionValue {
  user: Usuario | null;
  login: (u: Usuario | null) => void;
  signOut: () => void;
  saveScore: (entry: ScoreEntry) => void;
}

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};

const readRawUser = () => {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, readRawUser, () => null);

  const user = useMemo<Usuario | null>(() => {
    try {
      return raw ? (JSON.parse(raw) as Usuario) : null;
    } catch {
      return null;
    }
  }, [raw]);

  const login = useCallback((u: Usuario | null) => {
    try {
      if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
      else localStorage.removeItem(USER_KEY);
    } catch {}
    emit();
  }, []);

  const signOut = useCallback(() => login(null), [login]);

  const saveScore = useCallback((entry: ScoreEntry) => {
    try {
      const all = JSON.parse(localStorage.getItem(SCORES_KEY) || "[]");
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem(SCORES_KEY, JSON.stringify(all));
    } catch {}
  }, []);

  const value = useMemo(() => ({ user, login, signOut, saveScore }), [user, login, signOut, saveScore]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de SessionProvider");
  return ctx;
}
