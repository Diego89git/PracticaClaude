"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useSession } from "./session-provider";

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, cargando } = useSession();
  // Con sesión el botón lleva a /cuenta; sin sesión, a /auth (SPEC 24).
  const rutaCuenta = user ? "/cuenta" : "/auth";
  const textoCuenta = user ? user.name || "CUENTA" : "Iniciar Sesión";

  const isActive = (name: "inicio" | "biblioteca" | "salon" | "auth") => {
    if (name === "inicio") return pathname === "/";
    if (name === "biblioteca")
      return (
        pathname.startsWith("/biblioteca") ||
        pathname.startsWith("/juegos") ||
        pathname.startsWith("/jugar")
      );
    if (name === "salon") return pathname.startsWith("/salon");
    return pathname.startsWith("/auth") || pathname.startsWith("/cuenta");
  };
  const close = () => setOpen(false);

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo">
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isActive("inicio") ? "active" : ""}>
            Inicio
          </Link>
          <Link
            href="/biblioteca"
            className={isActive("biblioteca") ? "active" : ""}
          >
            Biblioteca
          </Link>
          <Link href="/salon" className={isActive("salon") ? "active" : ""}>
            Salón de la Fama
          </Link>
          <span className="disabled" aria-disabled="true" title="Próximamente">
            Acerca de
          </span>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        {cargando ? (
          <span className="btn ghost auth-btn" aria-busy="true">
            ···
          </span>
        ) : user ? (
          <Link href="/cuenta" className="btn ghost auth-btn">
            {textoCuenta} ▾
          </Link>
        ) : (
          <Link href="/auth" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <Link
          href="/"
          onClick={close}
          className={isActive("inicio") ? "active" : ""}
        >
          Inicio
        </Link>
        <Link
          href="/biblioteca"
          onClick={close}
          className={isActive("biblioteca") ? "active" : ""}
        >
          Biblioteca
        </Link>
        <Link
          href="/salon"
          onClick={close}
          className={isActive("salon") ? "active" : ""}
        >
          Salón de la Fama
        </Link>
        <span className="disabled" aria-disabled="true" title="Próximamente">
          Acerca de
        </span>
        <Link
          href={rutaCuenta}
          onClick={close}
          className={isActive("auth") ? "active" : ""}
        >
          {user ? `Cuenta · ${textoCuenta}` : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{
            fontSize: 9,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
          }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
