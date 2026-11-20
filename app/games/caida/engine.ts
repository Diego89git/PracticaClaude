// Motor de CAÍDA (Tetris). Portado de references/started-games/03-tetris/game.js.
// Sin React ni DOM: recibe un canvas y notifica los cambios con callbacks.
// Cambios respecto al original: 7 piezas (sin la «tuerca» N), el HUD y el overlay
// los pone la plataforma, la pausa es el botón PAUSA (sin tecla P) y no hay tema claro.
import type { GameEngine, GameEvents } from "../types";

// Tamaño lógico del canvas (4:3). El tablero ocupa x = BOARD_X..BOARD_X + 300.
const W = 800;
const H = 600;

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const BOARD_X = 150;
const PANEL_X = 490; // columna del panel lateral: SIGUIENTE y LÍNEAS
const PREVIEW_Y = 60;
const PREVIEW_SIZE = 120;

// Colores del tema oscuro del original.
const BG = "#0f0f17";
const BOARD_BG = "#1a1a25";
const GRID_LINE = "#22222e";
const BORDER = "#2a2a3a";
const TEXT = "#e0e0e0";
const LABEL = "#8a8aa8";

const COLORS = [
  null,
  "#4dd0e1", // I - cian
  "#ffd54f", // O - amarillo
  "#ba68c8", // T - morado
  "#81c784", // S - verde
  "#e57373", // Z - rojo
  "#90caf9", // J - azul claro
  "#ffb74d", // L - naranja
];

type Shape = number[][];

const PIECES: (Shape | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
];
const PIECE_TYPES = PIECES.length - 1; // 7

const LINE_SCORES = [0, 100, 300, 500, 800];

interface Piece {
  type: number;
  shape: Shape;
  x: number;
  y: number;
}

function createBoard(): number[][] {
  return Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));
}

function randomPiece(): Piece {
  const type = Math.floor(Math.random() * PIECE_TYPES) + 1;
  const shape = (PIECES[type] as Shape).map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

function rotateCW(shape: Shape): Shape {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let col = 0; col < cols; col++)
      result[col][rows - 1 - r] = shape[r][col];
  return result;
}

export function createCaida(
  canvas: HTMLCanvasElement,
  events: GameEvents,
): GameEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { pause() {}, resume() {}, restart() {}, destroy() {} };
  const c: CanvasRenderingContext2D = ctx; // evita `ctx!` dentro de las funciones

  // ── Entrada ───────────────────────────────────────────────────────────────
  // Los campos de texto (el nombre del modal) no deben mover el juego.
  const isTextField = (t: EventTarget | null) =>
    t instanceof HTMLElement &&
    (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

  // Como el original, cada evento keydown ejecuta su acción, también los que el
  // navegador repite al mantener la tecla pulsada.
  const onKeyDown = (e: KeyboardEvent) => {
    if (paused || ended || isTextField(e.target)) return;
    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
  };

  // ── Estado ────────────────────────────────────────────────────────────────
  let board: number[][] = createBoard();
  let current: Piece; // las rellena init()
  let next: Piece;
  let score = 0;
  let lines = 0;
  let level = 1;
  const lives = 0; // Tetris no tiene vidas: el HUD las oculta
  let dropInterval = 1000;
  let dropAccum = 0;
  let ended = false; // tras el game over la lógica ya no avanza
  let gameOverPending = false;
  let paused = false;
  let raf = 0;
  let lastTime: number | null = null;

  // Último valor notificado de cada campo (null fuerza la notificación).
  let sentScore: number | null = null;
  let sentLives: number | null = null;
  let sentLevel: number | null = null;

  // Cada callback se dispara solo cuando su valor cambia. onGameOver va el último,
  // para que la plataforma ya muestre la puntuación final cuando abre el modal.
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

  // ── Lógica (del original) ─────────────────────────────────────────────────
  function collide(shape: Shape, ox: number, oy: number) {
    for (let r = 0; r < shape.length; r++) {
      for (let col = 0; col < shape[r].length; col++) {
        if (!shape[r][col]) continue;
        const nx = ox + col;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function tryRotate() {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge() {
    for (let r = 0; r < current.shape.length; r++)
      for (let col = 0; col < current.shape[r].length; col++)
        if (current.shape[r][col])
          board[current.y + r][current.x + col] = current.shape[r][col];
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    }
  }

  function ghostY() {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    lockPiece();
  }

  function softDrop() {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
    } else {
      lockPiece();
    }
  }

  function lockPiece() {
    merge();
    clearLines();
    spawn();
  }

  function spawn() {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) endGame();
  }

  function endGame() {
    ended = true;
    gameOverPending = true;
  }

  function init() {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    dropAccum = 0;
    ended = false;
    gameOverPending = false;
    sentScore = sentLives = sentLevel = null;
    next = randomPiece();
    spawn();
    emitChanges();
  }

  function update(dt: number) {
    if (ended) return;
    dropAccum += dt * 1000;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) current.y++;
      else lockPiece();
    }
  }

  // ── Dibujo ────────────────────────────────────────────────────────────────
  // Sin puntuación, nivel ni "GAME OVER": los dibuja la plataforma. Aquí solo el
  // tablero y el panel con la siguiente pieza y las líneas, que el HUD no tiene.
  function drawBlock(
    ox: number,
    oy: number,
    x: number,
    y: number,
    colorIndex: number,
    alpha = 1,
  ) {
    if (!colorIndex) return;
    c.globalAlpha = alpha;
    c.fillStyle = COLORS[colorIndex] as string;
    c.fillRect(ox + x * BLOCK + 1, oy + y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
    c.fillStyle = "rgba(255,255,255,0.12)"; // brillo
    c.fillRect(ox + x * BLOCK + 1, oy + y * BLOCK + 1, BLOCK - 2, 4);
    c.globalAlpha = 1;
  }

  function drawGrid(g: CanvasRenderingContext2D) {
    g.strokeStyle = GRID_LINE;
    g.lineWidth = 0.5;
    for (let col = 1; col < COLS; col++) {
      g.beginPath();
      g.moveTo(BOARD_X + col * BLOCK, 0);
      g.lineTo(BOARD_X + col * BLOCK, ROWS * BLOCK);
      g.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      g.beginPath();
      g.moveTo(BOARD_X, r * BLOCK);
      g.lineTo(BOARD_X + COLS * BLOCK, r * BLOCK);
      g.stroke();
    }
  }

  // Fondo estático (fondo, tablero y cuadrícula): se pinta una vez en un lienzo
  // fuera de pantalla y se copia en cada fotograma. Sin OffscreenCanvas se pinta directo.
  function paintStatic(g: CanvasRenderingContext2D) {
    g.fillStyle = BG;
    g.fillRect(0, 0, W, H);
    g.fillStyle = BOARD_BG;
    g.fillRect(BOARD_X, 0, COLS * BLOCK, ROWS * BLOCK);
    drawGrid(g);
  }

  let bgCanvas: OffscreenCanvas | null = null;
  if (typeof OffscreenCanvas !== "undefined") {
    const bg = new OffscreenCanvas(W, H);
    const bgCtx = bg.getContext("2d");
    if (bgCtx) {
      paintStatic(bgCtx as unknown as CanvasRenderingContext2D);
      bgCanvas = bg;
    }
  }

  function drawPanel() {
    c.textAlign = "left";
    c.textBaseline = "alphabetic";

    // SIGUIENTE
    c.font = "bold 14px monospace";
    c.fillStyle = LABEL;
    c.fillText("SIGUIENTE", PANEL_X, PREVIEW_Y - 14);
    c.fillStyle = BOARD_BG;
    c.fillRect(PANEL_X, PREVIEW_Y, PREVIEW_SIZE, PREVIEW_SIZE);
    c.strokeStyle = BORDER;
    c.lineWidth = 1;
    c.strokeRect(
      PANEL_X + 0.5,
      PREVIEW_Y + 0.5,
      PREVIEW_SIZE - 1,
      PREVIEW_SIZE - 1,
    );
    const shape = next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let col = 0; col < shape[r].length; col++)
        drawBlock(PANEL_X, PREVIEW_Y, offX + col, offY + r, shape[r][col]);

    // LÍNEAS
    c.font = "bold 14px monospace";
    c.fillStyle = LABEL;
    c.fillText("LÍNEAS", PANEL_X, 240);
    c.font = "bold 32px monospace";
    c.fillStyle = TEXT;
    c.fillText(String(lines), PANEL_X, 282);
  }

  function draw() {
    if (bgCanvas) c.drawImage(bgCanvas, 0, 0);
    else paintStatic(c);

    for (let r = 0; r < ROWS; r++)
      for (let col = 0; col < COLS; col++)
        drawBlock(BOARD_X, 0, col, r, board[r][col]);

    // Tras el game over se ve el tablero con la última pieza fijada, sin la pieza
    // nueva (que ya colisiona al aparecer).
    if (!ended) {
      const gy = ghostY();
      for (let r = 0; r < current.shape.length; r++)
        for (let col = 0; col < current.shape[r].length; col++)
          if (current.shape[r][col])
            drawBlock(
              BOARD_X,
              0,
              current.x + col,
              gy + r,
              current.shape[r][col],
              0.2,
            );
      for (let r = 0; r < current.shape.length; r++)
        for (let col = 0; col < current.shape[r].length; col++)
          drawBlock(
            BOARD_X,
            0,
            current.x + col,
            current.y + r,
            current.shape[r][col],
          );
    }

    c.strokeStyle = BORDER;
    c.lineWidth = 1;
    c.strokeRect(BOARD_X - 0.5, -0.5, COLS * BLOCK + 1, ROWS * BLOCK + 1);

    drawPanel();
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

  init();
  raf = requestAnimationFrame(loop);

  return {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
      lastTime = null;
    },
    restart() {
      paused = false;
      lastTime = null;
      init();
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
