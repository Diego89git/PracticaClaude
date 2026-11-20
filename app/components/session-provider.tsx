"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";

// SPEC 24: la sesión es la de Supabase Auth. El invitado no tiene sesión (user === null).
export interface Usuario {
  id: string; // auth.users.id
  name: string; // user_metadata.username ("" si aún no lo eligió)
  email: string;
  provider: "email" | "google" | "github";
}

export interface ScoreEntry {
  game: string;
  score: number;
  name: string;
}

interface SessionValue {
  user: Usuario | null;
  cargando: boolean; // true hasta conocer la sesión inicial
  signOut: () => Promise<void>;
  refrescar: () => Promise<void>; // relee el usuario después de updateUser
  saveScore: (entry: ScoreEntry) => void; // av_scores (placeholders), sin cambios
}

const SCORES_KEY = "av_scores";
const OLD_USER_KEY = "av_user"; // sesión falsa anterior a SPEC 24

function aUsuario(u: User | null | undefined): Usuario | null {
  if (!u) return null;
  const username = u.user_metadata?.username;
  const provider = u.app_metadata?.provider;
  return {
    id: u.id,
    name: typeof username === "string" ? username : "",
    email: u.email ?? "",
    provider:
      provider === "google" || provider === "github" ? provider : "email",
  };
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Limpia la clave de la sesión falsa que pudiera quedar de antes.
    try {
      localStorage.removeItem(OLD_USER_KEY);
    } catch {}

    const supabase = createClient();
    let activo = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!activo) return;
      setUser(aUsuario(data.user));
      setCargando(false);
    });

    // No se llama a Supabase dentro del callback (puede bloquearse): se usa la sesión recibida.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!activo) return;
      setUser(aUsuario(session?.user));
      setCargando(false);
    });

    return () => {
      activo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await createClient().auth.signOut();
    setUser(null);
  }, []);

  const refrescar = useCallback(async () => {
    const { data } = await createClient().auth.getUser();
    setUser(aUsuario(data.user));
  }, []);

  const saveScore = useCallback((entry: ScoreEntry) => {
    try {
      const all = JSON.parse(localStorage.getItem(SCORES_KEY) || "[]");
      all.push({ ...entry, at: Date.now() });
      localStorage.setItem(SCORES_KEY, JSON.stringify(all));
    } catch {}
  }, []);

  const value = useMemo(
    () => ({ user, cargando, signOut, refrescar, saveScore }),
    [user, cargando, signOut, refrescar, saveScore],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de SessionProvider");
  return ctx;
}
