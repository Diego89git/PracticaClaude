import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

// Crear un cliente nuevo por petición: no reutilizar entre peticiones.
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_URL");
  if (!key) {
    throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // En Server Components no se pueden escribir cookies. Se ignora:
          // el refresco de sesión lo hará el proxy cuando exista (spec de Auth).
        }
      },
    },
  });
}
