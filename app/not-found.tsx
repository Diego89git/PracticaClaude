import Link from "next/link";

export default function NotFound() {
  return (
    <div className="fade-in" style={{ textAlign: "center", padding: "120px 24px" }}>
      <div className="pixel neon-magenta" style={{ fontSize: 22, marginBottom: 16 }}>404</div>
      <div className="pixel neon-cyan" style={{ fontSize: 12, marginBottom: 24 }}>JUEGO NO ENCONTRADO</div>
      <p style={{ color: "var(--ink-dim)", marginBottom: 32 }}>Este cartucho no existe en el Vault.</p>
      <Link href="/biblioteca" className="btn lg">VOLVER AL VAULT</Link>
    </div>
  );
}
