// Motor de FROGGER (id `ranaria`). Juego creado desde cero (SPEC game-jam/frogger/01):
// todo se dibuja con primitivas de canvas, sin imágenes. Sin React ni DOM global: recibe
// un canvas y notifica los cambios con callbacks. La pausa, el modal de fin y el guardado
// los pone la plataforma; el HUD interno (doble HUD) lo pide la spec.
import type { GameEngine, GameEvents } from "../types";
import type { Modo, SkinId } from "../skins";
import { SKIN_DEFAULT } from "../skins";
import { SKINS_RANARIA } from "./skins";

// ── Paso 2: constantes y tipos ──────────────────────────────────────────────
const COLS = 16;
const ROWS = 14;
const CELL = 40; // px
export const CANVAS_W = COLS * CELL; // 640 — se escala con CSS al contenedor
export const CANVAS_H = ROWS * CELL; // 560
// Zonas (índice de fila, 0 = arriba)
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_SAFE_MID = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;

const START_LIVES = 3;
const HOP_MS = 120; // animación de salto
const FRAME_MS = 16; // las velocidades están en px por fotograma de 16 ms
const LEVEL_SPEEDUP = 1.15; // +15 % por nivel
const BASE_TIME_S = 15; // temporizador de ronda en el nivel 1
const TIME_STEP_S = 1; // segundos que se quitan por nivel
const MIN_TIME_S = 8;
const TURTLE_UP_MS = 3000; // tortugas visibles
const TURTLE_DOWN_MS = 1500; // tortugas bajo el agua
const TURTLE_CYCLE_MS = TURTLE_UP_MS + TURTLE_DOWN_MS;

// Puntuación
const PTS_ROW = 10; // por cada fila nueva hacia arriba en el trayecto
const PTS_GOAL = 50; // al ocupar una boca
const PTS_ROUND = 200; // al completar las 5 bocas
const PTS_TIME = 10; // por segundo restante al ocupar una boca

// 5 bocas de 2 columnas: columnas 1-2, 4-5, 7-8, 10-11 y 13-14.
const GOAL_COLS = [1, 4, 7, 10, 13];
const GOAL_W = 2;

type Direction = "up" | "down" | "left" | "right";
interface Lane {
  row: number;
  speed: number; // px por fotograma (16 ms), ya escalada por nivel
  dir: 1 | -1;
  span: number; // longitud del bucle en celdas: al salir, la entidad reentra por el otro lado
  entities: Entity[];
}
interface Entity {
  col: number; // borde izquierdo, en celdas (con decimales)
  width: number; // en celdas
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
  diveT?: number; // ms dentro del ciclo de inmersión (solo tortugas)
  tint?: number; // variante de color (solo coches)
}
interface Frog {
  col: number; // con decimales cuando viaja sobre un tronco o tortugas
  row: number;
  animating: boolean;
  animT: number;
  targetCol: number;
  targetRow: number;
}

const KEY_DIR: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const SCALES: [number, number][] = [
  [0, 0],
  [-7, -6],
  [7, -6],
  [-7, 6],
  [7, 6],
];
const LEGS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

const isRiver = (row: number) => row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;
const isRoad = (row: number) => row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
const roundTimeFor = (level: number) =>
  Math.max(MIN_TIME_S, BASE_TIME_S - (level - 1) * TIME_STEP_S);

// ── Paso 3: mapa de carriles ────────────────────────────────────────────────
// Cada carril: fila, velocidad base (px/fotograma), sentido, longitud del bucle y
// entidades precargadas como [columna, anchura]. Los huecos son de 1 celda o más.
interface LaneDef {
  row: number;
  speed: number;
  dir: 1 | -1;
  span: number;
  type: Entity["type"];
  items: [number, number][];
}
const LANE_DEFS: LaneDef[] = [
  // Carretera (filas 8-12): 1.5-4 px/fotograma, sentidos alternos.
  {
    row: 12,
    speed: 1.5,
    dir: -1,
    span: 20,
    type: "car",
    items: [
      [0, 1],
      [5, 1],
      [10, 1],
      [15, 1],
    ],
  },
  {
    row: 11,
    speed: 2.2,
    dir: 1,
    span: 20,
    type: "car",
    items: [
      [0, 1],
      [6, 1],
      [12, 1],
    ],
  },
  {
    row: 10,
    speed: 1.8,
    dir: -1,
    span: 22,
    type: "truck",
    items: [
      [0, 2],
      [8, 3],
      [16, 2],
    ],
  },
  {
    row: 9,
    speed: 4,
    dir: 1,
    span: 20,
    type: "car",
    items: [
      [0, 1],
      [10, 1],
    ],
  },
  {
    row: 8,
    speed: 2.5,
    dir: -1,
    span: 24,
    type: "truck",
    items: [
      [0, 3],
      [12, 3],
    ],
  },
  // Río (filas 1-6): 1-3 px/fotograma, troncos de 2-4 y tortugas en grupos de 2-3.
  {
    row: 6,
    speed: 1.5,
    dir: -1,
    span: 20,
    type: "turtle",
    items: [
      [0, 3],
      [7, 3],
      [14, 3],
    ],
  },
  {
    row: 5,
    speed: 1.2,
    dir: 1,
    span: 20,
    type: "log",
    items: [
      [0, 3],
      [7, 3],
      [14, 3],
    ],
  },
  {
    row: 4,
    speed: 2.5,
    dir: 1,
    span: 22,
    type: "log",
    items: [
      [0, 4],
      [11, 4],
    ],
  },
  {
    row: 3,
    speed: 2,
    dir: -1,
    span: 18,
    type: "turtle",
    items: [
      [0, 2],
      [6, 2],
      [12, 2],
    ],
  },
  {
    row: 2,
    speed: 1.6,
    dir: 1,
    span: 18,
    type: "log",
    items: [
      [0, 2],
      [6, 2],
      [12, 2],
    ],
  },
  {
    row: 1,
    speed: 3,
    dir: -1,
    span: 21,
    type: "log",
    items: [
      [0, 4],
      [7, 4],
      [14, 4],
    ],
  },
];

function buildLanes(level: number): Lane[] {
  const factor = Math.pow(LEVEL_SPEEDUP, level - 1);
  return LANE_DEFS.map((def) => ({
    row: def.row,
    speed: def.speed * factor,
    dir: def.dir,
    span: def.span,
    entities: def.items.map(([col, width], i) => {
      const e: Entity = { col, width, type: def.type };
      // Camión de 1-3 celdas o coche de 1 celda: el tipo lo fija el carril.
      if (def.type === "car") e.tint = (def.row + i) % 3;
      if (def.type === "turtle") {
        // Temporizador independiente por grupo: fases desfasadas.
        e.diveT = (i * TURTLE_CYCLE_MS) / def.items.length;
        e.submerged = e.diveT >= TURTLE_UP_MS;
      }
      return e;
    }),
  }));
}

// ── Paso 5: colisiones y soporte ────────────────────────────────────────────
// Zona letal de la rana en la carretera: su cuerpo, un poco menor que la celda.
const FROG_HIT_MARGIN = 0.15;

function checkRoadCollision(frog: Frog, lanes: Lane[]): boolean {
  if (!isRoad(frog.row)) return false;
  const left = frog.col + FROG_HIT_MARGIN;
  const right = frog.col + 1 - FROG_HIT_MARGIN;
  for (const lane of lanes) {
    if (lane.row !== frog.row) continue;
    for (const e of lane.entities) {
      if (right > e.col && left < e.col + e.width) return true;
    }
  }
  return false;
}

// Entidad bajo el centro de la rana en su carril de río, o null. Una tortuga
// sumergida no sirve de apoyo.
function getSupport(frog: Frog, lanes: Lane[]): Entity | null {
  if (!isRiver(frog.row)) return null;
  const center = frog.col + 0.5;
  for (const lane of lanes) {
    if (lane.row !== frog.row) continue;
    for (const e of lane.entities) {
      if (center >= e.col && center < e.col + e.width) {
        return e.type === "turtle" && e.submerged ? null : e;
      }
    }
  }
  return null;
}

// Índice de la boca que corresponde a la columna de la rana, o -1 si no es una boca.
function goalIndexAt(col: number): number {
  const center = col + 0.5;
  return GOAL_COLS.findIndex((g) => center >= g && center < g + GOAL_W);
}

export function createRanaria(
  canvas: HTMLCanvasElement,
  events: GameEvents,
  opciones: { skin?: SkinId; modo?: Modo } = {},
): GameEngine {
  const ctx = canvas.getContext("2d");
  if (!ctx)
    return { pause() {}, resume() {}, restart() {}, destroy() {}, setSkin() {} };
  const c: CanvasRenderingContext2D = ctx; // evita `ctx!` dentro de las funciones

  // Paleta activa; setSkin la cambia en caliente sin tocar el estado de la partida.
  let pal =
    SKINS_RANARIA[opciones.skin ?? SKIN_DEFAULT][opciones.modo ?? "oscuro"];
  const aplicarSkin = () => {
    c.imageSmoothingEnabled = !pal.pixel;
  };
  aplicarSkin();

  // Glow del skin neon: sombra del color del objeto. glowOff la apaga.
  const glowOn = (color: string) => {
    if (pal.glow > 0) {
      c.shadowColor = color;
      c.shadowBlur = pal.glow;
    }
  };
  const glowOff = () => {
    c.shadowBlur = 0;
  };
  // Disco de radio r; en píxel duro, un cuadrado.
  const disc = (x: number, y: number, r: number) => {
    if (pal.pixel) c.rect(Math.round(x - r), Math.round(y - r), r * 2, r * 2);
    else {
      c.moveTo(x + r, y);
      c.arc(x, y, r, 0, Math.PI * 2);
    }
  };

  // ── Estado ────────────────────────────────────────────────────────────────
  let score = 0;
  let lives = START_LIVES;
  let level = 1;
  let lanes: Lane[] = [];
  let goals: boolean[] = [];
  let frog: Frog = newFrog();
  let pendingDir: Direction | null = null;
  let bestRow = ROW_START; // fila más alta alcanzada en el trayecto actual
  let timeLeft = 0; // segundos
  let roundTime = 0;
  let ended = false; // tras el game over la lógica ya no avanza
  let gameOverPending = false;
  let paused = false;
  let raf = 0;
  let lastTime: number | null = null;

  // Último valor notificado de cada campo (null fuerza la notificación).
  let sentScore: number | null = null;
  let sentLives: number | null = null;
  let sentLevel: number | null = null;

  function newFrog(): Frog {
    const col = Math.floor(COLS / 2) - 1; // columna central (7 de 0-15)
    return {
      col,
      row: ROW_START,
      animating: false,
      animT: 0,
      targetCol: col,
      targetRow: ROW_START,
    };
  }

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

  // Nuevo trayecto: rana en la salida, temporizador lleno y filas puntuables otra vez.
  function resetFrog() {
    frog = newFrog();
    pendingDir = null;
    bestRow = ROW_START;
    timeLeft = roundTime;
  }

  function init() {
    score = 0;
    lives = START_LIVES;
    level = 1;
    ended = false;
    gameOverPending = false;
    sentScore = sentLives = sentLevel = null;
    lanes = buildLanes(level);
    goals = GOAL_COLS.map(() => false);
    roundTime = roundTimeFor(level);
    resetFrog();
    emitChanges();
  }

  // ── Paso 6: ronda completada ──────────────────────────────────────────────
  function completeRound() {
    goals = GOAL_COLS.map(() => false);
    level++; // emitChanges notifica onLevelChange(level)
    lanes = buildLanes(level);
    roundTime = roundTimeFor(level);
    resetFrog();
  }

  // ── Paso 7: muerte ────────────────────────────────────────────────────────
  function killFrog() {
    lives = Math.max(0, lives - 1); // emitChanges notifica onLivesChange(lives)
    if (lives === 0) {
      // onLivesChange(0) y luego onGameOver(score), en ese orden (emitChanges).
      ended = true;
      gameOverPending = true;
      frog.animating = false;
      return;
    }
    resetFrog();
  }

  // ── Entrada ───────────────────────────────────────────────────────────────
  // Los campos de texto (el nombre del modal) no deben mover el juego.
  const isTextField = (t: EventTarget | null) =>
    t instanceof HTMLElement &&
    (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

  // Una celda por pulsación: la auto-repetición del teclado no encadena saltos.
  const onKeyDown = (e: KeyboardEvent) => {
    const d = KEY_DIR[e.code];
    if (!d || e.repeat || paused || ended || isTextField(e.target)) return;
    pendingDir = d;
  };

  // ── Paso 4: lógica ────────────────────────────────────────────────────────
  function startHop(d: Direction) {
    let col = frog.col;
    let row = frog.row;
    if (d === "up") row--;
    else if (d === "down") row++;
    else if (d === "left") col--;
    else col++;
    // No sale por los bordes laterales ni por debajo de la salida.
    if (col < 0 || col > COLS - 1 || row > ROW_START || row < ROW_GOALS) return;
    frog.animating = true;
    frog.animT = 0;
    frog.targetCol = col;
    frog.targetRow = row;
  }

  // Lógica de la celda destino al terminar el salto.
  function landHop() {
    frog.col = frog.targetCol;
    frog.row = frog.targetRow;
    frog.animating = false;
    // Fuera del río la rana vuelve a la cuadrícula.
    if (!isRiver(frog.row) && frog.row !== ROW_GOALS)
      frog.col = Math.round(frog.col);

    if (frog.row < bestRow) {
      score += PTS_ROW * (bestRow - frog.row);
      bestRow = frog.row;
    }

    if (frog.row === ROW_GOALS) {
      checkGoal();
      return;
    }
    if (isRiver(frog.row) && !getSupport(frog, lanes)) killFrog();
    else if (checkRoadCollision(frog, lanes)) killFrog();
  }

  // Boca libre: se ocupa y suma puntos. Boca ocupada o fuera de una boca: muerte.
  function checkGoal() {
    const i = goalIndexAt(frog.col);
    if (i < 0 || goals[i]) {
      killFrog();
      return;
    }
    goals[i] = true;
    score += PTS_GOAL + Math.floor(timeLeft) * PTS_TIME;
    if (goals.every(Boolean)) {
      score += PTS_ROUND;
      completeRound();
    } else {
      resetFrog();
    }
  }

  function moveLanes(dtMs: number) {
    for (const lane of lanes) {
      const delta = (lane.speed * lane.dir * dtMs) / FRAME_MS / CELL; // celdas
      for (const e of lane.entities) {
        e.col += delta;
        // Al salir por un borde reentra por el opuesto, conservando los huecos.
        if (lane.dir === 1 && e.col >= COLS) e.col -= lane.span;
        if (lane.dir === -1 && e.col + e.width <= 0) e.col += lane.span;
        if (e.type === "turtle" && e.diveT !== undefined) {
          e.diveT = (e.diveT + dtMs) % TURTLE_CYCLE_MS;
          e.submerged = e.diveT >= TURTLE_UP_MS;
        }
      }
    }
  }

  function update(dtMs: number) {
    if (ended) return;
    moveLanes(dtMs);

    if (!frog.animating && pendingDir) {
      startHop(pendingDir);
      pendingDir = null;
    }

    if (frog.animating) {
      frog.animT += dtMs;
      if (frog.animT >= HOP_MS) {
        landHop();
        if (ended) return;
      }
    } else if (isRiver(frog.row)) {
      // La rana viaja con el tronco o las tortugas; sin apoyo (agua o tortuga
      // sumergida) o al salir por un borde, muere.
      const support = getSupport(frog, lanes);
      if (!support) {
        killFrog();
        if (ended) return;
      } else {
        const lane = lanes.find((l) => l.row === frog.row);
        if (lane) frog.col += (lane.speed * lane.dir * dtMs) / FRAME_MS / CELL;
        if (frog.col < 0 || frog.col > COLS - 1) {
          killFrog();
          if (ended) return;
        }
      }
    }

    // Un vehículo puede alcanzar a la rana parada en su carril.
    if (!frog.animating && checkRoadCollision(frog, lanes)) {
      killFrog();
      if (ended) return;
    }

    timeLeft -= dtMs / 1000;
    if (timeLeft <= 0) killFrog();
  }

  // ── Dibujo ────────────────────────────────────────────────────────────────
  function paintStatic(g: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D) {
    // Bocas destino (fila 0): orilla verde clara con huecos verde oscuro y borde dorado.
    g.fillStyle = pal.goalsBank;
    g.fillRect(0, ROW_GOALS * CELL, CANVAS_W, CELL);
    for (let i = 0; i < GOAL_COLS.length; i++) {
      const x = GOAL_COLS[i] * CELL;
      g.fillStyle = pal.goalSlot;
      g.fillRect(x + 2, 6, GOAL_W * CELL - 4, CELL - 6);
      g.strokeStyle = pal.goalBorder;
      g.lineWidth = 2;
      g.strokeRect(x + 3, 7, GOAL_W * CELL - 6, CELL - 8);
    }

    // Río (filas 1-6)
    g.fillStyle = pal.river;
    g.fillRect(
      0,
      ROW_RIVER_TOP * CELL,
      CANVAS_W,
      (ROW_RIVER_BOT - ROW_RIVER_TOP + 1) * CELL,
    );
    g.strokeStyle = pal.riverWave;
    g.lineWidth = 2;
    for (let r = ROW_RIVER_TOP; r <= ROW_RIVER_BOT; r++) {
      g.beginPath();
      for (let x = 0; x <= CANVAS_W; x += 20) {
        const y = r * CELL + CELL / 2 + (x % 40 === 0 ? -2 : 2);
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }

    // Zonas seguras (fila 7 y salida, fila 13)
    for (const r of [ROW_SAFE_MID, ROW_START]) {
      g.fillStyle = pal.safe;
      g.fillRect(0, r * CELL, CANVAS_W, CELL);
      g.fillStyle = pal.safeDot;
      for (let x = 8; x < CANVAS_W; x += 24) {
        g.fillRect(x, r * CELL + 10 + ((x / 24) % 2) * 14, 4, 4);
      }
    }

    // Carretera (filas 8-12) con líneas discontinuas entre carriles
    g.fillStyle = pal.road;
    g.fillRect(
      0,
      ROW_ROAD_TOP * CELL,
      CANVAS_W,
      (ROW_ROAD_BOT - ROW_ROAD_TOP + 1) * CELL,
    );
    g.fillStyle = pal.roadLine;
    for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
      for (let x = 0; x < CANVAS_W; x += 40)
        g.fillRect(x + 8, r * CELL - 1, 20, 2);
    }
  }

  // Fondo estático en un lienzo fuera de pantalla: se regenera solo en setSkin.
  let bg: OffscreenCanvas | null = null;
  const rebuildBackground = () => {
    if (typeof OffscreenCanvas === "undefined") return;
    bg = new OffscreenCanvas(CANVAS_W, CANVAS_H);
    const g = bg.getContext("2d");
    if (!g) {
      bg = null;
      return;
    }
    paintStatic(g);
  };
  rebuildBackground();

  function drawBackground() {
    if (bg) c.drawImage(bg, 0, 0);
    else paintStatic(c);
    // Ranas en las bocas ocupadas: recortadas a la fila 0, como si el río las tapara.
    let clipped = false;
    for (let i = 0; i < GOAL_COLS.length; i++) {
      if (!goals[i]) continue;
      if (!clipped) {
        c.save();
        c.beginPath();
        c.rect(0, 0, CANVAS_W, ROW_RIVER_TOP * CELL);
        c.clip();
        clipped = true;
      }
      drawFrogAt(GOAL_COLS[i] * CELL + CELL, CELL / 2 + 3, false, 0.85);
    }
    if (clipped) c.restore();
  }

  function drawCar(e: Entity, y: number) {
    const x = e.col * CELL;
    const w = e.width * CELL;
    c.fillStyle = pal.wheel;
    for (const wx of [x + 6, x + w - 12]) {
      c.beginPath();
      disc(wx + 3, y + 8, 5);
      disc(wx + 3, y + CELL - 8, 5);
      c.fill();
    }
    const body = pal.cars[e.tint ?? 0];
    glowOn(body);
    c.fillStyle = body;
    c.fillRect(x + 3, y + 8, w - 6, CELL - 16);
    glowOff();
    c.fillStyle = pal.windshield;
    c.fillRect(x + w / 2 - 6, y + 11, 12, CELL - 22); // parabrisas
  }

  function drawTruck(e: Entity, y: number, dir: 1 | -1) {
    const x = e.col * CELL;
    const w = e.width * CELL;
    const cabW = 16;
    c.fillStyle = pal.wheel;
    for (let wx = x + 8; wx < x + w - 4; wx += 22) {
      c.beginPath();
      disc(wx, y + 7, 4);
      disc(wx, y + CELL - 7, 4);
      c.fill();
    }
    // Remolque gris y cabina diferenciada en el frente (según el sentido).
    const cabX = dir === 1 ? x + w - cabW - 2 : x + 2;
    const trailerX = dir === 1 ? x + 2 : x + cabW + 4;
    glowOn(pal.truck);
    c.fillStyle = pal.truck;
    c.fillRect(trailerX, y + 6, w - cabW - 6, CELL - 12);
    c.fillStyle = pal.truckCab;
    c.fillRect(cabX, y + 9, cabW, CELL - 18);
    glowOff();
  }

  function drawLog(e: Entity, y: number) {
    const x = e.col * CELL;
    const w = e.width * CELL;
    c.fillStyle = pal.log;
    glowOn(pal.log);
    if (pal.pixel) c.fillRect(x + 2, y + 6, w - 4, CELL - 12);
    else {
      c.beginPath();
      c.roundRect(x + 2, y + 6, w - 4, CELL - 12, 12);
      c.fill();
    }
    glowOff();
    c.strokeStyle = pal.logLine;
    c.lineWidth = 2;
    c.beginPath();
    for (let lx = x + 14; lx < x + w - 10; lx += 18) {
      c.moveTo(lx, y + 12);
      c.lineTo(lx + 8, y + 12);
      c.moveTo(lx + 4, y + CELL - 12);
      c.lineTo(lx + 12, y + CELL - 12);
    }
    c.stroke();
  }

  function drawTurtles(e: Entity, y: number) {
    for (let i = 0; i < e.width; i++) {
      const cx = (e.col + i) * CELL + CELL / 2;
      const cy = y + CELL / 2;
      if (e.submerged) {
        // Bajo el agua: solo un contorno semitransparente.
        c.strokeStyle = pal.turtleSub;
        c.lineWidth = 2;
        if (pal.pixel) c.strokeRect(cx - 13, cy - 13, 26, 26);
        else {
          c.beginPath();
          c.arc(cx, cy, 14, 0, Math.PI * 2);
          c.stroke();
        }
        continue;
      }
      c.fillStyle = pal.turtle;
      glowOn(pal.turtle);
      c.beginPath();
      disc(cx, cy, 15);
      c.fill();
      glowOff();
      // Patrón de escamas
      c.fillStyle = pal.turtleScale;
      c.beginPath();
      for (let k = 0; k < SCALES.length; k++)
        disc(cx + SCALES[k][0], cy + SCALES[k][1], 3.5);
      c.fill();
    }
  }

  function drawLanes() {
    for (const lane of lanes) {
      const y = lane.row * CELL;
      for (const e of lane.entities) {
        // Solo las que asoman en pantalla.
        if (e.col + e.width < 0 || e.col > COLS) continue;
        if (e.type === "car") drawCar(e, y);
        else if (e.type === "truck") drawTruck(e, y, lane.dir);
        else if (e.type === "log") drawLog(e, y);
        else drawTurtles(e, y);
      }
    }
  }

  // Rana centrada en (cx, cy): cuerpo elíptico 28×24, ojos y patas (extendidas al saltar).
  function drawFrogAt(cx: number, cy: number, jumping: boolean, scale = 1) {
    c.save();
    c.translate(cx, cy);
    c.scale(scale, scale);
    const leg = jumping ? 17 : 12;
    const legs = LEGS;
    const cuerpo = () => {
      c.beginPath();
      if (pal.pixel) c.rect(-14, -12, 28, 24);
      else c.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2);
    };
    // Contorno: separa la rana de cualquier fondo (agua, asfalto, tronco).
    c.fillStyle = pal.frogEdge;
    for (const [sx, sy] of legs)
      c.fillRect(sx * leg - 5, sy * (jumping ? 12 : 8) - 5, 10, 10);
    cuerpo();
    c.lineWidth = 4;
    c.strokeStyle = pal.frogEdge;
    c.stroke();
    glowOn(pal.frog);
    c.fillStyle = pal.frogDark;
    for (const [sx, sy] of legs)
      c.fillRect(sx * leg - 3, sy * (jumping ? 12 : 8) - 3, 6, 6);
    c.fillStyle = pal.frog;
    cuerpo();
    c.fill();
    glowOff();
    for (const sx of [-1, 1]) {
      c.fillStyle = pal.eyeWhite;
      c.beginPath();
      disc(sx * 6, -8, 4.5);
      c.fill();
      c.fillStyle = pal.eyeBlack;
      c.beginPath();
      disc(sx * 6, -9, 2);
      c.fill();
    }
    c.restore();
  }

  function drawFrog() {
    if (ended) return;
    const t = frog.animating ? Math.min(frog.animT / HOP_MS, 1) : 0;
    const col = frog.col + (frog.targetCol - frog.col) * t;
    const row = frog.row + (frog.targetRow - frog.row) * t;
    const lift = frog.animating ? 1 + Math.sin(t * Math.PI) * 0.15 : 1;
    drawFrogAt(
      col * CELL + CELL / 2,
      row * CELL + CELL / 2,
      frog.animating,
      lift,
    );
  }

  // HUD interno (doble HUD de la spec): barra de tiempo en la fila 0, score arriba a
  // la izquierda, nivel arriba al centro y una rana-icono por vida arriba a la derecha.
  let hudScore = -1;
  let scoreText = "";
  let scoreW = 0;
  let hudLevel = -1;
  let levelText = "";
  let levelW = 0;
  function drawHud() {
    const ratio = roundTime > 0 ? Math.max(0, timeLeft) / roundTime : 0;
    c.fillStyle = pal.timeTrack;
    c.fillRect(0, 0, CANVAS_W, 6);
    c.fillStyle =
      ratio > 0.5 ? pal.timeOk : ratio > 0.25 ? pal.timeMid : pal.timeLow;
    c.fillRect(0, 0, CANVAS_W * ratio, 6);

    c.font = "bold 16px monospace";
    c.textBaseline = "middle";
    const y = 18;

    if (score !== hudScore) {
      hudScore = score;
      scoreText = String(score).padStart(5, "0");
      scoreW = c.measureText(scoreText).width + 10;
    }
    c.fillStyle = pal.hudBack;
    c.fillRect(2, 8, scoreW, 20);
    c.fillStyle = pal.hudText;
    c.textAlign = "left";
    c.fillText(scoreText, 7, y);

    if (level !== hudLevel) {
      hudLevel = level;
      levelText = `NIV ${level}`;
      levelW = c.measureText(levelText).width + 10;
    }
    const lw = levelW;
    c.fillStyle = pal.hudBack;
    c.fillRect(CANVAS_W / 2 - lw / 2, 8, lw, 20);
    c.fillStyle = pal.hudText;
    c.textAlign = "center";
    c.fillText(levelText, CANVAS_W / 2, y);

    if (lives > 0) {
      const iw = lives * 16 + 6;
      c.fillStyle = pal.hudBack;
      c.fillRect(CANVAS_W - iw - 2, 8, iw, 20);
      c.fillStyle = pal.lifeIcon;
      for (let i = 0; i < lives; i++) {
        c.beginPath();
        disc(CANVAS_W - 12 - i * 16, y, 6);
        c.fill();
      }
    }
  }

  function draw() {
    drawBackground();
    drawLanes();
    drawFrog();
    drawHud();
  }

  // ── Bucle ─────────────────────────────────────────────────────────────────
  function loop(ts: number) {
    // dt limitado a 50 ms: al volver a la pestaña no hay saltos enormes.
    const dtMs = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;
    if (!paused) {
      update(dtMs);
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
      pendingDir = null;
    },
    resume() {
      paused = false;
      pendingDir = null;
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
    setSkin(skin, modo) {
      pal = SKINS_RANARIA[skin][modo];
      aplicarSkin();
      rebuildBackground();
    },
  };
}
