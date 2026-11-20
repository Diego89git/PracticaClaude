"use client";

import { useEffect, useRef } from "react";
import { createAsteroides } from "../games/asteroides/engine";
import { SKIN_DEFAULT } from "../games/skins";
import { SKINS_ASTEROIDES } from "../games/asteroides/skins";
import type { GameEngine, GameProps } from "../games/types";

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

export function AsteroidesGame({
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

  // Los callbacks del padre cambian en cada render; el motor usa siempre los últimos.
  useEffect(() => {
    handlers.current = {
      onScoreChange,
      onLivesChange,
      onLevelChange,
      onGameOver,
    };
  });

  // Crea el motor al montar y lo destruye al desmontar (también en Strict Mode).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createAsteroides(
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

  // Pausa de la plataforma o fin de partida (FIN / game over).
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
      width={800}
      height={600}
      role="img"
      aria-label="Juego ASTEROIDES"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        background: SKINS_ASTEROIDES[skin][modo].fondo,
      }}
    />
  );
}
