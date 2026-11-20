import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getJuego } from "@/lib/supabase/queries";
import { GamePlayer } from "../../components/game-player";
import { GAMES } from "../../data";

export function generateStaticParams() {
  return GAMES.map((g) => ({ id: g.id }));
}

export default function PlayPage({ params }: PageProps<"/jugar/[id]">) {
  return (
    <Suspense fallback={<JuegoCargando />}>
      <Jugar params={params} />
    </Suspense>
  );
}

function JuegoCargando() {
  return (
    <div className="fade-in" style={{ textAlign: "center", padding: 120 }}>
      <div className="pixel" style={{ fontSize: 14, color: "var(--cyan)" }}>
        CARGANDO JUEGO <span className="blink">_</span>
      </div>
    </div>
  );
}

async function Jugar({
  params,
}: {
  params: PageProps<"/jugar/[id]">["params"];
}) {
  const { id } = await params;
  const game = await getJuego(id);
  if (!game) notFound();
  return <GamePlayer game={game} />;
}
