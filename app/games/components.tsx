"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { GameProps } from "./types";

// Componente de cada juego real, con carga diferida: el código de un juego solo se
// descarga al abrir su reproductor. Debe tener una entrada por id de catalog.ts.
export const COMPONENTES: Record<string, ComponentType<GameProps>> = {
  asteroides: dynamic(() =>
    import("../components/asteroides-game").then((m) => m.AsteroidesGame),
  ),
  caida: dynamic(() =>
    import("../components/caida-game").then((m) => m.CaidaGame),
  ),
  "bloque-buster": dynamic(() =>
    import("../components/bloque-buster-game").then((m) => m.BloqueBusterGame),
  ),
  serpentina: dynamic(() =>
    import("../components/serpentina-game").then((m) => m.SerpentinaGame),
  ),
  ranaria: dynamic(() =>
    import("../components/ranaria-game").then((m) => m.RanariaGame),
  ),
};
