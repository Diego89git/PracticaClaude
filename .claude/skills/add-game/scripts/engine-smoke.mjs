// Prueba de humo de un motor de juego (sin navegador).
// Uso, desde la raíz del proyecto:
//   node .claude/skills/add-game/scripts/engine-smoke.mjs <ruta/engine.ts> <nombreDeLaFuncion>
//   p. ej.: ... app/games/asteroides/engine.ts createAsteroides
//
// Compila el motor con el `tsc` del proyecto, lo ejecuta con un canvas y un `window`
// simulados y comprueba lo que la plataforma espera: notificaciones iniciales, que no
// toque `document`, pausa, reinicio, `onGameOver` como mucho una vez y limpieza.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const [enginePath, fnName] = process.argv.slice(2);
if (!enginePath || !fnName) {
  console.error(
    "Uso: node engine-smoke.mjs <ruta/engine.ts> <nombreDeLaFuncion>",
  );
  process.exit(2);
}
const root = process.cwd();
const tsc = path.join(root, "node_modules", "typescript", "bin", "tsc");
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "engine-smoke-"));
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
  addEventListener: (t, f) => listeners[t]?.push(f),
  removeEventListener: (t, f) => {
    if (listeners[t]) listeners[t] = listeners[t].filter((x) => x !== f);
  },
};
globalThis.HTMLElement = class {};
let frameCallback = null;
globalThis.requestAnimationFrame = (f) => {
  frameCallback = f;
  return 1;
};
globalThis.cancelAnimationFrame = () => {
  frameCallback = null;
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
  set src(_v) {
    setTimeout(() => this.onload?.(), 0);
  }
};
// `document` no se define a propósito: si el motor lo usa, el ReferenceError lo delata.

const makeCtx = () =>
  new Proxy(function () {}, {
    get: (_t, prop) =>
      prop === "measureText" ? () => ({ width: 0 }) : () => makeCtx(),
    set: () => true,
    apply: () => makeCtx(),
  });
const canvas = { width: 800, height: 600, getContext: () => makeCtx() };

// ── Ejecución ───────────────────────────────────────────────────────────────
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

const log = [];
const events = {
  onScoreChange: (v) => log.push(["score", v]),
  onLivesChange: (v) => log.push(["lives", v]),
  onLevelChange: (v) => log.push(["level", v]),
  onGameOver: (v) => log.push(["gameover", v]),
};

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`,
  );
};
let t = 0;
const step = (n) => {
  for (let i = 0; i < n; i++) {
    t += 16;
    const f = frameCallback;
    if (f) f(t);
  }
};
const fire = (type, code) =>
  listeners[type].forEach((f) => f({ code, target: null }));

let engine;
try {
  engine = mod[fnName](canvas, events);
} catch (e) {
  check(
    "crear el motor sin errores (¿usa document u otra API del navegador?)",
    false,
    String(e),
  );
  process.exit(1);
}
check("crear el motor sin errores", true);
check(
  "notifica el estado inicial (puntuación, vidas y nivel)",
  ["score", "lives", "level"].every((k) => log.some((e) => e[0] === k)),
  JSON.stringify(log),
);
check(
  "registra un solo keydown y, como mucho, un keyup (hay juegos que solo usan keydown)",
  listeners.keydown.length === 1 && listeners.keyup.length <= 1,
);

try {
  // Juego activo: entrada aleatoria durante ~15 s simulados.
  const codes = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"];
  for (let i = 0; i < 900; i++) {
    const code = codes[i % codes.length];
    fire("keydown", code);
    step(1);
    fire("keyup", code);
  }
  check("900 fotogramas con entrada sin lanzar errores", true);

  // Pausa: no debe notificar nada mientras está pausado.
  engine.pause();
  const before = log.length;
  step(300);
  check("en pausa no notifica cambios", log.length === before);
  engine.resume();

  // Sin jugar durante ~100 s simulados: ¿termina la partida?
  step(6000);
  const overs = log.filter((e) => e[0] === "gameover");
  check(
    "onGameOver se dispara como mucho una vez",
    overs.length <= 1,
    `veces: ${overs.length}`,
  );
  console.log(
    `INFO  onGameOver ${overs.length ? `disparado (puntuación ${overs[0][1]})` : "no disparado sin jugar"} tras ~100 s quieto`,
  );

  // Reinicio.
  const n = log.length;
  engine.restart();
  step(2);
  console.log(
    `INFO  restart() emitió ${log.length - n} notificación(es): ${JSON.stringify(log.slice(n))}`,
  );

  // Limpieza.
  engine.destroy();
  check(
    "destroy() quita los listeners",
    listeners.keydown.length === 0 && listeners.keyup.length === 0,
  );
  check("destroy() cancela el frame pendiente", frameCallback === null);
} catch (e) {
  check("ejecución sin errores", false, String(e));
}

fs.rmSync(outDir, { recursive: true, force: true });
console.log(
  failures === 0
    ? "\nTodas las comprobaciones pasan."
    : `\n${failures} comprobación(es) fallida(s).`,
);
process.exit(failures === 0 ? 0 : 1);
