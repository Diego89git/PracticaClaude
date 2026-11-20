"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  MENSAJES,
  mensajeDeError,
  normalizarNombre,
  rutaInterna,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { AuthMensaje, AuthTarjeta } from "./auth-shell";
import { useSession } from "./session-provider";

// SPEC 24: «Elige tu nombre de jugador», la primera vez que se entra con OAuth.
export function NombreForm() {
  const router = useRouter();
  const next = rutaInterna(useSearchParams().get("next"));
  const { user, refrescar } = useSession();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  // Quien ya tiene nombre no necesita este paso.
  const yaTieneNombre = !!user?.name;
  useEffect(() => {
    if (yaTieneNombre) router.replace(next);
  }, [yaTieneNombre, next, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    const username = normalizarNombre(nombre);
    if (!username) return setError(MENSAJES.nombre);
    setError(null);
    setCargando(true);
    try {
      const { error } = await createClient().auth.updateUser({
        data: { username },
      });
      if (error) throw error;
      await refrescar();
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(mensajeDeError(err));
      setCargando(false);
    }
  };

  return (
    <AuthTarjeta titulo="ELIGE TU NOMBRE">
      <p className="auth-text">
        Es el nombre con el que apareces en el Salón de la Fama. Puedes
        cambiarlo después en tu cuenta.
      </p>
      <form onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="nombre-jugador">Nombre de jugador</label>
          <input
            id="nombre-jugador"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="px_kai"
            autoComplete="nickname"
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
          {cargando ? "CARGANDO..." : "GUARDAR NOMBRE"}
        </button>
      </form>
    </AuthTarjeta>
  );
}
