"use client";

// Monta el motor de SERPENTINA en un canvas de 800×600.
// Contrato y motivos: .claude/skills/add-game/references/pattern.md
import { useEffect, useRef } from "react";
import { createSerpentina } from "../games/serpentina/engine";
import { SKIN_DEFAULT } from "../games/skins";
import { SKINS_SERPENTINA } from "../games/serpentina/skins";
import type { GameEngine, GameProps } from "../games/types";

// Teclas del juego: se les quita el comportamiento del navegador (scroll, activar botones).
const GAME_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
]);

const isTextField = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

export function SerpentinaGame({
  paused,
  over,
  runId,
  onScoreChange,
  onLivesChange,
  onLevelChange,
  onGameOver,
  skin = SKIN_DEFAULT,
  modo = "oscuro",
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const handlers = useRef({
    onScoreChange,
    onLivesChange,
    onLevelChange,
    onGameOver,
  });
  const lastRunId = useRef(runId);
  // Skin vigente al montar el motor; los cambios posteriores van por setSkin.
  const skinInicial = useRef({ skin, modo });
  const stopped = paused || over;

  // El padre pasa funciones nuevas en cada render; el motor usa siempre las últimas.
  useEffect(() => {
    handlers.current = {
      onScoreChange,
      onLivesChange,
      onLevelChange,
      onGameOver,
    };
  });

  // Crea el motor al montar y lo destruye al desmontar (también en Strict Mode,
  // que monta el efecto dos veces en desarrollo).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createSerpentina(
      canvas,
      {
        onScoreChange: (v) => handlers.current.onScoreChange(v),
        onLivesChange: (v) => handlers.current.onLivesChange(v),
        onLevelChange: (v) => handlers.current.onLevelChange(v),
        onGameOver: (v) => handlers.current.onGameOver(v),
      },
      skinInicial.current,
    );
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  // Cambio de skin o de modo claro/oscuro en caliente, sin reiniciar la partida.
  useEffect(() => {
    engineRef.current?.setSkin?.(skin, modo);
  }, [skin, modo]);

  // JUGAR DE NUEVO: runId cambia y la partida empieza desde cero.
  useEffect(() => {
    if (lastRunId.current === runId) return;
    lastRunId.current = runId;
    engineRef.current?.restart();
  }, [runId]);

  // Pausa de la plataforma o fin de partida (FIN / game over). Va después del
  // efecto de runId para que, al reiniciar, la pausa sea la que manda.
  useEffect(() => {
    if (stopped) engineRef.current?.pause();
    else engineRef.current?.resume();
  }, [stopped]);

  // Evita el scroll de la página y la activación de botones enfocados mientras se juega.
  useEffect(() => {
    if (stopped) return;
    const block = (e: KeyboardEvent) => {
      if (GAME_KEYS.has(e.code) && !isTextField(e.target)) e.preventDefault();
    };
    window.addEventListener("keydown", block);
    window.addEventListener("keyup", block);
    return () => {
      window.removeEventListener("keydown", block);
      window.removeEventListener("keyup", block);
    };
  }, [stopped]);

  return (
    <canvas
      ref={canvasRef}
      width={800} // = W del motor
      height={600} // = H del motor
      role="img"
      aria-label="Juego SERPENTINA"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        background: SKINS_SERPENTINA[skin][modo].fondo,
        // Si el canvas no es 4:3 (p. ej. 300×600), se centra con barras negras
        // dentro del marco CRT en lugar de deformarse.
        objectFit: "contain",
      }}
    />
  );
}
