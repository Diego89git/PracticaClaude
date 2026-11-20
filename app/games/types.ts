// Contrato común de los juegos reales de Arcade Vault.
// Ver .claude/skills/add-game/references/pattern.md (secciones 2 y 3).

import type { Modo, SkinId } from "./skins";

export interface GameEvents {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}

export interface GameEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void; // cancela requestAnimationFrame y quita los listeners
  // Cambia de skin en caliente, sin reiniciar la partida. Opcional: solo los juegos
  // con skins lo implementan (ver references/game-with-themes.md).
  setSkin?: (skin: SkinId, modo: Modo) => void;
}

// Props que recibe el componente de cada juego desde el reproductor.
export interface GameProps extends GameEvents {
  paused: boolean;
  over: boolean; // true = partida terminada (por FIN o por game over)
  runId: number; // cambia en cada JUGAR DE NUEVO para reiniciar
  skin?: SkinId; // opcionales hasta que todos los juegos soporten skins
  modo?: Modo;
}
