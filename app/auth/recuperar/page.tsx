"use client";

import Link from "next/link";
import { useState } from "react";
import { mensajeDeError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { AuthMensaje, AuthTarjeta } from "../../components/auth-shell";

// SPEC 24: pide el correo y envía el enlace de recuperación.
export default function RecuperarPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    setError(null);
    setCargando(true);
    try {
      const { error } = await createClient().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${location.origin}/auth/nueva-contrasena` },
      );
      if (error) throw error;
      setEnviado(true);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  };

  if (enviado) {
    return (
      <AuthTarjeta titulo="REVISA TU CORREO">
        <p className="auth-text">
          Si <strong>{email.trim()}</strong> tiene cuenta, te llegará un enlace
          para elegir una contraseña nueva.
        </p>
        <Link href="/auth" className="btn ghost" style={{ width: "100%" }}>
          VOLVER A INICIAR SESIÓN
        </Link>
      </AuthTarjeta>
    );
  }

  return (
    <AuthTarjeta titulo="RECUPERAR CONTRASEÑA">
      <p className="auth-text">
        Escribe el correo de tu cuenta y te enviaremos un enlace para cambiar la
        contraseña.
      </p>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="recuperar-email">Correo electrónico</label>
          <input
            id="recuperar-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jugador@vault.gg"
            autoComplete="email"
            autoFocus
          />
        </div>
        <AuthMensaje error={error} />
        <button
          className="btn lg"
          type="submit"
          disabled={cargando}
          style={{ width: "100%", marginTop: 8 }}
        >
          {cargando ? "CARGANDO..." : "ENVIAR ENLACE"}
        </button>
      </form>
      <Link href="/auth" className="auth-link" style={{ marginTop: 14 }}>
        Volver a iniciar sesión
      </Link>
    </AuthTarjeta>
  );
}
