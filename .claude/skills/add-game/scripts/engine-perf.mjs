// Banco de pruebas de rendimiento de un motor de juego (sin navegador).
// Uso, desde la raíz del proyecto:
//   node --expose-gc .claude/skills/add-game/scripts/engine-perf.mjs <ruta/engine.ts> <createX>
//        [--frames 3000] [--opts '{"skin":"neon","modo":"oscuro"}'] [--trace]
//   p. ej.: ... app/games/ranaria/engine.ts createRanaria --trace
//
// Compila el motor con el `tsc` del proyecto (como engine-smoke.mjs), lo ejecuta con un
// canvas que cuenta llamadas, `Math.random` con semilla y una secuencia de teclas fija, y
// mide: bucles de requestAnimationFrame por fotograma, llamadas al contexto, glow
// (shadowBlur), fuentes, equilibrio save/restore, tiempo por fotograma, heap y fugas tras
// restart()/destroy(). Con --trace imprime la secuencia de eventos y su hash: debe ser
// idéntica antes y después de optimizar (misma jugabilidad).
//
// Salida: tabla legible + una línea final "JSON: {...}". Los presupuestos superados salen
// como WARN; solo es FAIL (código 1) un bucle duplicado, una fuga de listeners o un frame
// sin cancelar tras destroy().
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import process from "node:process";

// ── Argumentos ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const positional = [];
const flags = { frames: 3000, opts: undefined, trace: false };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--frames") flags.frames = Number(args[++i]);
  else if (a === "--opts") flags.opts = JSON.parse(args[++i]);
  else if (a === "--trace") flags.trace = true;
  else positional.push(a);
}
const [enginePath, fnName] = positional;
if (!enginePath || !fnName || !Number.isFinite(flags.frames)) {
  console.error(
    "Uso: node --expose-gc engine-perf.mjs <ruta/engine.ts> <createX> [--frames N] [--opts JSON] [--trace]",
  );
  process.exit(2);
}

// Presupuestos (ver .claude/agents/game-performance-booster.md).
const BUDGET = {
  fontSetsPerFrame: 3,
  heapGrowthPer1000FramesMB: 1,
  restartHeapDeltaMB: 2,
};

// ── Compilación (igual que engine-smoke.mjs) ────────────────────────────────
const root = process.cwd();
const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "engine-perf-"));
fs.writeFileSync(path.join(outDir, "package.json"), '{"type":"commonjs"}');
const compile = spawnSync(
  process.execPath,
  [
    tsc,
    path.resolve(root, enginePath),
    "--outDir",
    outDir,
    "--rootDir",
    root,
    "--module",
    "commonjs",
    "--moduleResolution",
    "node",
    "--target",
    "ES2020",
    "--lib",
    "dom,es2020",
    "--strict",
    "--skipLibCheck",
  ],
  { cwd: root, encoding: "utf8" },
);
if (compile.status !== 0) {
  console.error(`tsc falló:\n${compile.stdout}${compile.stderr}`);
  process.exit(1);
}

// ── Entorno simulado ────────────────────────────────────────────────────────
const listeners = { keydown: [], keyup: [] };
globalThis.window = {
  addEventListener: (t, f) => (listeners[t] ??= []).push(f),
  removeEventListener: (t, f) => {
    if (listeners[t]) listeners[t] = listeners[t].filter((x) => x !== f);
  },
  devicePixelRatio: 1,
};
globalThis.HTMLElement = class {};

// requestAnimationFrame con cola, como el navegador: si el motor arranca dos bucles,
// los dos se ejecutan en el mismo fotograma y se detecta.
let pending = [];
let rafId = 0;
globalThis.requestAnimationFrame = (f) => {
  pending.push({ id: ++rafId, f });
  return rafId;
};
globalThis.cancelAnimationFrame = (id) => {
  pending = pending.filter((p) => p.id !== id);
};
globalThis.Audio = class {
  play() {
    return Promise.resolve();
  }
  pause() {}
  cloneNode() {
    return new globalThis.Audio();
  }
};
globalThis.Image = class {
  constructor() {
    this.width = 64;
    this.height = 64;
    this.complete = false;
  }
  set src(_v) {
    setTimeout(() => {
      this.complete = true;
      this.onload?.();
    }, 0);
  }
};
// `document` no se define a propósito (como en engine-smoke.mjs).

// Math.random con semilla (LCG): la misma secuencia en cada ejecución.
let seed = 123456789;
Math.random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};

// ── Contexto 2D que cuenta ──────────────────────────────────────────────────
const stats = {
  calls: 0,
  byMethod: {},
  shadowBlurOn: 0,
  fontSets: 0,
  measureText: 0,
  getImageData: 0,
  depth: 0,
  offscreenCalls: 0,
};
const resetStats = () => {
  stats.calls = 0;
  stats.byMethod = {};
  stats.shadowBlurOn = 0;
  stats.fontSets = 0;
  stats.measureText = 0;
  stats.getImageData = 0;
  stats.depth = 0;
  stats.offscreenCalls = 0;
};
const gradient = () => ({ addColorStop() {} });
const RETURNS = {
  measureText: (text) => ({
    width: String(text ?? "").length * 8,
    actualBoundingBoxAscent: 8,
    actualBoundingBoxDescent: 2,
  }),
  createLinearGradient: gradient,
  createRadialGradient: gradient,
  createConicGradient: gradient,
  createPattern: () => ({}),
  getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
  createImageData: () => ({
    data: new Uint8ClampedArray(4),
    width: 1,
    height: 1,
  }),
  isPointInPath: () => false,
  isPointInStroke: () => false,
  getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  getLineDash: () => [],
};

function makeCtx(canvasObj, offscreen) {
  const props = { canvas: canvasObj, globalAlpha: 1, shadowBlur: 0 };
  return new Proxy(props, {
    get(target, prop) {
      if (prop in target && typeof target[prop] !== "function")
        return target[prop];
      return (...a) => {
        if (offscreen) {
          stats.offscreenCalls++;
        } else {
          stats.calls++;
          stats.byMethod[prop] = (stats.byMethod[prop] ?? 0) + 1;
          if (prop === "save") stats.depth++;
          if (prop === "restore") stats.depth--;
          if (prop === "measureText") stats.measureText++;
          if (prop === "getImageData") stats.getImageData++;
        }
        const r = RETURNS[prop];
        return r ? r(...a) : undefined;
      };
    },
    set(target, prop, value) {
      target[prop] = value;
      if (!offscreen) {
        if (prop === "shadowBlur" && value !== 0) stats.shadowBlurOn++;
        if (prop === "font") stats.fontSets++;
      }
      return true;
    },
  });
}
const canvas = { width: 800, height: 600 };
canvas.getContext = () => makeCtx(canvas, false);
// Lienzos fuera de pantalla (cachés de fondo): se cuentan aparte, porque se dibujan una
// vez y no en cada fotograma.
globalThis.OffscreenCanvas = class {
  constructor(w, h) {
    this.width = w;
    this.height = h;
  }
  getContext() {
    return makeCtx(this, true);
  }
};

// ── Carga del motor ─────────────────────────────────────────────────────────
const relative = path
  .relative(root, path.resolve(root, enginePath))
  .replace(/\.ts$/, ".js");
const require = createRequire(import.meta.url);
const mod = require(path.join(outDir, relative));
if (typeof mod[fnName] !== "function") {
  console.error(
    `El módulo no exporta una función llamada ${fnName}. Exporta: ${Object.keys(mod)}`,
  );
  process.exit(1);
}

const trace = [];
let gameOvers = 0;
const events = {
  onScoreChange: (v) => trace.push(["score", v]),
  onLivesChange: (v) => trace.push(["lives", v]),
  onLevelChange: (v) => trace.push(["level", v]),
  onGameOver: (v) => {
    trace.push(["gameover", v]);
    gameOvers++;
  },
};

let failures = 0;
const results = {};
const report = (level, name, detail = "") => {
  if (level === "FAIL") failures++;
  console.log(`${level.padEnd(5)} ${name}${detail ? ` — ${detail}` : ""}`);
};
const MB = (b) => b / 1024 / 1024;
const heap = () => {
  if (globalThis.gc) {
    globalThis.gc();
    globalThis.gc();
  }
  return process.memoryUsage().heapUsed;
};

// Fotograma: ejecuta todos los callbacks pendientes, como el navegador.
let t = 0;
let maxLoops = 0;
function frame() {
  t += 16;
  const cbs = pending;
  pending = [];
  maxLoops = Math.max(maxLoops, cbs.length);
  for (const { f } of cbs) f(t);
  return cbs.length;
}

// Entrada fija: cada 8 fotogramas pulsa una tecla y la suelta 2 fotogramas después.
const CODES = [
  "ArrowUp",
  "ArrowLeft",
  "ArrowUp",
  "ArrowRight",
  "Space",
  "ArrowDown",
];
const ev = (code) => ({
  code,
  key: code,
  target: null,
  repeat: false,
  preventDefault() {},
});
const fire = (type, code) => listeners[type]?.forEach((f) => f(ev(code)));
function input(i) {
  if (i % 8 === 0) fire("keydown", CODES[(i / 8) % CODES.length]);
  if (i % 8 === 2) fire("keyup", CODES[((i - 2) / 8) % CODES.length]);
}

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] ?? 0;
};
const avg = (arr) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

// ── Ejecución ───────────────────────────────────────────────────────────────
async function main() {
  if (!globalThis.gc)
    report("WARN", "sin --expose-gc: las cifras de heap no son fiables");

  let engine;
  try {
    engine = flags.opts
      ? mod[fnName](canvas, events, flags.opts)
      : mod[fnName](canvas, events);
  } catch (e) {
    report(
      "FAIL",
      "crear el motor (¿usa document u otra API del navegador?)",
      String(e),
    );
    process.exit(1);
  }
  await new Promise((r) => setTimeout(r, 20)); // deja cargar las imágenes simuladas

  // Calentamiento (JIT) y heap base.
  for (let i = 0; i < 200; i++) {
    input(i);
    frame();
  }
  const heapSamples = [heap()];

  // Partida con entrada fija. Si acaba, se reinicia (determinista) para seguir midiendo juego.
  const ms = [];
  const calls = [];
  const blur = [];
  const fonts = [];
  const measures = [];
  let unbalanced = 0;
  let imageReads = 0;
  let offscreen = 0;
  let restartsInPlay = 0;
  let overSeen = gameOvers;
  for (let i = 0; i < flags.frames; i++) {
    input(i);
    resetStats();
    const t0 = performance.now();
    frame();
    ms.push(performance.now() - t0);
    calls.push(stats.calls);
    blur.push(stats.shadowBlurOn);
    fonts.push(stats.fontSets);
    measures.push(stats.measureText);
    offscreen += stats.offscreenCalls;
    imageReads += stats.getImageData;
    if (stats.depth !== 0) unbalanced++;
    if (gameOvers > overSeen) {
      overSeen = gameOvers;
      engine.restart();
      restartsInPlay++;
    }
    if ((i + 1) % 1000 === 0) heapSamples.push(heap());
  }

  const growthPer1000 =
    heapSamples.length > 1
      ? MB(heapSamples.at(-1) - heapSamples[0]) / (heapSamples.length - 1)
      : 0;
  Object.assign(results, {
    frames: flags.frames,
    opts: flags.opts ?? null,
    loopsPerFrameMax: maxLoops,
    msPerFrame: {
      avg: +avg(ms).toFixed(4),
      p95: +pct(ms, 95).toFixed(4),
      max: +Math.max(...ms).toFixed(4),
    },
    ctxCallsPerFrame: { avg: +avg(calls).toFixed(1), max: Math.max(...calls) },
    shadowBlurOnPerFrame: {
      avg: +avg(blur).toFixed(2),
      max: Math.max(...blur),
    },
    fontSetsPerFrame: { avg: +avg(fonts).toFixed(2), max: Math.max(...fonts) },
    measureTextPerFrame: {
      avg: +avg(measures).toFixed(2),
      max: Math.max(...measures),
    },
    unbalancedSaveRestoreFrames: unbalanced,
    getImageDataCalls: imageReads,
    offscreenCalls: offscreen,
    gameOversInPlay: restartsInPlay,
    heapGrowthPer1000FramesMB: +growthPer1000.toFixed(3),
  });

  // Ranking de métodos del último fotograma medido (pistas de dónde se va el coste).
  resetStats();
  frame();
  results.topMethodsLastFrame = Object.entries(stats.byMethod)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // 50 reinicios: listeners y heap.
  const beforeRestarts = heap();
  for (let r = 0; r < 50; r++) {
    engine.restart();
    for (let i = 0; i < 20; i++) {
      input(i);
      frame();
    }
  }
  const restartDelta = MB(heap() - beforeRestarts);
  results.afterRestarts = {
    keydown: listeners.keydown.length,
    keyup: listeners.keyup.length,
    loopsPerFrame: frame(),
    heapDeltaMB: +restartDelta.toFixed(3),
  };

  engine.destroy();
  results.afterDestroy = {
    keydown: listeners.keydown.length,
    keyup: listeners.keyup.length,
    pendingFrames: pending.length,
  };

  // ── Informe ───────────────────────────────────────────────────────────────
  const r = results;
  console.log(
    `\nMotor: ${enginePath} (${fnName})  opciones: ${JSON.stringify(r.opts)}  fotogramas: ${r.frames}\n`,
  );
  report(
    r.loopsPerFrameMax === 1 ? "PASS" : "FAIL",
    "un solo bucle de requestAnimationFrame por fotograma",
    `máx ${r.loopsPerFrameMax}`,
  );
  report(
    "INFO",
    "tiempo por fotograma (orientativo: el contexto simulado añade coste)",
    `media ${r.msPerFrame.avg} ms · p95 ${r.msPerFrame.p95} ms · máx ${r.msPerFrame.max} ms`,
  );
  report(
    "INFO",
    "llamadas al contexto por fotograma",
    `media ${r.ctxCallsPerFrame.avg} · máx ${r.ctxCallsPerFrame.max}`,
  );
  report(
    "INFO",
    "shadowBlur ≠ 0 asignado por fotograma (glow)",
    `media ${r.shadowBlurOnPerFrame.avg} · máx ${r.shadowBlurOnPerFrame.max}`,
  );
  report(
    r.fontSetsPerFrame.max <= BUDGET.fontSetsPerFrame ? "PASS" : "WARN",
    `font asignada ≤ ${BUDGET.fontSetsPerFrame} veces por fotograma`,
    `media ${r.fontSetsPerFrame.avg} · máx ${r.fontSetsPerFrame.max}`,
  );
  report(
    "INFO",
    "measureText por fotograma",
    `media ${r.measureTextPerFrame.avg} · máx ${r.measureTextPerFrame.max}`,
  );
  report(
    r.unbalancedSaveRestoreFrames === 0 ? "PASS" : "WARN",
    "save/restore equilibrados en cada fotograma",
    `fotogramas desequilibrados: ${r.unbalancedSaveRestoreFrames}`,
  );
  report(
    r.getImageDataCalls === 0 ? "PASS" : "WARN",
    "sin getImageData en el bucle",
    `llamadas: ${r.getImageDataCalls}`,
  );
  report(
    "INFO",
    "llamadas a lienzos fuera de pantalla (cachés)",
    String(r.offscreenCalls),
  );
  report(
    !globalThis.gc
      ? "INFO"
      : r.heapGrowthPer1000FramesMB <= BUDGET.heapGrowthPer1000FramesMB
        ? "PASS"
        : "WARN",
    `heap crece ≤ ${BUDGET.heapGrowthPer1000FramesMB} MB cada 1000 fotogramas (tras GC)`,
    `${r.heapGrowthPer1000FramesMB} MB`,
  );
  report(
    "INFO",
    "métodos más llamados en un fotograma",
    r.topMethodsLastFrame.map(([k, v]) => `${k}×${v}`).join(" "),
  );
  const ra = r.afterRestarts;
  report(
    ra.keydown <= 1 && ra.keyup <= 1 && ra.loopsPerFrame === 1
      ? "PASS"
      : "FAIL",
    "tras 50 restart(): un listener por tipo y un solo bucle",
    `keydown ${ra.keydown} · keyup ${ra.keyup} · bucles ${ra.loopsPerFrame}`,
  );
  report(
    !globalThis.gc
      ? "INFO"
      : ra.heapDeltaMB <= BUDGET.restartHeapDeltaMB
        ? "PASS"
        : "WARN",
    `heap estable tras 50 restart() (≤ ${BUDGET.restartHeapDeltaMB} MB)`,
    `${ra.heapDeltaMB} MB`,
  );
  const rd = r.afterDestroy;
  report(
    rd.keydown === 0 && rd.keyup === 0 ? "PASS" : "FAIL",
    "destroy() quita los listeners",
    `keydown ${rd.keydown} · keyup ${rd.keyup}`,
  );
  report(
    rd.pendingFrames === 0 ? "PASS" : "FAIL",
    "destroy() cancela el frame pendiente",
    `pendientes ${rd.pendingFrames}`,
  );

  if (flags.trace) {
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify(trace))
      .digest("hex");
    results.trace = { events: trace.length, sha256: hash };
    console.log(`\nTRAZA ${trace.length} eventos · sha256 ${hash}`);
    console.log(`TRAZA primeros: ${JSON.stringify(trace.slice(0, 12))}`);
  }

  console.log(
    failures === 0
      ? "\nSin fallos (revisa los WARN)."
      : `\n${failures} fallo(s).`,
  );
  console.log(`JSON: ${JSON.stringify(results)}`);
  fs.rmSync(outDir, { recursive: true, force: true });
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  report("FAIL", "ejecución sin errores", String(e?.stack ?? e));
  fs.rmSync(outDir, { recursive: true, force: true });
  process.exit(1);
});
