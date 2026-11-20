"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { leerTopScores } from "@/lib/supabase/scores";
import { seededScores, type Juego, type Puntuacion } from "../data";
import { esJuegoReal } from "../games/catalog";
import { useSession } from "./session-provider";

interface RankingRemoto {
  tab: string;
  rows: Puntuacion[];
  error: boolean;
}

export function HallOfFame({ games }: { games: Juego[] }) {
  const { user } = useSession();
  const [tab, setTab] = useState(games[0].id);
  const [remoto, setRemoto] = useState<RankingRemoto | null>(null);

  const real = esJuegoReal(tab);
  const cargado = remoto?.tab === tab;
  const cargando = real && !cargado;
  const error = real && cargado && remoto.error;

  // Pestañas de juegos con ranking real: se leen de Supabase al activarlas.
  useEffect(() => {
    if (!esJuegoReal(tab)) return;
    let cancelado = false;
    leerTopScores(createClient(), tab, 12)
      .then((rows) => !cancelado && setRemoto({ tab, rows, error: false }))
      .catch((e) => {
        console.error(`Salón: no se pudo leer el ranking de ${tab}`, e);
        if (!cancelado) setRemoto({ tab, rows: [], error: true });
      });
    return () => {
      cancelado = true;
    };
  }, [tab]);

  const seeded = useMemo(() => seededScores(tab.length * 23 + 7, 12), [tab]);
  const rows = real ? (cargado ? remoto.rows : []) : seeded;
  const game = games.find((g) => g.id === tab) ?? games[0];

  // La fila "TU MEJOR MARCA" es ficticia: solo en juegos con ranking ficticio.
  const youRank = Math.floor(8 + (tab.length % 4));
  const youScore = seeded[5].score - 2400;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      <div className="podium">
        <div className="podium-slot silver">
          <div className="rank-num">02</div>
          <div className="name">{rows[1]?.name ?? "—"}</div>
          <div className="score">
            {rows[1]?.score.toLocaleString("es-ES") ?? "—"}
          </div>
          <div className="date">{rows[1]?.date ?? ""}</div>
        </div>
        <div className="podium-slot gold">
          <div
            className="pixel"
            style={{
              fontSize: 9,
              color: "var(--gold)",
              letterSpacing: "0.18em",
            }}
          >
            CAMPEÓN
          </div>
          <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
            01
          </div>
          <div className="name">{rows[0]?.name ?? "—"}</div>
          <div className="score" style={{ fontSize: 20 }}>
            {rows[0]?.score.toLocaleString("es-ES") ?? "—"}
          </div>
          <div className="date">{rows[0]?.date ?? ""}</div>
        </div>
        <div className="podium-slot bronze">
          <div className="rank-num">03</div>
          <div className="name">{rows[2]?.name ?? "—"}</div>
          <div className="score">
            {rows[2]?.score.toLocaleString("es-ES") ?? "—"}
          </div>
          <div className="date">{rows[2]?.date ?? ""}</div>
        </div>
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {cargando && (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "var(--ink-faint)",
            }}
          >
            Cargando ranking…
          </div>
        )}
        {error && (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "var(--magenta)",
            }}
          >
            No se pudo cargar el ranking. Vuelve a abrir la pestaña para
            reintentar.
          </div>
        )}
        {real && cargado && !error && rows.length === 0 && (
          <div
            style={{
              padding: "32px 16px",
              textAlign: "center",
              color: "var(--ink-faint)",
            }}
          >
            Sé el primero en entrar al salón de la fama.
          </div>
        )}
        {rows.map((r, i) => (
          <div
            key={r.name + i}
            className={
              "tr" +
              (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
            }
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
        {user && !real && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
            <div
              className="tr you"
              style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
            >
              <div className="rk" style={{ color: "var(--yellow)" }}>
                #{String(youRank).padStart(2, "0")}
              </div>
              <div className="pl" style={{ color: "var(--yellow)" }}>
                {user.name}
              </div>
              <div
                className="sc"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                {youScore.toLocaleString("es-ES")}
              </div>
              <div className="dt">11/05/2026</div>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/biblioteca" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
