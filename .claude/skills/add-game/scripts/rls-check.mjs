// Comprueba las políticas RLS de Supabase con la clave publishable de .env.local.
// Uso, desde la raíz del proyecto:
//   node .claude/skills/add-game/scripts/rls-check.mjs <game_id>
//
// Deja UNA fila de prueba (player_name = 'RLSTEST') en `scores`: bórrala después con
//   delete from public.scores where player_name = 'RLSTEST';
// (la clave publishable no puede borrarla, por diseño; usa el MCP execute_sql).
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const gameId = process.argv[2];
if (!gameId) {
  console.error("Uso: node rls-check.mjs <game_id>");
  process.exit(2);
}

const envFile = path.join(process.cwd(), ".env.local");
if (!fs.existsSync(envFile)) {
  console.error("No se encuentra .env.local en el directorio actual.");
  process.exit(2);
}
const env = Object.fromEntries(
  fs
    .readFileSync(envFile, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")),
      l.slice(l.indexOf("=") + 1).trim(),
    ]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error(
    "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
  );
  process.exit(2);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function call(method, route, body) {
  const res = await fetch(`${url}/rest/v1${route}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

let failures = 0;
function check(name, ok, detail = "") {
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`,
  );
}
const rows = (r) => (Array.isArray(r.json) ? r.json : []);
const rejected = (r) => r.status >= 400 && r.status < 500;

const validScore = {
  game_id: gameId,
  player_name: "RLSTEST",
  score: 10,
  user_id: null,
};

// 1. El juego existe y es legible.
const game = await call(
  "GET",
  `/games?id=eq.${encodeURIComponent(gameId)}&select=id,title`,
);
check(
  "SELECT games: la fila del juego existe",
  rows(game).length === 1,
  JSON.stringify(rows(game)[0] ?? game.json),
);
const title = rows(game)[0]?.title;

// 2. INSERT válido.
const ok = await call("POST", "/scores", validScore);
const rowId = rows(ok)[0]?.id;
check(
  "INSERT scores válido",
  ok.status === 201 && !!rowId,
  `HTTP ${ok.status}`,
);

// 3. INSERT inválidos: deben rechazarse.
const invalid = {
  "puntuación negativa": { score: -1 },
  "nombre vacío": { player_name: "" },
  "nombre de 11 caracteres": { player_name: "ABCDEFGHIJK" },
  "game_id inexistente": { game_id: "no-existe-rlstest" },
  "user_id no nulo": { user_id: "11111111-1111-1111-1111-111111111111" },
};
for (const [name, patch] of Object.entries(invalid)) {
  const r = await call("POST", "/scores", { ...validScore, ...patch });
  check(
    `INSERT scores rechazado (${name})`,
    rejected(r),
    `HTTP ${r.status} ${r.json?.code ?? ""}`,
  );
}

// 4. UPDATE y DELETE sobre scores: no deben afectar a ninguna fila.
if (rowId) {
  const up = await call("PATCH", `/scores?id=eq.${rowId}`, { score: 99999 });
  check(
    "UPDATE scores no modifica filas",
    rejected(up) || rows(up).length === 0,
    `HTTP ${up.status}`,
  );
  const del = await call("DELETE", `/scores?id=eq.${rowId}`);
  check(
    "DELETE scores no borra filas",
    rejected(del) || rows(del).length === 0,
    `HTTP ${del.status}`,
  );
  const after = await call("GET", `/scores?id=eq.${rowId}&select=score`);
  check(
    "la fila de prueba sigue intacta",
    rows(after)[0]?.score === 10,
    JSON.stringify(rows(after)),
  );
}

// 5. games es de solo lectura.
const ug = await call("PATCH", `/games?id=eq.${encodeURIComponent(gameId)}`, {
  title: "HACKEADO",
});
check(
  "UPDATE games no modifica filas",
  rejected(ug) || rows(ug).length === 0,
  `HTTP ${ug.status}`,
);
const dg = await call("DELETE", `/games?id=eq.${encodeURIComponent(gameId)}`);
check(
  "DELETE games no borra filas",
  rejected(dg) || rows(dg).length === 0,
  `HTTP ${dg.status}`,
);
const ig = await call("POST", "/games", {
  id: "rlstest",
  title: "X",
  short: "x",
  long: "x",
  cat: "ARCADE",
  cover: "c",
  color: "cyan",
});
check(
  "INSERT games rechazado",
  rejected(ig),
  `HTTP ${ig.status} ${ig.json?.code ?? ""}`,
);
const gameAfter = await call(
  "GET",
  `/games?id=eq.${encodeURIComponent(gameId)}&select=title`,
);
check(
  "la ficha del juego sigue intacta",
  rows(gameAfter)[0]?.title === title,
  JSON.stringify(rows(gameAfter)),
);

console.log(
  failures === 0
    ? "\nTodas las comprobaciones pasan."
    : `\n${failures} comprobación(es) fallida(s).`,
);
console.log(
  "Limpieza pendiente: delete from public.scores where player_name = 'RLSTEST';",
);
process.exit(failures === 0 ? 0 : 1);
