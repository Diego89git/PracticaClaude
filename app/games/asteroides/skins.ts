// Paletas de ASTEROIDES por skin y modo. Contrastes medidos (WCAG) contra `fondo`:
// texto >= 4.5:1 y objetos de juego >= 3:1 en las seis combinaciones.

import type { Modo, SkinId } from "../skins";

export interface Paleta {
  fondo: string;
  nave: string;
  asteroide: string;
  bala: string;
  particula: string;
  powerup: string; // cuadro del 3x y su texto
  llama: string; // propulsor
  texto: string; // indicador 3x del HUD del canvas
  glow: number; // shadowBlur; 0 = sin glow
  pixel: boolean; // píxel duro: sin suavizado, sin alfa, coordenadas enteras
}

export const SKINS_ASTEROIDES: Record<SkinId, Record<Modo, Paleta>> = {
  clasico: {
    claro: {
      fondo: "#f4f6fa",
      nave: "#1b2230",
      asteroide: "#4a5568",
      bala: "#111827",
      particula: "#4a5568",
      powerup: "#0b6b8a",
      llama: "#b4500a",
      texto: "#0b6b8a",
      glow: 0,
      pixel: false,
    },
    oscuro: {
      fondo: "#1b2230",
      nave: "#e8edf5",
      asteroide: "#aab6c8",
      bala: "#ffffff",
      particula: "#aab6c8",
      powerup: "#5fd0e8",
      llama: "#f0a050",
      texto: "#5fd0e8",
      glow: 0,
      pixel: false,
    },
  },
  neon: {
    claro: {
      fondo: "#e6e1f5",
      nave: "#2a0a5e",
      asteroide: "#5b2a9e",
      bala: "#1a0040",
      particula: "#5b2a9e",
      powerup: "#006f8a",
      llama: "#b84a00",
      texto: "#006f8a",
      glow: 4, // atenuado para que no ensucie el fondo claro
      pixel: false,
    },
    oscuro: {
      fondo: "#000000",
      nave: "#ffffff",
      asteroide: "#ffffff",
      bala: "#ffffff",
      particula: "#ffffff",
      powerup: "#00ffff",
      llama: "#ff8200",
      texto: "#00ffff",
      glow: 10,
      pixel: false,
    },
  },
  retro: {
    claro: {
      // Game Boy / papel verdoso
      fondo: "#9bbc0f",
      nave: "#0f380f",
      asteroide: "#306230",
      bala: "#0f380f",
      particula: "#306230",
      powerup: "#0f380f",
      llama: "#306230",
      texto: "#0f380f",
      glow: 0,
      pixel: true,
    },
    oscuro: {
      // fósforo ámbar sobre negro
      fondo: "#0a0700",
      nave: "#ffb000",
      asteroide: "#cc8a00",
      bala: "#ffd37a",
      particula: "#cc8a00",
      powerup: "#ffb000",
      llama: "#ff6a00",
      texto: "#ffb000",
      glow: 0,
      pixel: true,
    },
  },
};
