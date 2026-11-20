import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

// SPEC 24: refresca la sesión de Supabase Auth en cada petición y aplica las
// redirecciones de cuenta. Es una comprobación optimista: la autorización real
// la hace RLS en Supabase.
const RUTAS_CON_SESION = ["/cuenta", "/auth/nombre"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Las cookies nuevas van a la petición (para lo que se renderice
        // después) y a la respuesta (para el navegador).
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Regla 1: no poner código entre createServerClient y getUser().
  // getUser() valida el token con Supabase y lo refresca si caducó.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // Una redirección también debe llevar las cookies refrescadas.
  const redirigir = (destino: string) => {
    const r = NextResponse.redirect(new URL(destino, request.url));
    response.cookies.getAll().forEach((c) => r.cookies.set(c));
    return r;
  };

  // Regla 2: sin sesión no se entra a /cuenta ni a /auth/nombre.
  if (!user) {
    if (RUTAS_CON_SESION.some((r) => path === r || path.startsWith(r + "/"))) {
      return redirigir(`/auth?next=${encodeURIComponent(path)}`);
    }
    return response;
  }

  const username = user.user_metadata?.username;
  const tieneNombre = typeof username === "string" && username.length > 0;

  // Regla 3: con sesión y sin username, primero se elige el nombre.
  if (!tieneNombre && !path.startsWith("/auth") && !path.startsWith("/api")) {
    return redirigir(`/auth/nombre?next=${encodeURIComponent(path)}`);
  }

  // Regla 4: con sesión completa, /auth lleva a la cuenta.
  if (tieneNombre && path === "/auth") return redirigir("/cuenta");

  return response;
}

export const config = {
  matcher: [
    // Regla 5: todo menos los estáticos de Next, el favicon, los assets de los
    // juegos (public/games/) y los archivos de imagen.
    "/((?!_next/static|_next/image|favicon.ico|games/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|avif)$).*)",
  ],
};
