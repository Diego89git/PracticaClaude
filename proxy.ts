import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";

// SPEC 24: refresca la sesión de Supabase Auth en cada petición.
// Las reglas de redirección (2, 3 y 4 de la spec) se añaden en los pasos 6 y 8.
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
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Todo menos los estáticos de Next, el favicon, los assets de los juegos
    // (public/games/) y los archivos de imagen.
    "/((?!_next/static|_next/image|favicon.ico|games/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|avif)$).*)",
  ],
};
