import { NextResponse, type NextRequest } from "next/server";
import { rutaInterna } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// SPEC 24: vuelta de Google/GitHub. OAuth siempre regresa al mismo navegador,
// así que aquí sí se usa el código PKCE (?code=).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = rutaInterna(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // La primera vez (sin username) se pide el nombre de jugador.
      const username = data.user?.user_metadata?.username;
      const destino =
        typeof username === "string" && username
          ? next
          : `/auth/nombre?next=${encodeURIComponent(next)}`;
      return NextResponse.redirect(new URL(destino, request.url));
    }
    console.error("No se pudo completar el inicio de sesión OAuth", error.code);
  }

  return NextResponse.redirect(new URL("/auth?error=oauth", request.url));
}
