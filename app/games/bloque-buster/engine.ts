// Motor de BLOQUE BUSTER (Arkanoid). Portado de references/started-games/04-arkanoid/game.js.
// Sin React ni DOM: recibe un canvas y notifica los cambios con callbacks.
// Cambios respecto al original: el HUD, la pausa y el fin de partida los pone la
// plataforma, sin ratón, sin tecla P ni Esc y sin el selector de nivel de la pausa.
// Limpiar el nivel 5 también termina la partida (onGameOver).
import type { GameEngine, GameEvents } from "../types";
import { LEVELS, type ColorBloque } from "./levels";
import {
  BOUNCE_SOUND_URL,
  BREAK_SOUND_URL,
  EXPLOSION_DURATION,
  EXPLOSION_FRAMES,
  SPRITESHEET_URL,
  SPRITES,
  drawFrame,
} from "./sprites";

// Tamaño lógico del canvas (4:3). Debe coincidir con width/height del <canvas>.
const W = 800;
const H = 600;

const PADDLE_SPEED = 400; // px/s
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const BLOCK_SCORE = 10;
const INITIAL_LIVES = 3;
const LAST_LEVEL = LEVELS.length;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball extends Rect {
  vx: number;
  vy: number;
}

interface Block extends Rect {
  color: ColorBloque;
  alive: boolean;
}

interface Explosion extends Rect {
  color: ColorBloque;
  elapsed: number; // ms
}

export function createBloqueBuster(
  canvas: HTMLCanvasElement,
  events: GameEvents,
): GameEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { pause() {}, resume() {}, restart() {}, destroy() {} };
  const c: CanvasRenderingContext2D = ctx; // evita `ctx!` dentro de las funciones

  // ── Assets ────────────────────────────────────────────────────────────────
  // El bucle no actualiza ni dibuja sprites hasta que la imagen ha cargado.
  const sheet = new Image();
  let sheetReady = false;
  let destroyed = false;
  sheet.onload = () => {
    if (!destroyed) sheetReady = true;
  };
  sheet.onerror = () => console.error("Failed to load spritesheet");
  sheet.src = SPRITESHEET_URL;

  const bounceSound = new Audio(BOUNCE_SOUND_URL);
  const breakSound = new Audio(BREAK_SOUND_URL);
  // Los navegadores rechazan play() antes de un gesto del usuario: se ignora el rechazo.
  const playSound = (sound: HTMLAudioElement) => {
    void (sound.cloneNode() as HTMLAudioElement).play().catch(() => {});
  };

  // ── Entrada ───────────────────────────────────────────────────────────────
  let left = false;
  let right = false;

  // Los campos de texto (el nombre del modal) no deben mover el juego.
  const isTextField = (t: EventTarget | null) =>
    t instanceof HTMLElement &&
    (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

  const onKeyDown = (e: KeyboardEvent) => {
    if (paused || isTextField(e.target)) return;
    if (e.code === "ArrowLeft") left = true;
    if (e.code === "ArrowRight") right = true;
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "ArrowLeft") left = false;
    if (e.code === "ArrowRight") right = false;
  };
  const clearInput = () => {
    left = false;
    right = false;
  };

  // ── Estado ────────────────────────────────────────────────────────────────
  const paddle: Rect = { x: 0, y: 560, w: 81, h: 14 };
  const ball: Ball = { x: 0, y: 0, w: 16, h: 16, vx: 0, vy: 0 };
  let blocks: Block[] = [];
  let explosions: Explosion[] = [];
  let score = 0;
  let lives = INITIAL_LIVES;
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

  function initBall() {
    const speed = LEVELS[level - 1].speed;
    ball.x = paddle.x + (paddle.w - ball.w) / 2;
    ball.y = paddle.y - ball.h;
    ball.vx = BASE_BALL_VX * speed;
    ball.vy = BASE_BALL_VY * speed;
  }

  function loadLevel(n: number) {
    level = n;
    blocks = LEVELS[n - 1].blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    explosions = [];
    initBall();
  }

  function init() {
    score = 0;
    lives = INITIAL_LIVES;
    ended = false;
    gameOverPending = false;
    sentScore = sentLives = sentLevel = null;
    paddle.x = (W - paddle.w) / 2;
    loadLevel(1);
    emitChanges();
  }

  function endGame() {
    ended = true;
    gameOverPending = true;
  }

  // ── Lógica ────────────────────────────────────────────────────────────────
  const collides = (b: Block) =>
    ball.x < b.x + b.w &&
    ball.x + ball.w > b.x &&
    ball.y < b.y + b.h &&
    ball.y + ball.h > b.y;

  function update(dt: number) {
    if (ended) return;

    // Paleta
    if (left) paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (right) paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    // Pelota
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Rebotes en paredes y techo
    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
      playSound(bounceSound);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
      playSound(bounceSound);
    }

    // Rebote en la paleta
    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      playSound(bounceSound);
    }

    // Colisión con bloques: como mucho uno por fotograma
    for (const block of blocks) {
      if (!block.alive || !collides(block)) continue;
      block.alive = false;
      explosions.push({
        x: block.x,
        y: block.y,
        w: block.w,
        h: block.h,
        color: block.color,
        elapsed: 0,
      });
      score += BLOCK_SCORE;
      ball.vy = -ball.vy;
      playSound(breakSound);
      if (blocks.every((b) => !b.alive)) {
        if (level < LAST_LEVEL) loadLevel(level + 1);
        else endGame(); // victoria: también termina la partida
      }
      break;
    }

    // Explosiones
    // Compactación en sitio (sin crear un array nuevo por fotograma).
    let n = 0;
    for (const exp of explosions) {
      exp.elapsed += dt * 1000;
      if (exp.elapsed < EXPLOSION_DURATION) explosions[n++] = exp;
    }
    explosions.length = n;

    // Pelota perdida
    if (!ended && ball.y > H) {
      lives--;
      if (lives <= 0) {
        lives = 0;
        endGame();
      } else {
        initBall();
      }
    }
  }

  // ── Dibujo ────────────────────────────────────────────────────────────────
  // Sin HUD, pausa ni "GAME OVER": los pone la plataforma.
  function draw() {
    c.fillStyle = "#000";
    c.fillRect(0, 0, W, H);
    if (!sheetReady) return;

    for (const b of blocks) {
      if (b.alive)
        drawFrame(c, sheet, SPRITES.blocks[b.color], b.x, b.y, b.w, b.h);
    }

    for (const exp of explosions) {
      const i = Math.min(Math.floor((exp.elapsed / EXPLOSION_DURATION) * 4), 3);
      drawFrame(
        c,
        sheet,
        EXPLOSION_FRAMES[exp.color][i],
        exp.x,
        exp.y,
        exp.w,
        exp.h,
      );
    }

    drawFrame(c, sheet, SPRITES.paddle, paddle.x, paddle.y, paddle.w, paddle.h);
    drawFrame(c, sheet, SPRITES.ball, ball.x, ball.y, ball.w, ball.h);
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
      destroyed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
