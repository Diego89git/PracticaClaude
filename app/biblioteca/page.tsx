import { Suspense } from "react";
import { getCatalogo } from "@/lib/supabase/queries";
import { Library } from "../components/library";

async function Catalogo() {
  const games = await getCatalogo();
  return <Library games={games} />;
}

function CatalogoCargando() {
  return (
    <div className="fade-in" style={{ textAlign: "center", padding: 120 }}>
      <div className="pixel" style={{ fontSize: 14, color: "var(--cyan)" }}>
        CARGANDO CATÁLOGO <span className="blink">_</span>
      </div>
    </div>
  );
}

export default function BibliotecaPage() {
  return (
    <Suspense fallback={<CatalogoCargando />}>
      <Catalogo />
    </Suspense>
  );
}
