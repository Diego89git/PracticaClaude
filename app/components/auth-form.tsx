"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  MENSAJES,
  mensajeDeError,
  mensajeDeParametro,
  normalizarNombre,
  rutaInterna,
  validarPassword,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { AuthMensaje } from "./auth-shell";

type Proveedor = "google" | "github";

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = rutaInterna(params.get("next"));
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState<string | null>(() =>
    mensajeDeParametro(params.get("error")),
  );
  const [cargando, setCargando] = useState(false);
  const [revisaCorreo, setRevisaCorreo] = useState(false);

  const cambiarTab = (t: "in" | "up") => {
    setTab(t);
    setError(null);
  };

  const entrar = async () => {
    const { error } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    if (error) return setError(mensajeDeError(error));
    router.replace(next);
    router.refresh();
  };

  const registrar = async () => {
    const username = normalizarNombre(user);
    if (!username) return setError(MENSAJES.nombre);
    const errPass = validarPassword(pass, pass2);
    if (errPass) return setError(errPass);
    const { data, error } = await createClient().auth.signUp({
      email: email.trim(),
      password: pass,
      options: {
        data: { username },
        emailRedirectTo: `${location.origin}/auth/confirm`,
      },
    });
    if (error) return setError(mensajeDeError(error));
    // Con «Confirm email» activo, Supabase no da error si el correo ya existe:
    // devuelve un usuario sin identidades.
    if (data.user && data.user.identities?.length === 0) {
      return setError(MENSAJES.yaRegistrado);
    }
    setRevisaCorreo(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    setError(null);
    setCargando(true);
    try {
      await (tab === "in" ? entrar() : registrar());
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  };

  const oauth = async (provider: Proveedor) => {
    if (cargando) return;
    setError(null);
    setCargando(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // Si todo va bien el navegador ya está saliendo hacia el proveedor.
    if (error) {
      setError(mensajeDeError(error));
      setCargando(false);
    }
  };

  if (revisaCorreo) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          <div className="auth-header">
            <div className="mark"></div>
            <h2 className="neon-cyan">REVISA TU CORREO</h2>
          </div>
          <p className="auth-text">
            Te enviamos un enlace a <strong>{email.trim()}</strong>. Ábrelo para
            confirmar la cuenta y entrar al vault.
          </p>
          <button
            className="btn ghost"
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => {
              setRevisaCorreo(false);
              cambiarTab("in");
            }}
          >
            VOLVER A INICIAR SESIÓN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={tab === "in" ? "on" : ""}
            onClick={() => cambiarTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={tab === "up" ? "on" : ""}
            onClick={() => cambiarTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit} noValidate>
          {tab === "up" && (
            <div className="field slide-in">
              <label htmlFor="auth-usuario">Usuario</label>
              <input
                id="auth-usuario"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="px_kai"
                autoComplete="nickname"
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="auth-email">Correo electrónico</label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="auth-pass">Contraseña</label>
            <input
              id="auth-pass"
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
              autoComplete={tab === "in" ? "current-password" : "new-password"}
            />
          </div>
          {tab === "up" && (
            <div className="field slide-in">
              <label htmlFor="auth-pass2">Repite la contraseña</label>
              <input
                id="auth-pass2"
                type="password"
                value={pass2}
                onChange={(e) => setPass2(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
          )}
          {tab === "in" && (
            <Link href="/auth/recuperar" className="auth-link">
              ¿Olvidaste tu contraseña?
            </Link>
          )}

          <AuthMensaje error={error} />

          <button
            className="btn lg"
            type="submit"
            disabled={cargando}
            style={{ width: "100%", marginTop: 8 }}
          >
            {cargando
              ? "CARGANDO..."
              : tab === "in"
                ? "ENTRAR AL VAULT"
                : "CREAR Y JUGAR"}
          </button>
        </form>

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => router.push("/biblioteca")}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            disabled={cargando}
            onClick={() => oauth("google")}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={cargando}
            onClick={() => oauth("github")}
          >
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
