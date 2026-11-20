"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Juego } from "../data";
import { juegoReal } from "../games/catalog";
import { COMPONENTES } from "../games/components";
import { JUEGOS_CON_SKINS } from "../games/skins";
import { SkinSelector, useSkin } from "./skin-selector";
import { useSession } from "./session-provider";
import { TouchControls } from "./touch-controls";

const PLAYER_NAME_KEY = "av_player_name";

const readPlayerName = () => {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY);
  } catch {
    return null;
  }
};

export function GamePlayer({ game }: { game: Juego }) {
  // Los juegos con motor real están en el registro (app/games). El resto usa el placeholder.
  const config = juegoReal(game.id);
  const real = !!config;
  const GameComponent = real ? COMPONENTES[game.id] : undefined;
  const { user, saveScore } = useSession();
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [typedName, setTypedName] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [runId, setRunId] = useState(0);
  const savingRef = useRef(false);
  const conSkins = JUEGOS_CON_SKINS.includes(game.id);
  const { skin, modo, setSkin, setModo } = useSkin(conSkins);
  const name = typedName ?? user?.name ?? "INVITADO";

  // Fin de partida (FIN o game over). En juegos reales el nombre se pre-rellena:
  // con sesión, con el username (SPEC 24); sin sesión, con el último usado.
  const finish = () => {
    if (real && typedName === null && !user?.name) {
      const stored = readPlayerName();
      if (stored) setTypedName(stored.toUpperCase().slice(0, 10));
    }
    setOver(true);
  };

  // El ref bloquea envíos repetidos aunque lleguen antes de que React vuelva a renderizar.
  const save = async () => {
    if (savingRef.current || saved) return;
    const playerName = name.trim();
    if (real && !playerName) return;
    savingRef.current = true;
    if (!real) {
      saveScore({ game: game.id, score, name });
      setSaved(true);
      return;
    }
    setSaving(true);
    setSaveError(false);
    // av_player_name solo recuerda el nombre del invitado.
    if (!user) {
      try {
        localStorage.setItem(PLAYER_NAME_KEY, playerName);
      } catch {}
    }
    try {
      const { error } = await createClient()
        .from("scores")
        .insert({
          game_id: game.id,
          player_name: playerName,
          score,
          user_id: user?.id ?? null,
        });
      if (error) throw error;
      saveScore({ game: game.id, score, name: playerName });
      setSaved(true);
    } catch (e) {
      console.error("No se pudo guardar la puntuación", e);
      savingRef.current = false;
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // Con mando táctil la pantalla de juego oculta el navbar (lo decide el CSS con
  // (pointer: coarse); aquí solo se marca el <html> mientras el reproductor está montado).
  const conMando = !!config?.controles;
  useEffect(() => {
    if (!conMando) return;
    const html = document.documentElement;
    html.setAttribute("data-mando", "");
    return () => html.removeAttribute("data-mando");
  }, [conMando]);

  // Marca el <html> mientras el reproductor está montado (aunque el juego no tenga
  // mando): el CSS táctil oculta el navbar, que en un móvil desborda el ancho.
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-reproductor", "");
    return () => html.removeAttribute("data-reproductor");
  }, []);

  // Placeholder: puntuación simulada. Los juegos reales la envían con callbacks.
  useEffect(() => {
    if (real || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [real, over, paused]);

  const restart = () => {
    setScore(0);
    setLives(3);
    setLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveError(false);
    savingRef.current = false;
    setRunId((r) => r + 1);
  };

  // Placeholder: el nivel sube cada 2500 puntos. En juegos reales es el del juego.
  const shownLevel = real ? level : level + Math.floor(score / 2500);

  return (
    <div className="av-player fade-in">
      {conSkins && (
        <SkinSelector
          skin={skin}
          modo={modo}
          onSkin={setSkin}
          onModo={setModo}
        />
      )}
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          {(!config || config.hud.vidas) && (
            <div className="hud-stat lives">
              <div className="l">Vidas</div>
              <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
            </div>
          )}
          {(!config || config.hud.nivel) && (
            <div className="hud-stat level">
              <div className="l">Nivel</div>
              <div className="v">{String(shownLevel).padStart(2, "0")}</div>
            </div>
          )}
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={finish}>
            FIN
          </button>
          <Link href={`/juegos/${game.id}`} className="btn ghost">
            REGRESAR
          </Link>
        </div>
      </div>

      <div className="player-stage">
        <div className="crt">
          <div className="crt-screen" data-juego={game.id}>
            {GameComponent ? (
              <GameComponent
                paused={paused}
                over={over}
                runId={runId}
                skin={skin}
                modo={modo}
                onScoreChange={setScore}
                onLivesChange={setLives}
                onLevelChange={setLevel}
                onGameOver={(finalScore) => {
                  setScore(finalScore);
                  finish();
                }}
              />
            ) : (
              <div className="game-arena">
                <div className="grid-floor"></div>
                <div className="enemy e1"></div>
                <div className="enemy e2"></div>
                <div className="enemy e3"></div>
                <div className="player-ship"></div>
              </div>
            )}
            {paused && (
              <div
                className="crt-content"
                style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
              >
                <div>
                  <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                    EN PAUSA
                  </div>
                  <div
                    className="mono"
                    style={{
                      fontSize: 11,
                      color: "var(--ink-dim)",
                      marginTop: 10,
                      letterSpacing: "0.16em",
                    }}
                  >
                    PULSA REANUDAR PARA CONTINUAR
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="crt-bottom">
            <span className="led">SEÑAL OK</span>
            <span>{game.title} · CRT-83 · 60 HZ</span>
            <span>CARGA · 1MB</span>
          </div>
        </div>

        {config?.controles && (
          <TouchControls botones={config.controles} activo={!paused && !over} />
        )}
        {config?.controles && (
          <p className="rotate-hint">GIRA EL DISPOSITIVO PARA JUGAR MEJOR</p>
        )}
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setTypedName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={save}
                  disabled={saving || (real && !name.trim())}
                >
                  {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            {saveError && !saved && (
              <div
                role="alert"
                style={{ color: "var(--magenta)", marginTop: 12, fontSize: 12 }}
              >
                No se pudo guardar la puntuación. Inténtalo de nuevo.
              </div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart} disabled={saving}>
                JUGAR DE NUEVO
              </button>
              <Link href="/biblioteca" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
