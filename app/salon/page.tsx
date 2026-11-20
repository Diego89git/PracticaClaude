import { Suspense } from "react";
import { getCatalogo } from "@/lib/supabase/queries";
import { HallOfFame } from "../components/hall-of-fame";

async function Salon() {
  const games = await getCatalogo();
  return <HallOfFame games={games} />;
}

function SalonCargando() {
  return (
    <div className="fade-in" style={{ textAlign: "center", padding: 120 }}>
      <div className="pixel" style={{ fontSize: 14, color: "var(--cyan)" }}>
        CARGANDO SALÓN <span className="blink">_</span>
      </div>
    </div>
  );
}

export default function SalonPage() {
  return (
    <Suspense fallback={<SalonCargando />}>
      <Salon />
    </Suspense>
  );
}
