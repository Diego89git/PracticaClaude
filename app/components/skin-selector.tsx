"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  esSkinId,
  SKIN_DEFAULT,
  SKIN_IDS,
  SKINS,
  type Modo,
  type SkinId,
} from "../games/skins";

const SKIN_KEY = "av_skin";
const THEME_KEY = "av_theme"; // "light" | "dark"

// Almacén externo mínimo: localStorage + preferencia del sistema. El snapshot es un
// string "skin|modo" para que React compare por valor.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const leer = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const escribir = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

const SERVER_SNAPSHOT = `${SKIN_DEFAULT}|oscuro`;

function getSnapshot(): string {
  const s = leer(SKIN_KEY);
  const skin = esSkinId(s) ? s : SKIN_DEFAULT;
  const t = leer(THEME_KEY);
  const oscuroSistema = window.matchMedia(
    "(prefers-color-scheme: dark)",
  ).matches;
  const modo: Modo =
    t === "light"
      ? "claro"
      : t === "dark"
        ? "oscuro"
        : oscuroSistema
          ? "oscuro"
          : "claro";
  return `${skin}|${modo}`;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", cb);
    window.removeEventListener("storage", cb);
  };
}

// Skin y modo vigentes. Marca <html data-skin data-theme> mientras el componente que
// lo usa está montado, para que los tokens de globals.css se apliquen solo allí.
export function useSkin(activo = true) {
  const snap = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => SERVER_SNAPSHOT,
  );
  const [skin, modo] = snap.split("|") as [SkinId, Modo];

  useEffect(() => {
    if (!activo) return;
    const el = document.documentElement;
    el.dataset.skin = skin;
    el.dataset.theme = modo === "oscuro" ? "dark" : "light";
    return () => {
      delete el.dataset.skin;
      delete el.dataset.theme;
    };
  }, [activo, skin, modo]);

  return {
    skin,
    modo,
    setSkin: (s: SkinId) => {
      escribir(SKIN_KEY, s);
      notify();
    },
    setModo: (m: Modo) => {
      escribir(THEME_KEY, m === "oscuro" ? "dark" : "light");
      notify();
    },
  };
}

interface Props {
  skin: SkinId;
  modo: Modo;
  onSkin: (s: SkinId) => void;
  onModo: (m: Modo) => void;
}

export function SkinSelector({ skin, modo, onSkin, onModo }: Props) {
  return (
    <div
      className="skin-selector"
      role="group"
      aria-label="Apariencia del juego"
    >
      <span className="etq">SKIN</span>
      <div className="grupo">
        {SKIN_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={skin === id}
            title={SKINS[id].descripcion}
            onClick={() => onSkin(id)}
          >
            {SKINS[id].etiqueta}
          </button>
        ))}
      </div>
      <div className="grupo">
        {(["claro", "oscuro"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={modo === m}
            onClick={() => onModo(m)}
          >
            {m.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
