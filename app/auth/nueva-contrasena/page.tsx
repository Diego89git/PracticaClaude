"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MENSAJES } from "@/lib/auth";
import { AuthMensaje, AuthTarjeta } from "../../components/auth-shell";
import { PasswordForm } from "../../components/password-form";
import { useSession } from "../../components/session-provider";

// SPEC 24: se llega desde el enlace de recuperación (/auth/confirm?type=recovery),
// que deja iniciada la sesión de recuperación.
export default function NuevaContrasenaPage() {
  const router = useRouter();
  const { user, cargando } = useSession();

  if (cargando) {
    return (
      <AuthTarjeta titulo="NUEVA CONTRASEÑA">
        <p className="auth-text">CARGANDO...</p>
      </AuthTarjeta>
    );
  }

  if (!user) {
    return (
      <AuthTarjeta titulo="NUEVA CONTRASEÑA">
        <AuthMensaje error={MENSAJES.enlace} />
        <Link href="/auth/recuperar" className="btn" style={{ width: "100%" }}>
          PEDIR OTRO ENLACE
        </Link>
      </AuthTarjeta>
    );
  }

  return (
    <AuthTarjeta titulo="NUEVA CONTRASEÑA">
      <p className="auth-text">
        Elige la contraseña nueva para <strong>{user.email}</strong>.
      </p>
      <PasswordForm
        boton="GUARDAR CONTRASEÑA"
        onHecho={() => {
          router.replace("/biblioteca");
          router.refresh();
        }}
      />
    </AuthTarjeta>
  );
}
