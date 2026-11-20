import { Suspense } from "react";
import { AuthForm } from "../components/auth-form";

// AuthForm lee ?next= y ?error= con useSearchParams: va dentro de Suspense.
export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}
