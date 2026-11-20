// Paletas de SERPENTINA por skin y modo. Contrastes medidos (WCAG) contra `fondo`:
// texto >= 4.5:1 y objetos de juego (cuerpo, cabeza, fruta retro) >= 3:1.

import type { Modo, SkinId } from "../skins";

export interface Paleta {
  fondo: string;
  rejilla: string; // decorativa, sin requisito de contraste
  cuerpo: string;
  cabeza: string;
  ojo: string;
  fruta: string; // solo se usa en retro, donde la fruta se dibuja en píxel de un color
  texto: string; // "PULSA UNA FLECHA"
  glow: number; // shadowBlur; 0 = sin glow
  pixel: boolean; // píxel duro: sin suavizado, esquinas rectas y fruta de un color
}

export const SKINS_SERPENTINA: Record<SkinId, Record<Modo, Paleta>> = {
  clasico: {
    claro: {
      fondo: "#f4f6fa",
      rejilla: "#e1e6ee",
      cuerpo: "#2f7d4f",
      cabeza: "#1b4d30",
      ojo: "#ffffff",
      fruta: "#b4231a",
      texto: "#1b2230",
      glow: 0,
      pixel: false,
    },
    oscuro: {
      fondo: "#1b2230",
      rejilla: "#263043",
      cuerpo: "#4fbf7f",
      cabeza: "#8fe3b0",
      ojo: "#1b2230",
      fruta: "#ff8a80",
      texto: "#e8edf5",
      glow: 0,
      pixel: false,
    },
  },
  neon: {
    claro: {
      fondo: "#e6e1f5",
      rejilla: "#d4cce9",
      cuerpo: "#0a8a4a",
      cabeza: "#046a38",
      ojo: "#ffffff",
      fruta: "#b4231a",
      texto: "#2a0a5e",
      glow: 4, // atenuado para que no ensucie el fondo claro
      pixel: false,
    },
    oscuro: {
      // El look original
      fondo: "#0a0a18",
      rejilla: "#12122a",
      cuerpo: "#2ecc71",
      cabeza: "#7dffb0",
      ojo: "#000000",
      fruta: "#ff5f8a",
      texto: "#e0e0e0",
      glow: 10,
      pixel: false,
    },
  },
  retro: {
    claro: {
      // Game Boy / papel verdoso
      fondo: "#9bbc0f",
      rejilla: "#8bac0f",
      cuerpo: "#306230",
      cabeza: "#0f380f",
      ojo: "#9bbc0f",
      fruta: "#0f380f",
      texto: "#0f380f",
      glow: 0,
      pixel: true,
    },
    oscuro: {
      // fósforo ámbar sobre negro
      fondo: "#0a0700",
      rejilla: "#1f1700",
      cuerpo: "#cc8a00",
      cabeza: "#ffb000",
      ojo: "#0a0700",
      fruta: "#ffd37a",
      texto: "#ffb000",
      glow: 0,
      pixel: true,
    },
  },
};
