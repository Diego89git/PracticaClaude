import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { rutaInterna } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// SPEC 24: enlaces de los correos (confirmación de registro y recuperación).
// Las plantillas de Supabase apuntan aquí con ?token_hash=...&type=...&next=...
// A diferencia de ?code= (PKCE), funciona aunque el correo se abra en otro navegador.
const TIPOS: EmailOtpType[] = [
  "email",
  "signup",
  "recovery",
  "invite",
  "magiclink",
  "email_change",
];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = rutaInterna(searchParams.get("next"));

  if (tokenHash && type && TIPOS.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    // Las cookies de sesión que escribe verifyOtp viajan con la redirección.
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    console.error("No se pudo verificar el enlace de correo", error.code);
  }

  return NextResponse.redirect(new URL("/auth?error=enlace", request.url));
}
