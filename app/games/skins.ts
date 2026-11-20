// Skins de Arcade Vault. Datos puros, sin "use client", para poder importarlos desde
// Server Components, componentes de cliente y motores.

export type SkinId = "clasico" | "neon" | "retro";
export type Modo = "claro" | "oscuro";

export const SKIN_DEFAULT: SkinId = "clasico";

export const SKINS: Record<SkinId, { etiqueta: string; descripcion: string }> =
  {
    clasico: {
      etiqueta: "CLÁSICO",
      descripcion: "Colores planos y sobrios, sin glow.",
    },
    neon: {
      etiqueta: "NEÓN",
      descripcion: "Glow y colores saturados.",
    },
    retro: {
      etiqueta: "RETRO",
      descripcion: "Paleta 8-bit de píxel duro, estilo CRT.",
    },
  };

export const SKIN_IDS = Object.keys(SKINS) as SkinId[];

export const esSkinId = (v: unknown): v is SkinId =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(SKINS, v);

// Juegos cuyo motor ya implementa skins (el reproductor solo muestra el selector en ellos).
// Mantener sincronizado con references/game-with-themes.md.
export const JUEGOS_CON_SKINS: string[] = ["asteroides", "serpentina", "ranaria"];
