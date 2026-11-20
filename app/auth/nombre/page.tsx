import { Suspense } from "react";
import { NombreForm } from "../../components/nombre-form";

// NombreForm lee ?next= con useSearchParams: va dentro de Suspense.
export default function NombrePage() {
  return (
    <Suspense fallback={null}>
      <NombreForm />
    </Suspense>
  );
}
