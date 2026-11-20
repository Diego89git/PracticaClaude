"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MENSAJES, mensajeDeError, normalizarNombre } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { AuthMensaje, AuthTarjeta } from "./auth-shell";
import { PasswordForm } from "./password-form";
import { useSession } from "./session-provider";

const PROVEEDOR = { email: "CORREO", google: "GOOGLE", github: "GITHUB" };

interface Renombre {
  anterior: string;
  nuevo: string;
}

// SPEC 24: panel de /cuenta. La protección real la hace proxy.ts (regla 2).
export function AccountPanel() {
  const router = useRouter();
  const { user, cargando, signOut, refrescar } = useSession();
  const [nombre, setNombre] = useState<string | null>(null);
  const [errNombre, setErrNombre] = useState<string | null>(null);
  const [okNombre, setOkNombre] = useState<string | null>(null);
  const [guardandoNombre, setGuardandoNombre] = useState(false);
  // Nombre ya guardado en Auth cuyas puntuaciones no se pudieron renombrar.
  const [pendiente, setPendiente] = useState<Renombre | null>(null);
  const [okPass, setOkPass] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  if (cargando || !user) {
    return (
      <AuthTarjeta titulo="TU CUENTA">
        <p className="auth-text">CARGANDO...</p>
      </AuthTarjeta>
    );
  }

  const valorNombre = nombre ?? user.name;

  const renombrarScores = async ({ anterior, nuevo }: Renombre) => {
    const { error } = await createClient().rpc("renombrar_scores", {
      anterior,
      nuevo,
    });
    if (error) {
      console.error("No se pudieron renombrar las puntuaciones", error);
      setPendiente({ anterior, nuevo });
      return false;
    }
    setPendiente(null);
    return true;
  };

  const cambiarNombre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guardandoNombre) return;
    setOkNombre(null);
    const nuevo = normalizarNombre(valorNombre);
    if (!nuevo) return setErrNombre(MENSAJES.nombre);
    if (nuevo === user.name) {
      setErrNombre(null);
      setNombre(null);
      return;
    }
    setErrNombre(null);
    setGuardandoNombre(true);
    const anterior = user.name;
    try {
      // 1) Auth, 2) puntuaciones, 3) releer el usuario.
      const { error } = await createClient().auth.updateUser({
        data: { username: nuevo },
      });
      if (error) throw error;
      const ok = anterior ? await renombrarScores({ anterior, nuevo }) : true;
      await refrescar();
      setNombre(null);
      if (ok) setOkNombre("NOMBRE GUARDADO");
    } catch (err) {
      setErrNombre(mensajeDeError(err));
    } finally {
      setGuardandoNombre(false);
    }
  };

  const reintentar = async () => {
    if (!pendiente || guardandoNombre) return;
    setGuardandoNombre(true);
    if (await renombrarScores(pendiente)) setOkNombre("NOMBRE GUARDADO");
    setGuardandoNombre(false);
  };

  const cerrarSesion = async () => {
    setSaliendo(true);
    await signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card cuenta-card">
        <div className="auth-header">
          <div className="mark"></div>
          <div className="cuenta-nombre">{user.name || "SIN NOMBRE"}</div>
        </div>

        <dl className="cuenta-datos">
          <dt>CORREO</dt>
          <dd>{user.email || "—"}</dd>
          <dt>ACCESO</dt>
          <dd>{PROVEEDOR[user.provider]}</dd>
        </dl>

        <section className="cuenta-seccion" aria-labelledby="cuenta-nombre-h">
          <h3 id="cuenta-nombre-h">NOMBRE DE JUGADOR</h3>
          <form onSubmit={cambiarNombre} noValidate>
            <div className="field">
              <label htmlFor="cuenta-nombre-input">
                Así apareces en el Salón de la Fama
              </label>
              <input
                id="cuenta-nombre-input"
                value={valorNombre}
                onChange={(e) => {
                  setNombre(e.target.value);
                  setOkNombre(null);
                }}
                autoComplete="nickname"
              />
            </div>
            <AuthMensaje error={errNombre} ok={okNombre} />
            {pendiente && (
              <div className="auth-msg err" role="alert">
                EL NOMBRE SE GUARDÓ, PERO TUS PUNTUACIONES SIGUEN COMO{" "}
                {pendiente.anterior}.{" "}
                <button
                  type="button"
                  className="btn ghost"
                  onClick={reintentar}
                  disabled={guardandoNombre}
                  style={{ marginTop: 8, padding: "8px 12px", fontSize: 8 }}
                >
                  REINTENTAR
                </button>
              </div>
            )}
            <button
              className="btn"
              type="submit"
              disabled={guardandoNombre}
              style={{ width: "100%" }}
            >
              {guardandoNombre ? "CARGANDO..." : "CAMBIAR NOMBRE"}
            </button>
          </form>
        </section>

        {user.provider === "email" && (
          <section className="cuenta-seccion" aria-labelledby="cuenta-pass-h">
            <h3 id="cuenta-pass-h">CONTRASEÑA</h3>
            <AuthMensaje ok={okPass} />
            <PasswordForm
              boton="CAMBIAR CONTRASEÑA"
              onHecho={() => setOkPass("CONTRASEÑA CAMBIADA")}
            />
          </section>
        )}

        <section className="cuenta-seccion">
          <button
            className="btn magenta"
            onClick={cerrarSesion}
            disabled={saliendo}
            style={{ width: "100%" }}
          >
            {saliendo ? "CARGANDO..." : "CERRAR SESIÓN"}
          </button>
        </section>
      </div>
    </div>
  );
}
