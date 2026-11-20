"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import type { BotonTactil, ModoBoton } from "@/app/games/catalog";

// Mando virtual: traduce toques en KeyboardEvent sintéticos sobre `window`,
// con el mismo `code` que leen los motores. No conoce ningún motor.
// Aspecto: gamepad neón MK-II (cruceta + botones redondos), SPEC 17.

const ESPERA_REPETICION_MS = 220;
const CADENCIA_REPETICION_MS = 90;

const POSICION_CRUCETA: Record<string, string> = {
  ArrowUp: "dp-up",
  ArrowDown: "dp-down",
  ArrowLeft: "dp-left",
  ArrowRight: "dp-right",
};

// Flecha de un solo carácter (◀ ▶ ▲ ▼) → cruceta; el resto (▲ IMPULSO, DISPARO…) → redondo.
function esCruceta(b: BotonTactil): boolean {
  return b.code in POSICION_CRUCETA && [...b.etiqueta].length === 1;
}

interface Pulsado {
  code: string;
  modo: ModoBoton;
  el: HTMLElement;
  espera?: ReturnType<typeof setTimeout>;
  cadencia?: ReturnType<typeof setInterval>;
}

function emitir(tipo: "keydown" | "keyup", code: string, repeat = false) {
  window.dispatchEvent(
    new KeyboardEvent(tipo, { code, repeat, bubbles: true, cancelable: true }),
  );
}

function esCampoDeTexto(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return (
    t instanceof HTMLInputElement ||
    t instanceof HTMLTextAreaElement ||
    t instanceof HTMLSelectElement ||
    t.isContentEditable
  );
}

const FLECHA: Record<string, string> = {
  ArrowUp: "M12 4 L20 16 L4 16 Z",
  ArrowRight: "M8 4 L20 12 L8 20 Z",
  ArrowDown: "M4 8 L20 8 L12 20 Z",
  ArrowLeft: "M16 4 L16 20 L4 12 Z",
};

interface TouchControlsProps {
  botones: BotonTactil[];
  activo: boolean; // !paused && !over; al pasar a false se sueltan todas las teclas
}

export function TouchControls({ botones, activo }: TouchControlsProps) {
  // Botones con el dedo encima, por índice. Solo hay entrada mientras hay keydown emitido.
  const pulsados = useRef(new Map<number, Pulsado>());
  const raiz = useRef<HTMLDivElement>(null);

  const soltar = (i: number) => {
    const p = pulsados.current.get(i);
    if (!p) return;
    pulsados.current.delete(i);
    clearTimeout(p.espera);
    clearInterval(p.cadencia);
    p.el.removeAttribute("data-pulsado");
    if (p.modo !== "pulso") emitir("keyup", p.code);
  };

  // El cleanup corre al pasar `activo` a false y al desmontar: libera teclas y temporizadores.
  useEffect(() => {
    if (!activo) return;
    const mapa = pulsados.current;
    return () => {
      for (const i of [...mapa.keys()]) {
        const p = mapa.get(i);
        if (!p) continue;
        mapa.delete(i);
        clearTimeout(p.espera);
        clearInterval(p.cadencia);
        p.el.removeAttribute("data-pulsado");
        if (p.modo !== "pulso") emitir("keyup", p.code);
      }
    };
  }, [activo]);

  // Iluminación con el teclado físico: `data-tecla`, independiente de `data-pulsado`
  // para que el keyup inmediato de un botón «pulso» no apague un botón aún tocado.
  useEffect(() => {
    if (!activo) return;
    const el = raiz.current;
    if (!el) return;
    const marcar = (code: string, on: boolean) => {
      el.querySelectorAll<HTMLElement>(`[data-code="${code}"]`).forEach((b) => {
        if (on) b.setAttribute("data-tecla", "");
        else b.removeAttribute("data-tecla");
      });
    };
    const alBajar = (e: KeyboardEvent) => {
      if (e.repeat || esCampoDeTexto(e.target)) return;
      marcar(e.code, true);
    };
    const alSubir = (e: KeyboardEvent) => marcar(e.code, false);
    window.addEventListener("keydown", alBajar);
    window.addEventListener("keyup", alSubir);
    return () => {
      window.removeEventListener("keydown", alBajar);
      window.removeEventListener("keyup", alSubir);
      el.querySelectorAll("[data-tecla]").forEach((b) =>
        b.removeAttribute("data-tecla"),
      );
    };
  }, [activo]);

  const pulsar = (
    e: PointerEvent<HTMLButtonElement>,
    i: number,
    b: BotonTactil,
  ) => {
    if (!activo || pulsados.current.has(i)) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const p: Pulsado = { code: b.code, modo: b.modo, el: e.currentTarget };
    pulsados.current.set(i, p);
    p.el.setAttribute("data-pulsado", "");
    emitir("keydown", b.code);

    if (b.modo === "pulso") {
      // Un solo gesto por toque: keydown y keyup seguidos; mantener el dedo no repite.
      emitir("keyup", b.code);
    } else if (b.modo === "repetir") {
      p.espera = setTimeout(() => {
        emitir("keydown", b.code, true);
        p.cadencia = setInterval(
          () => emitir("keydown", b.code, true),
          CADENCIA_REPETICION_MS,
        );
      }, ESPERA_REPETICION_MS);
    }
  };

  // Atributos comunes a todos los botones (cruceta y redondos).
  const comunes = (i: number, b: BotonTactil) => ({
    type: "button" as const,
    "aria-label": b.aria,
    "data-code": b.code,
    disabled: !activo,
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => pulsar(e, i, b),
    onPointerUp: () => soltar(i),
    onPointerCancel: () => soltar(i),
    onLostPointerCapture: () => soltar(i),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const indexados = botones.map((b, i) => ({ b, i }));
  const cruceta = indexados.filter(({ b }) => esCruceta(b));
  const acciones = indexados.filter(({ b }) => !esCruceta(b));

  return (
    <div
      ref={raiz}
      className={`touch-controls${acciones.length === 0 ? " solo-cruceta" : ""}`}
      aria-label="Mando táctil"
    >
      {cruceta.length > 0 && (
        <div className="touch-zone izquierda">
          <div className="gp-dpad">
            {cruceta.map(({ b, i }) => (
              <button
                key={`${b.code}-${i}`}
                className={`dp ${POSICION_CRUCETA[b.code]}`}
                {...comunes(i, b)}
              >
                <svg
                  className="dp-arrow"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d={FLECHA[b.code]} fill="currentColor" />
                </svg>
              </button>
            ))}
            <div className="dp-hub" aria-hidden="true">
              <span className="dp-hub-gem" />
            </div>
          </div>
        </div>
      )}
      {acciones.length > 0 && (
        <div className="touch-zone derecha">
          <div className="gp-actions">
            {acciones.map(({ b, i }, n) => {
              // «▲ IMPULSO» → glifo y texto en dos líneas; «DISPARO» → solo texto.
              const [primero, ...resto] = b.etiqueta.split(" ");
              const glifo = resto.length > 0 ? primero : "";
              const texto = resto.length > 0 ? resto.join(" ") : b.etiqueta;
              return (
                <button
                  key={`${b.code}-${i}`}
                  className={`ab ${n % 2 === 0 ? "ab-cian" : "ab-magenta"}`}
                  {...comunes(i, b)}
                >
                  <span className="ab-ring" aria-hidden="true" />
                  <span className="ab-letter" aria-hidden="true">
                    {glifo && <span className="ab-glyph">{glifo}</span>}
                    <span>{texto}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
