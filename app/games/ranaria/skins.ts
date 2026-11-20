// Paletas de FROGGER (ranaria) por skin y modo. Contrastes medidos (WCAG): texto del HUD
// >= 4.5:1 sobre su recuadro y objetos de juego (vehículos, troncos, tortugas, rana,
// barra de tiempo) >= 3:1 contra el fondo sobre el que se dibujan.

import type { Modo, SkinId } from "../skins";

export interface Paleta {
  road: string;
  roadLine: string; // decorativa
  river: string;
  riverWave: string; // decorativa
  safe: string;
  safeDot: string; // decorativa
  goalsBank: string;
  goalSlot: string;
  goalBorder: string;
  cars: [string, string, string];
  wheel: string;
  windshield: string;
  truck: string;
  truckCab: string;
  log: string;
  logLine: string;
  turtle: string;
  turtleScale: string;
  turtleSub: string; // contorno de la tortuga sumergida (sin alfa)
  frog: string;
  frogDark: string; // patas
  frogEdge: string; // contorno de la rana: la separa de cualquier fondo
  eyeWhite: string;
  eyeBlack: string;
  hudText: string;
  hudBack: string; // recuadro opaco tras el texto del HUD
  lifeIcon: string;
  timeTrack: string; // carril de la barra de tiempo (oscuro, opaco)
  timeOk: string;
  timeMid: string;
  timeLow: string;
  glow: number; // shadowBlur; 0 = sin glow
  pixel: boolean; // píxel duro: sin suavizado y formas rectas, sin alfa ni curvas
}

export const SKINS_RANARIA: Record<SkinId, Record<Modo, Paleta>> = {
  clasico: {
    claro: {
      road: "#2d3748",
      roadLine: "#a0aec0",
      river: "#9cc7f0",
      riverWave: "#6fa5d8",
      safe: "#d3e9cc",
      safeDot: "#a9d0a0",
      goalsBank: "#8cc784",
      goalSlot: "#25402f",
      goalBorder: "#f0c040",
      cars: ["#ef5350", "#fdd835", "#64b5f6"],
      wheel: "#0f1420",
      windshield: "#dbe4f0",
      truck: "#a0aec0",
      truckCab: "#e2e8f0",
      log: "#7a4a22",
      logLine: "#4a2a10",
      turtle: "#14472b",
      turtleScale: "#0a2e1a",
      turtleSub: "#2f6aa8",
      frog: "#3fbf1f",
      frogDark: "#2a8a14",
      frogEdge: "#0b2a0b",
      eyeWhite: "#ffffff",
      eyeBlack: "#000000",
      hudText: "#ffffff",
      hudBack: "#1b2230",
      lifeIcon: "#7dff4a",
      timeTrack: "#1b2230",
      timeOk: "#7dff4a",
      timeMid: "#ffd84a",
      timeLow: "#ff6b6b",
      glow: 0,
      pixel: false,
    },
    oscuro: {
      road: "#141a26",
      roadLine: "#4a5568",
      river: "#1e3a5f",
      riverWave: "#2f5a8a",
      safe: "#25402f",
      safeDot: "#356348",
      goalsBank: "#3f7a4a",
      goalSlot: "#101814",
      goalBorder: "#e8b923",
      cars: ["#ef5350", "#fdd835", "#64b5f6"],
      wheel: "#05070b",
      windshield: "#dbe4f0",
      truck: "#a0aec0",
      truckCab: "#e2e8f0",
      log: "#b07a40",
      logLine: "#6a4420",
      turtle: "#4cc97b",
      turtleScale: "#2a7f4c",
      turtleSub: "#6aa6e0",
      frog: "#8cf05a",
      frogDark: "#5cc43a",
      frogEdge: "#0b1a0b",
      eyeWhite: "#ffffff",
      eyeBlack: "#000000",
      hudText: "#e8edf5",
      hudBack: "#0f1520",
      lifeIcon: "#8cf05a",
      timeTrack: "#0f1520",
      timeOk: "#8cf05a",
      timeMid: "#ffd84a",
      timeLow: "#ff6b6b",
      glow: 0,
      pixel: false,
    },
  },
  neon: {
    claro: {
      road: "#34285c",
      roadLine: "#8a7fc0",
      river: "#c4cdf5",
      riverWave: "#8a9be0",
      safe: "#dcf2e0",
      safeDot: "#aedcb8",
      goalsBank: "#8fdca0",
      goalSlot: "#1d1440",
      goalBorder: "#ff2d9a",
      cars: ["#ff2d6f", "#ffe600", "#00d4ff"],
      wheel: "#0d0820",
      windshield: "#ffffff",
      truck: "#a8a0d8",
      truckCab: "#ece8ff",
      log: "#7a3a10",
      logLine: "#4a2008",
      turtle: "#05492a",
      turtleScale: "#032c18",
      turtleSub: "#5a6ad0",
      frog: "#12b34a",
      frogDark: "#0a8a36",
      frogEdge: "#052a14",
      eyeWhite: "#ffffff",
      eyeBlack: "#000000",
      hudText: "#ffffff",
      hudBack: "#2a0a5e",
      lifeIcon: "#5dff8a",
      timeTrack: "#2a0a5e",
      timeOk: "#5dff8a",
      timeMid: "#ffe600",
      timeLow: "#ff5c8a",
      glow: 4, // atenuado para que no ensucie el fondo claro
      pixel: false,
    },
    oscuro: {
      // El look original
      road: "#0a0a0f",
      roadLine: "#3a3a48",
      river: "#0b1f4a",
      riverWave: "#173a7a",
      safe: "#0f3d1c",
      safeDot: "#1d5c2e",
      goalsBank: "#3fae4a",
      goalSlot: "#0d3a18",
      goalBorder: "#e8b923",
      cars: ["#ff3b6b", "#ffe600", "#2ea8ff"],
      wheel: "#111111",
      windshield: "#ffffff",
      truck: "#a0a0c0",
      truckCab: "#e0e0f0",
      log: "#a8672e",
      logLine: "#5a3416",
      turtle: "#2ecc71",
      turtleScale: "#1c6b33",
      turtleSub: "#2e9e6f",
      frog: "#7dff4a",
      frogDark: "#3fbf1f",
      frogEdge: "#021a02",
      eyeWhite: "#ffffff",
      eyeBlack: "#000000",
      hudText: "#ffffff",
      hudBack: "#050510",
      lifeIcon: "#7dff4a",
      timeTrack: "#050510",
      timeOk: "#43ff6b",
      timeMid: "#ffe600",
      timeLow: "#ff4060",
      glow: 10,
      pixel: false,
    },
  },
  retro: {
    claro: {
      // Game Boy / papel verdoso: solo 4 verdes
      road: "#0f380f",
      roadLine: "#306230",
      river: "#306230",
      riverWave: "#8bac0f",
      safe: "#9bbc0f",
      safeDot: "#8bac0f",
      goalsBank: "#8bac0f",
      goalSlot: "#0f380f",
      goalBorder: "#9bbc0f",
      cars: ["#9bbc0f", "#8bac0f", "#9bbc0f"],
      wheel: "#306230",
      windshield: "#0f380f",
      truck: "#8bac0f",
      truckCab: "#9bbc0f",
      log: "#9bbc0f",
      logLine: "#306230",
      turtle: "#9bbc0f",
      turtleScale: "#0f380f",
      turtleSub: "#9bbc0f",
      frog: "#0f380f",
      frogDark: "#0f380f",
      frogEdge: "#9bbc0f",
      eyeWhite: "#9bbc0f",
      eyeBlack: "#0f380f",
      hudText: "#9bbc0f",
      hudBack: "#0f380f",
      lifeIcon: "#9bbc0f",
      timeTrack: "#0f380f",
      timeOk: "#9bbc0f",
      timeMid: "#8bac0f",
      timeLow: "#8bac0f",
      glow: 0,
      pixel: true,
    },
    oscuro: {
      // fósforo ámbar sobre negro
      road: "#0a0700",
      roadLine: "#4a3200",
      river: "#2e1f00",
      riverWave: "#7a5200",
      safe: "#1f1700",
      safeDot: "#4a3200",
      goalsBank: "#7a5200",
      goalSlot: "#0a0700",
      goalBorder: "#ffb000",
      cars: ["#ffb000", "#ffd37a", "#cc8a00"],
      wheel: "#4a3200",
      windshield: "#0a0700",
      truck: "#cc8a00",
      truckCab: "#ffd37a",
      log: "#cc8a00",
      logLine: "#7a5200",
      turtle: "#ffd37a",
      turtleScale: "#7a5200",
      turtleSub: "#cc8a00",
      frog: "#ffb000",
      frogDark: "#ffb000",
      frogEdge: "#0a0700",
      eyeWhite: "#0a0700",
      eyeBlack: "#ffd37a",
      hudText: "#ffb000",
      hudBack: "#0a0700",
      lifeIcon: "#ffb000",
      timeTrack: "#0a0700",
      timeOk: "#ffb000",
      timeMid: "#ffd37a",
      timeLow: "#cc8a00",
      glow: 0,
      pixel: true,
    },
  },
};
