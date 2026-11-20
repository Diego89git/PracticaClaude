import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

export function createClient() {
  // Next.js solo inyecta NEXT_PUBLIC_* si se leen con acceso estático.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_URL");
  if (!key) {
    throw new Error("Falta la variable NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return createBrowserClient<Database>(url, key);
}
