import type { SupabaseClient } from "@supabase/supabase-js";
import type { Puntuacion } from "@/app/data";
import type { Database } from "./database.types";

// Lectura del top de un juego. La comparten el servidor (queries.ts) y el
// navegador (pestañas del Salón), cada uno con su propio cliente.

const fecha = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export async function leerTopScores(
  supabase: SupabaseClient<Database>,
  gameId: string,
  limit: number,
): Promise<Puntuacion[]> {
  const { data, error } = await supabase
    .from("scores")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data.map((r, i) => ({
    rank: i + 1,
    name: r.player_name,
    score: r.score,
    date: fecha.format(new Date(r.created_at)),
  }));
}
