import { createClient } from "@/lib/supabase/server";

// Ruta temporal (SPEC 03): comprueba que la integración con Supabase funciona.
// Sin tablas ni sesión, la única prueba real es una petición a Supabase con la clave.
export async function GET() {
  try {
    await createClient(); // falla si faltan variables o el cliente no se puede crear

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
      {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
        cache: "no-store",
      },
    );
    if (!res.ok) throw new Error(`Supabase respondió ${res.status}`);

    return Response.json({ ok: true });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Error desconocido";
    return Response.json({ ok: false, error }, { status: 500 });
  }
}
