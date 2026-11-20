// Plantilla de motor para Arcade Vault. Copiar a app/games/{{id}}/engine.ts.
// Sustituir {{Id}} por el nombre en PascalCase (p. ej. Tetris) y rellenar los TODO.
// Contrato completo y motivos: .claude/skills/add-game/references/pattern.md
import type { GameEngine, GameEvents } from "../types";

// Tamaño lógico del canvas. Debe coincidir con width/height del <canvas> del componente.
export const W = 800;
export const H = 600;

type Keys = Record<string, boolean | undefined>;

export function create{{Id}}(
  canvas: HTMLCanvasElement,
  events: GameEvents,
): GameEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { pause() {}, resume() {}, restart() {}, destroy() {} };
  const c: CanvasRenderingContext2D = ctx; // evita `ctx!` dentro de las funciones

  // ── Entrada ───────────────────────────────────────────────────────────────
  let keys: Keys = {};
  let justPressed: Keys = {};

  // Los campos de texto (el nombre del modal) no deben mover el juego.
  const isTextField = (t: EventTarget | null) =>
    t instanceof HTMLElement &&
    (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

  const onKeyDown = (e: KeyboardEvent) => {
    if (paused || isTextField(e.target)) return;
    if (!keys[e.code]) justPressed[e.code] = true;
    keys[e.code] = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys[e.code] = false;
  };

  // true una sola vez por pulsación (disparo, salto, rotación...).
  const pressed = (code: string) => {
    const v = justPressed[code];
    justPressed[code] = false;
    return !!v;
  };
  const clearInput = () => {
    keys = {};
    justPressed = {};
  };

  // ── Estado ────────────────────────────────────────────────────────────────
  let score = 0;
  let lives = 3; // si el juego no tiene vidas, déjalo así y oculta "Vidas" en el catálogo
  let level = 1;
  let ended = false; // tras el game over la lógica ya no avanza
  let gameOverPending = false;
  let paused = false;
  let raf = 0;
  let lastTime: number | null = null;
  // TODO: estado propio del juego (tablero, entidades, temporizadores...)

  // Último valor notificado de cada campo (null fuerza la notificación).
  let sentScore: number | null = null;
  let sentLives: number | null = null;
  let sentLevel: number | null = null;

  // Cada callback se dispara solo cuando su valor cambia. onGameOver va el último,
  // para que la plataforma ya muestre las vidas a 0 cuando abre el modal.
  function emitChanges() {
    if (score !== sentScore) {
      sentScore = score;
      events.onScoreChange(score);
    }
    if (lives !== sentLives) {
      sentLives = lives;
      events.onLivesChange(lives);
    }
    if (level !== sentLevel) {
      sentLevel = level;
      events.onLevelChange(level);
    }
    if (gameOverPending) {
      gameOverPending = false;
      events.onGameOver(score);
    }
  }

  function init() {
    score = 0;
    lives = 3;
    level = 1;
    ended = false;
    gameOverPending = false;
    sentScore = sentLives = sentLevel = null;
    // TODO: reiniciar el estado propio del juego
    emitChanges();
  }

  function endGame() {
    ended = true;
    gameOverPending = true;
  }

  // ── Lógica ────────────────────────────────────────────────────────────────
  function update(dt: number) {
    if (ended) return;
    // TODO: usar keys / pressed("Space") y dt (segundos). Llamar endGame() al perder.
    void dt;
    void pressed;
    void endGame;
  }

  // ── Dibujo ────────────────────────────────────────────────────────────────
  // Sin HUD ni "GAME OVER": los dibuja la plataforma. Solo lo propio del juego.
  function draw() {
    c.fillStyle = "#000";
    c.fillRect(0, 0, W, H);
    // TODO
  }

  // ── Bucle ─────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    // dt limitado a 50 ms: al volver a la pestaña no hay saltos enormes.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!paused) {
      update(dt);
      emitChanges();
    }
    draw(); // en pausa se sigue dibujando el último fotograma
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  init();
  raf = requestAnimationFrame(loop);

  return {
    pause() {
      paused = true;
      clearInput();
    },
    resume() {
      paused = false;
      clearInput();
      lastTime = null;
    },
    restart() {
      paused = false;
      clearInput();
      lastTime = null;
      init();
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
