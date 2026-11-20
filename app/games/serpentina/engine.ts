// Motor de SERPENTINA (Snake). Juego creado desde cero (SPEC 09); las frutas salen de
// references/source-assets/snake-assets/. Sin React ni DOM: recibe un canvas y notifica
// los cambios con callbacks. El HUD, la pausa y el fin de partida los pone la plataforma.
import type { GameEngine, GameEvents } from "../types";
import type { Modo, SkinId } from "../skins";
import { SKIN_DEFAULT } from "../skins";
import { SKINS_SERPENTINA, type Paleta } from "./skins";
import { FRUITS_URL, FRUIT_FRAMES, drawFruit, drawFruitPixel } from "./sprites";

// Tamaño lógico del canvas (4:3). Debe coincidir con width/height del <canvas>.
const W = 800;
const H = 600;

const CELL = 40;
const COLS = W / CELL; // 20
const ROWS = H / CELL; // 15
const START_LENGTH = 3;
const FRUIT_SCORE = 10;
const FRUITS_PER_LEVEL = 5;
const BASE_STEP_MS = 150;
const STEP_MS_PER_LEVEL = 10;
const MIN_STEP_MS = 60;
const MAX_QUEUE = 2;

interface Cell {
  x: number;
  y: number;
}
type Dir = "up" | "down" | "left" | "right";

const VECTORS: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};
const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const stepMsFor = (level: number) =>
  Math.max(MIN_STEP_MS, BASE_STEP_MS - (level - 1) * STEP_MS_PER_LEVEL);

export function createSerpentina(
  canvas: HTMLCanvasElement,
  events: GameEvents,
  opciones: { skin?: SkinId; modo?: Modo } = {},
): GameEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx)
    return {
      pause() {},
      resume() {},
      restart() {},
      destroy() {},
      setSkin() {},
    };
  const c: CanvasRenderingContext2D = ctx; // evita `ctx!` dentro de las funciones

  // Paleta activa; setSkin la cambia en caliente sin tocar el estado de la partida.
  let pal: Paleta =
    SKINS_SERPENTINA[opciones.skin ?? SKIN_DEFAULT][opciones.modo ?? "oscuro"];
  // Fondo + rejilla (estáticos): se dibujan una vez y se copian en cada fotograma.
  let bg: OffscreenCanvas | null = null;
  const pintarFondo = () => {
    if (typeof OffscreenCanvas === "undefined") return;
    bg = new OffscreenCanvas(W, H);
    const b = bg.getContext("2d");
    if (!b) {
      bg = null;
      return;
    }
    b.fillStyle = pal.fondo;
    b.fillRect(0, 0, W, H);
    b.strokeStyle = pal.rejilla;
    b.lineWidth = 1;
    b.beginPath();
    for (let x = 1; x < COLS; x++) {
      b.moveTo(x * CELL + 0.5, 0);
      b.lineTo(x * CELL + 0.5, H);
    }
    for (let y = 1; y < ROWS; y++) {
      b.moveTo(0, y * CELL + 0.5);
      b.lineTo(W, y * CELL + 0.5);
    }
    b.stroke();
  };
  const aplicarSkin = () => {
    c.imageSmoothingEnabled = !pal.pixel;
    pintarFondo();
  };
  aplicarSkin();

  // ── Assets ────────────────────────────────────────────────────────────────
  // Hasta que la imagen carga no se acepta entrada ni se avanza.
  const sheet = new Image();
  let sheetReady = false;
  let destroyed = false;
  sheet.onload = () => {
    if (!destroyed) sheetReady = true;
  };
  sheet.onerror = () => console.error("Failed to load fruits spritesheet");
  sheet.src = FRUITS_URL;

  // ── Estado ────────────────────────────────────────────────────────────────
  let snake: Cell[] = []; // snake[0] es la cabeza
  let dir: Dir = "right"; // dirección aplicada en el último paso
  let queue: Dir[] = []; // flechas pendientes, como máximo MAX_QUEUE
  let waiting = true; // true hasta la primera flecha válida
  let fruit: { cell: Cell; sprite: number } = {
    cell: { x: 0, y: 0 },
    sprite: 0,
  };
  let eaten = 0;
  let stepTimer = 0; // ms acumulados desde el último paso
  let score = 0;
  const lives = 0; // Snake no tiene vidas: el HUD las oculta
  let level = 1;
  let ended = false; // tras el fin de partida la lógica ya no avanza
  let gameOverPending = false;
  let paused = false;
  let raf = 0;
  let lastTime: number | null = null;

  // Último valor notificado de cada campo (null fuerza la notificación).
  let sentScore: number | null = null;
  let sentLives: number | null = null;
  let sentLevel: number | null = null;

  // Cada callback se dispara solo cuando su valor cambia. onGameOver va el último,
  // para que la plataforma ya muestre el HUD final cuando abre el modal.
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

  function endGame() {
    ended = true;
    gameOverPending = true;
  }

  // Coloca la fruta en una casilla libre (primero se elige la casilla y después el
  // sprite: son las dos llamadas a Math.random). Sin casilla libre, la partida acaba.
  function spawnFruit() {
    const free: Cell[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    if (free.length === 0) {
      endGame();
      return;
    }
    const cell = free[Math.floor(Math.random() * free.length)];
    const sprite = Math.floor(Math.random() * FRUIT_FRAMES.length);
    fruit = { cell, sprite };
  }

  function init() {
    score = 0;
    level = 1;
    eaten = 0;
    ended = false;
    gameOverPending = false;
    sentScore = sentLives = sentLevel = null;
    const headX = Math.floor(COLS / 2);
    const headY = Math.floor(ROWS / 2);
    snake = [];
    for (let i = 0; i < START_LENGTH; i++)
      snake.push({ x: headX - i, y: headY });
    dir = "right";
    queue = [];
    waiting = true;
    stepTimer = 0;
    spawnFruit();
    emitChanges();
  }

  // ── Entrada ───────────────────────────────────────────────────────────────
  // Los campos de texto (el nombre del modal) no deben mover el juego.
  const isTextField = (t: EventTarget | null) =>
    t instanceof HTMLElement &&
    (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

  const onKeyDown = (e: KeyboardEvent) => {
    const d = KEY_DIR[e.code];
    if (!d || paused || ended || !sheetReady || isTextField(e.target)) return;
    if (waiting) {
      // ← se ignora: con la serpiente mirando a la derecha se mordería al instante.
      if (d === "left") return;
      dir = d;
      waiting = false;
      stepTimer = 0;
      return;
    }
    const last = queue.length > 0 ? queue[queue.length - 1] : dir;
    if (d === last || d === OPPOSITE[last] || queue.length >= MAX_QUEUE) return;
    queue.push(d);
  };

  // ── Lógica ────────────────────────────────────────────────────────────────
  function step() {
    const next = queue.shift();
    if (next) dir = next;
    const v = VECTORS[dir];
    const head = snake[0];
    const nx = (head.x + v.x + COLS) % COLS;
    const ny = (head.y + v.y + ROWS) % ROWS;
    const eating = nx === fruit.cell.x && ny === fruit.cell.y;

    // La casilla que deja la cola en este paso cuenta como libre salvo que coma.
    const solid = eating ? snake.length : snake.length - 1;
    for (let i = 0; i < solid; i++) {
      if (snake[i].x === nx && snake[i].y === ny) {
        endGame();
        return;
      }
    }

    snake.unshift({ x: nx, y: ny });
    if (!eating) {
      snake.pop();
      return;
    }
    score += FRUIT_SCORE;
    eaten++;
    level = Math.floor(eaten / FRUITS_PER_LEVEL) + 1;
    spawnFruit();
  }

  function update(dt: number) {
    if (ended || waiting) return;
    stepTimer += dt * 1000;
    const ms = stepMsFor(level);
    if (stepTimer < ms) return;
    stepTimer -= ms;
    step();
  }

  // ── Dibujo ────────────────────────────────────────────────────────────────
  // Sin HUD ni "GAME OVER": los dibuja la plataforma. Solo lo propio del juego.
  function drawHead(cell: Cell) {
    const cx = cell.x * CELL + CELL / 2;
    const cy = cell.y * CELL + CELL / 2;
    c.fillStyle = pal.cabeza;
    c.shadowColor = pal.cabeza;
    c.shadowBlur = pal.glow;
    c.beginPath();
    c.roundRect(
      cell.x * CELL + 2,
      cell.y * CELL + 2,
      CELL - 4,
      CELL - 4,
      pal.pixel ? 0 : 10,
    );
    c.fill();
    c.shadowBlur = 0;
    const f = VECTORS[dir];
    c.fillStyle = pal.ojo;
    for (const side of [-1, 1]) {
      const ex = cx + f.x * 8 - f.y * 8 * side;
      const ey = cy + f.y * 8 + f.x * 8 * side;
      if (pal.pixel) {
        c.fillRect(Math.round(ex) - 3, Math.round(ey) - 3, 6, 6);
      } else {
        c.beginPath();
        c.arc(ex, ey, 3, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  // Respaldo si no hay OffscreenCanvas.
  function dibujarRejilla() {
    c.strokeStyle = pal.rejilla;
    c.lineWidth = 1;
    c.beginPath();
    for (let x = 1; x < COLS; x++) {
      c.moveTo(x * CELL + 0.5, 0);
      c.lineTo(x * CELL + 0.5, H);
    }
    for (let y = 1; y < ROWS; y++) {
      c.moveTo(0, y * CELL + 0.5);
      c.lineTo(W, y * CELL + 0.5);
    }
    c.stroke();
  }

  function draw() {
    if (!sheetReady || !bg) {
      c.fillStyle = pal.fondo;
      c.fillRect(0, 0, W, H);
      if (!sheetReady) return;
      dibujarRejilla();
    } else {
      c.drawImage(bg, 0, 0);
    }

    c.shadowColor = pal.fruta;
    c.shadowBlur = pal.glow;
    if (pal.pixel) {
      drawFruitPixel(
        c,
        pal.fruta,
        fruit.cell.x * CELL,
        fruit.cell.y * CELL,
        CELL,
      );
    } else {
      drawFruit(
        c,
        sheet,
        fruit.sprite,
        fruit.cell.x * CELL,
        fruit.cell.y * CELL,
        CELL,
      );
    }
    c.shadowBlur = 0;

    c.fillStyle = pal.cuerpo;
    c.shadowColor = pal.cuerpo;
    c.shadowBlur = pal.glow;
    for (let i = snake.length - 1; i >= 1; i--) {
      c.beginPath();
      c.roundRect(
        snake[i].x * CELL + 2,
        snake[i].y * CELL + 2,
        CELL - 4,
        CELL - 4,
        pal.pixel ? 0 : 8,
      );
      c.fill();
    }
    c.shadowBlur = 0;
    drawHead(snake[0]);

    if (waiting) {
      c.fillStyle = pal.texto;
      c.font = "bold 28px monospace";
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("PULSA UNA FLECHA", W / 2, H / 2 + CELL * 2);
    }
  }

  // ── Bucle ─────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    // dt limitado a 50 ms: al volver a la pestaña no hay saltos enormes.
    const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
    lastTime = ts;
    if (!paused && sheetReady) {
      update(dt);
      emitChanges();
    }
    draw(); // en pausa se sigue dibujando el último fotograma
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", onKeyDown);

  init();
  raf = requestAnimationFrame(loop);

  return {
    pause() {
      paused = true;
      queue = [];
    },
    resume() {
      paused = false;
      queue = [];
      lastTime = null;
    },
    restart() {
      paused = false;
      lastTime = null;
      init();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
    },
    setSkin(skin, modo) {
      pal = SKINS_SERPENTINA[skin][modo];
      aplicarSkin();
    },
  };
}
