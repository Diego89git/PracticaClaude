import {
  GAMES,
  getGame,
  type Categoria,
  type ColorJuego,
  type Juego,
  type Puntuacion,
} from "@/app/data";
import { createClient } from "./server";
import { leerTopScores } from "./scores";
import type { Tables } from "./database.types";

// Lecturas de servidor del catálogo híbrido (SPEC 06): los juegos de Supabase
// se combinan con los locales de app/data.ts, y el de Supabase gana si coincide el id.
// Si Supabase falla, se registra el error y se sigue solo con los datos locales.

type Supabase = Awaited<ReturnType<typeof createClient>>;

const CATEGORIAS: readonly Categoria[] = [
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];
const COLORES: readonly ColorJuego[] = ["cyan", "magenta", "yellow", "green"];

const esCategoria = (v: string): v is Categoria =>
  (CATEGORIAS as readonly string[]).includes(v);
const esColor = (v: string): v is ColorJuego =>
  (COLORES as readonly string[]).includes(v);

// best = puntuación máxima guardada; plays = número de puntuaciones guardadas.
async function aJuego(
  supabase: Supabase,
  row: Tables<"games">,
): Promise<Juego> {
  const [mejor, total] = await Promise.all([
    supabase
      .from("scores")
      .select("score")
      .eq("game_id", row.id)
      .order("score", { ascending: false })
      .limit(1),
    supabase
      .from("scores")
      .select("id", { count: "exact", head: true })
      .eq("game_id", row.id),
  ]);
  if (mejor.error) throw mejor.error;
  if (total.error) throw total.error;

  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: esCategoria(row.cat) ? row.cat : "ARCADE",
    cover: row.cover,
    color: esColor(row.color) ? row.color : "cyan",
    best: mejor.data[0]?.score ?? 0,
    plays: (total.count ?? 0).toLocaleString("es-ES"),
  };
}

async function juegosRemotos(supabase: Supabase): Promise<Juego[]> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return Promise.all(data.map((row) => aJuego(supabase, row)));
}

// El cliente se crea fuera de los try/catch: createClient() llama a cookies(), y
// durante el prerender su rechazo es la señal con la que Next marca la ruta como
// dinámica. Si se captura, se hornearían datos locales en una página estática.
export async function getCatalogo(): Promise<Juego[]> {
  const supabase = await createClient();
  try {
    const remotos = await juegosRemotos(supabase);
    const porId = new Map(remotos.map((g) => [g.id, g]));
    const locales = GAMES.map((g) => porId.get(g.id) ?? g);
    const soloRemotos = remotos.filter(
      (g) => !GAMES.some((l) => l.id === g.id),
    );
    return [...locales, ...soloRemotos];
  } catch (e) {
    console.error("getCatalogo: no se pudo leer Supabase", e);
    return GAMES;
  }
}

export async function getJuego(id: string): Promise<Juego | undefined> {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (data) return await aJuego(supabase, data);
  } catch (e) {
    console.error(`getJuego(${id}): no se pudo leer Supabase`, e);
  }
  return getGame(id);
}

export async function getTopScores(
  gameId: string,
  limit: number,
): Promise<Puntuacion[]> {
  const supabase = await createClient();
  try {
    return await leerTopScores(supabase, gameId, limit);
  } catch (e) {
    console.error(`getTopScores(${gameId}): no se pudo leer Supabase`, e);
    return [];
  }
}
