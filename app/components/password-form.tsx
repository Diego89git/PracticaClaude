"use client";

import { useState } from "react";
import { mensajeDeError, validarPassword } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { AuthMensaje } from "./auth-shell";

// SPEC 24: nueva contraseña con su repetición. Lo usan /auth/nueva-contrasena
// (sesión de recuperación) y /cuenta (cuentas de correo).
export function PasswordForm({
  boton,
  onHecho,
}: {
  boton: string;
  onHecho: () => void;
}) {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    const errPass = validarPassword(pass, pass2);
    if (errPass) return setError(errPass);
    setError(null);
    setCargando(true);
    try {
      const { error } = await createClient().auth.updateUser({
        password: pass,
      });
      if (error) throw error;
      setPass("");
      setPass2("");
      onHecho();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="nueva-pass">Contraseña nueva</label>
        <input
          id="nueva-pass"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </div>
      <div className="field">
        <label htmlFor="nueva-pass2">Repite la contraseña</label>
        <input
          id="nueva-pass2"
          type="password"
          value={pass2}
          onChange={(e) => setPass2(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </div>
      <AuthMensaje error={error} />
      <button
        className="btn"
        type="submit"
        disabled={cargando}
        style={{ width: "100%", marginTop: 4 }}
      >
        {cargando ? "CARGANDO..." : boton}
      </button>
    </form>
  );
}
