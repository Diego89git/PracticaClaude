// Catálogo de juegos con motor real. Son datos puros, sin la directiva "use client",
// para poder importarlos desde Server Components y desde componentes de cliente.
// Los componentes de cada juego viven en components.tsx.

// mantener: keydown al tocar y keyup al soltar (el motor lee el estado de la tecla).
// repetir:  keydown al tocar y, mientras se mantiene, repite como el teclado del SO
//           (primero 220 ms de espera, luego cada 90 ms); keyup al soltar.
// pulso:    un keydown y su keyup al tocar; mantener el dedo no repite.
export type ModoBoton = "mantener" | "repetir" | "pulso";

export interface BotonTactil {
  code: string; // KeyboardEvent.code que lee el motor: "ArrowLeft", "Space"...
  etiqueta: string; // texto visible del botón: "◀", "▲", "DISPARO"...
  aria: string; // aria-label: "Girar a la izquierda"
  modo: ModoBoton;
  zona: "izquierda" | "derecha"; // columna del mando en vertical y lado en apaisado
}

export interface JuegoReal {
  // Campos del HUD de la plataforma que el juego usa. Los demás se ocultan.
  hud: { vidas: boolean; nivel: boolean };
  // Botones del mando táctil. Sin él, no se muestra mando (solo teclado).
  controles?: BotonTactil[];
}

export const JUEGOS_REALES: Record<string, JuegoReal> = {
  asteroides: {
    hud: { vidas: true, nivel: true },
    controles: [
      {
        code: "ArrowLeft",
        etiqueta: "◀",
        aria: "Girar a la izquierda",
        modo: "mantener",
        zona: "izquierda",
      },
      {
        code: "ArrowRight",
        etiqueta: "▶",
        aria: "Girar a la derecha",
        modo: "mantener",
        zona: "izquierda",
      },
      {
        code: "ArrowUp",
        etiqueta: "▲ IMPULSO",
        aria: "Impulso",
        modo: "mantener",
        zona: "derecha",
      },
      {
        code: "Space",
        etiqueta: "DISPARO",
        aria: "Disparar",
        modo: "mantener",
        zona: "derecha",
      },
    ],
  },
  caida: {
    hud: { vidas: false, nivel: true }, // Tetris no tiene vidas
    controles: [
      {
        code: "ArrowLeft",
        etiqueta: "◀",
        aria: "Mover a la izquierda",
        modo: "repetir",
        zona: "izquierda",
      },
      {
        code: "ArrowRight",
        etiqueta: "▶",
        aria: "Mover a la derecha",
        modo: "repetir",
        zona: "izquierda",
      },
      {
        code: "ArrowDown",
        etiqueta: "▼",
        aria: "Bajar",
        modo: "repetir",
        zona: "izquierda",
      },
      {
        code: "ArrowUp",
        etiqueta: "⟳ GIRAR",
        aria: "Girar la pieza",
        modo: "pulso",
        zona: "derecha",
      },
      {
        code: "Space",
        etiqueta: "⤓ CAER",
        aria: "Caída en seco",
        modo: "pulso",
        zona: "derecha",
      },
    ],
  },
  "bloque-buster": {
    hud: { vidas: true, nivel: true },
    controles: [
      {
        code: "ArrowLeft",
        etiqueta: "◀",
        aria: "Mover la paleta a la izquierda",
        modo: "mantener",
        zona: "izquierda",
      },
      {
        code: "ArrowRight",
        etiqueta: "▶",
        aria: "Mover la paleta a la derecha",
        modo: "mantener",
        zona: "derecha",
      },
    ],
  },
  serpentina: {
    hud: { vidas: false, nivel: true }, // Snake no tiene vidas
    controles: [
      {
        code: "ArrowLeft",
        etiqueta: "◀",
        aria: "Girar a la izquierda",
        modo: "pulso",
        zona: "izquierda",
      },
      {
        code: "ArrowRight",
        etiqueta: "▶",
        aria: "Girar a la derecha",
        modo: "pulso",
        zona: "izquierda",
      },
      {
        code: "ArrowUp",
        etiqueta: "▲",
        aria: "Girar hacia arriba",
        modo: "pulso",
        zona: "derecha",
      },
      {
        code: "ArrowDown",
        etiqueta: "▼",
        aria: "Girar hacia abajo",
        modo: "pulso",
        zona: "derecha",
      },
    ],
  },
  // FROGGER. Sin `controles`: los controles táctiles quedan fuera de su SPEC core.
  ranaria: { hud: { vidas: true, nivel: true } },
};

// hasOwn y no `in`: así un id como "constructor" no coincide con Object.prototype.
export const esJuegoReal = (id: string) => Object.hasOwn(JUEGOS_REALES, id);

export const juegoReal = (id: string): JuegoReal | undefined =>
  esJuegoReal(id) ? JUEGOS_REALES[id] : undefined;
