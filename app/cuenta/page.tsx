import type { Metadata } from "next";
import { AccountPanel } from "../components/account-panel";

export const metadata: Metadata = { title: "Tu cuenta · Arcade Vault" };

// SPEC 24: el panel es un componente cliente que lee useSession.
// proxy.ts redirige a /auth?next=/cuenta si no hay sesión.
export default function CuentaPage() {
  return <AccountPanel />;
}
