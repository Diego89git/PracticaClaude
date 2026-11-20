# SPEC 16 — Controles táctiles y pantalla adaptada para jugar en móvil

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 05, SPEC 06, SPEC 07, SPEC 08, SPEC 09
> **Fecha:** 2026-11-17
> **Objetivo:** Que los cuatro juegos reales (ASTEROIDES, CAÍDA, BLOQUE BUSTER y SERPENTINA) se puedan jugar de principio a fin en un móvil con pantalla táctil, con un mando virtual en pantalla y el reproductor adaptado al viewport estrecho, sin modificar ningún motor.

## Por qué existe esta spec

Hoy los cuatro motores leen únicamente `keydown`/`keyup` de `window` con `e.code`: no existe ni un solo evento táctil. En un móvil no hay teclado físico, así que los juegos arrancan pero son **injugables**. Además el reproductor (`/jugar/[id]`) está pensado para escritorio: el marco CRT tiene 24 px de relleno, el HUD y los botones ocupan mucho alto y el canvas de 800×600 queda pequeño o desbordado en una pantalla vertical.

La plataforma ya separa bien las responsabilidades: el motor sabe leer teclas, `game-player.tsx` pone HUD, pausa y modal, y el registro (`app/games/catalog.ts`) declara datos por juego. Esta spec aprovecha esa separación: un **mando virtual** de la plataforma traduce toques en `KeyboardEvent` sintéticos sobre `window`, con el mismo `code` que usa cada motor. Así teclado y táctil conviven, los motores no cambian y un juego nuevo solo declara qué botones quiere.

## Alcance

**Dentro:**

- Tipos `BotonTactil` y `ModoBoton` y campo opcional `controles` en `JuegoReal` (`app/games/catalog.ts`), con la lista de botones de los cuatro juegos reales.
- Componente cliente `app/components/touch-controls.tsx`: mando virtual que emite `keydown`/`keyup` sintéticos en `window` según el modo de cada botón (`mantener`, `repetir`, `pulso`), con multitoque, liberación de teclas al pausar, terminar o desmontar, y sin scroll, zoom ni menú contextual al tocar.
- Integración en `app/components/game-player.tsx`: el mando se muestra bajo el marco CRT (vertical) o a los lados (horizontal) y solo está activo mientras el juego corre (`!paused && !over`).
- Visibilidad solo en dispositivos táctiles, por CSS con la media query `(pointer: coarse)`; en escritorio con ratón no aparece.
- Estilos en `app/globals.css`: mando, botones de mínimo 56×56 px, y adaptación móvil del reproductor (relleno del CRT reducido, HUD compacto, canvas escalado manteniendo 4:3).
- Aviso discreto «GIRA EL DISPOSITIVO PARA JUGAR MEJOR» solo en táctil y vertical; no bloquea el juego.
- Disposición apaisada: mando a ambos lados del canvas y canvas limitado por la altura del viewport (`dvh`) para que quepa sin scroll vertical.
- Nota en `CLAUDE.md` sobre el campo `controles` del registro.

**Fuera de alcance (specs futuras):**

- Gestos sobre el canvas (deslizar, arrastrar la paleta, tocar para rotar).
- Interruptor manual para mostrar u ocultar el mando; la detección es solo `(pointer: coarse)`.
- Bloquear el juego hasta girar el dispositivo, `screen.orientation.lock()` y pantalla completa (iOS Safari no la admite en iPhone).
- Vibración háptica y sonido de los botones.
- Cambios en los motores (`app/games/*/engine.ts`) y en la jugabilidad o el balance.
- Actualizar el skill `/add-game` (`pattern.md`, `spec-template.md`) para que exija `controles` en juegos nuevos.
- Los juegos placeholder (`gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`): no tienen motor.
- Rediseño del resto de pantallas (Home, Biblioteca, Salón, Auth) para móvil. Solo se toca el reproductor.
- Controles remapeables, joystick analógico y mandos Bluetooth/Gamepad API.
- PWA, instalación y modo sin conexión.

## Modelo de datos

No hay tablas ni migraciones: la spec no toca Supabase. Los datos nuevos son configuración estática en el registro de juegos.

Tipos y campo nuevo en `app/games/catalog.ts` (sigue siendo datos puros, sin `"use client"`):

```ts
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
  hud: { vidas: boolean; nivel: boolean };
  controles?: BotonTactil[]; // sin él, no se muestra mando (solo teclado)
}
```

Botones de cada juego (el orden de la lista es el orden de aparición dentro de su zona). Salen de las teclas que hoy lee cada motor; no se añade ninguna acción nueva:

| Juego           | Zona izquierda                                                             | Zona derecha                                               |
| --------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `asteroides`    | ◀ `ArrowLeft` (mantener), ▶ `ArrowRight` (mantener)                        | ▲ IMPULSO `ArrowUp` (mantener), DISPARO `Space` (mantener) |
| `caida`         | ◀ `ArrowLeft` (repetir), ▶ `ArrowRight` (repetir), ▼ `ArrowDown` (repetir) | ⟳ GIRAR `ArrowUp` (pulso), ⤓ CAER `Space` (pulso)          |
| `bloque-buster` | ◀ `ArrowLeft` (mantener)                                                   | ▶ `ArrowRight` (mantener)                                  |
| `serpentina`    | ◀ `ArrowLeft` (pulso), ▶ `ArrowRight` (pulso)                              | ▲ `ArrowUp` (pulso), ▼ `ArrowDown` (pulso)                 |

Por qué cada modo: ASTEROIDES y BLOQUE BUSTER guardan el estado de la tecla y la leen en cada fotograma (`keys[e.code]`, `left`/`right`), así que necesitan `keydown` al tocar y `keyup` al soltar. CAÍDA ejecuta una acción en **cada** `keydown`, incluidos los que repite el SO, así que mover y bajar necesitan repetición, mientras que girar y caer en seco son un solo gesto por toque. SERPENTINA encola una dirección por `keydown`; con un pulso por toque basta y evita llenar la cola.

Componente `app/components/touch-controls.tsx`:

```ts
interface TouchControlsProps {
  botones: BotonTactil[];
  activo: boolean; // !paused && !over; al pasar a false se sueltan todas las teclas
}
```

Comportamiento (valores iniciales, se ajustan viendo la captura sin cambiar el comportamiento):

- Cada botón es un `<button type="button">` con eventos de puntero (`pointerdown`, `pointerup`, `pointercancel`, `lostpointercapture`), no `touchstart`/`click`, para que el multitoque funcione por botón (p. ej. ◀ + DISPARO a la vez en ASTEROIDES).
- Al `pointerdown`: `setPointerCapture`, `preventDefault`, `keydown` sintético (`new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true })` sobre `window`) y, según el modo, el temporizador de repetición.
- Al soltar, cancelar o perder la captura: `keyup` sintético y limpieza de temporizadores. Un botón nunca emite `keyup` sin su `keydown` ni deja una tecla pegada.
- Si `activo` pasa a `false` o el componente se desmonta: `keyup` de todas las teclas pulsadas y limpieza de temporizadores.
- `contextmenu` cancelado, `user-select: none`, `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent` y `touch-action: none` en los botones.

Reglas de CSS (`app/globals.css`):

- `.touch-controls { display: none; }` por defecto y `display: grid` dentro de `@media (pointer: coarse)`.
- Vertical: bajo el CRT, dos columnas (`izquierda` / `derecha`) a ancho completo; botones de 56×56 px como mínimo y 72 px en los de dirección principal.
- Apaisado táctil (`(pointer: coarse) and (orientation: landscape)`): rejilla de tres columnas `mando izquierdo | CRT | mando derecho`; el `.crt-screen` se limita a `max-height: calc(100dvh − alto del HUD − márgenes)` para no hacer scroll vertical; `.crt-bottom` se oculta.
- Móvil (`max-width: 720px`): `.crt` con `padding: 8px` y radio menor, `.hud-stat .v` a 12 px y `.player-hud` con menos relleno.
- Aviso de giro: `(pointer: coarse) and (orientation: portrait)`; oculto en cualquier otro caso.
- Los botones usan los tokens existentes (`--line`, `--cyan`, `--bg-2`, `--ink`), así que siguen el modo claro/oscuro y la skin activa sin código extra.

`game-player.tsx` pasa `config?.controles` y `activo={!paused && !over}` al mando. El motor, `GameProps` y `components.tsx` no cambian.

## Plan de implementación

Antes de empezar, leer `AGENTS.md` y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components, según exige el proyecto. El mando es una interfaz de usuario: invocar `/frontend-design` antes de dar estilo a los botones y a la disposición móvil.

1. **Tipos y registro.** Añadir `ModoBoton`, `BotonTactil` y `controles?` a `JuegoReal` en `app/games/catalog.ts` y rellenar `controles` de los cuatro juegos según la tabla. Verificar: `npx tsc --noEmit` y `npx eslint app/games`; `catalog.ts` sigue sin `"use client"`; los cuatro juegos cargan igual que antes (el campo no se usa todavía).
2. **Componente del mando.** Crear `app/components/touch-controls.tsx` con los modos `mantener`, `repetir` y `pulso`, la liberación de teclas y los estilos básicos en `globals.css` (oculto salvo `(pointer: coarse)`). Verificar: `npx tsc --noEmit`, `npx eslint app/components`; el componente no importa nada de `app/games/*/engine.ts`.
3. **Integración en el reproductor.** Renderizar `TouchControls` en `game-player.tsx` bajo el `.crt` con `config?.controles` y `activo`. Verificar en el navegador con emulación táctil: el mando aparece en `/jugar/serpentina` y mueve la serpiente; en escritorio sin emulación no aparece nada nuevo.
4. **Adaptación móvil del reproductor.** Con `/frontend-design`: relleno del CRT, HUD compacto, aviso de giro en vertical y rejilla de tres columnas en apaisado. Verificar capturas en 390×844 y 844×390: el canvas completo, el HUD y el mando visibles, sin scroll horizontal y, en apaisado, sin scroll vertical.
5. **Verificación por juego.** En emulación táctil (`isMobile` + `hasTouch`) probar cada juego con eventos de puntero reales sobre los botones: ASTEROIDES (girar + impulso + disparo a la vez), CAÍDA (repetición al mantener ◀ ▶ ▼; girar y caer son un solo gesto por toque), BLOQUE BUSTER (paleta continua al mantener) y SERPENTINA (un giro por toque). Comprobar PAUSA, FIN, JUGAR DE NUEVO y el modal de guardar puntuación con el teclado del móvil, y que no queda ninguna tecla pegada tras pausar.
6. **Cierre.** `npm run lint`, `npm run build` sin trazas de error; `git diff --stat -- app/games` solo muestra `catalog.ts`; comprobar en escritorio que el mando no aparece y que el teclado sigue funcionando en los cuatro juegos; añadir la nota del campo `controles` a `CLAUDE.md`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `git diff` no muestra cambios en `app/games/*/engine.ts`, `app/games/types.ts` ni `app/games/components.tsx`; en `app/games/` solo cambia `catalog.ts`.
- [ ] `catalog.ts` define `ModoBoton`, `BotonTactil` y `controles?` en `JuegoReal`, y los cuatro juegos reales declaran los botones de la tabla.
- [ ] En un dispositivo con `(pointer: coarse)`, `/jugar/asteroides`, `/jugar/caida`, `/jugar/bloque-buster` y `/jugar/serpentina` muestran el mando de su juego; `/jugar/gloton` (placeholder) no muestra ninguno.
- [ ] En escritorio con ratón (`(pointer: fine)`) el mando no aparece y el reproductor se ve igual que antes de esta spec.
- [ ] Cada botón mide al menos 56×56 px y los de dirección principal al menos 72 px.
- [ ] SERPENTINA: tocar ▲, ▼, ◀ o ▶ arranca la partida y gira la serpiente una vez por toque; ◀ al estar en espera se ignora igual que con el teclado.
- [ ] BLOQUE BUSTER: mantener ◀ o ▶ mueve la paleta de forma continua a 400 px/s y al soltar se detiene.
- [ ] CAÍDA: mantener ◀, ▶ o ▼ repite el movimiento (primer paso inmediato, repetición tras 220 ms cada 90 ms); ⟳ gira una vez por toque y ⤓ hace caída en seco una vez por toque.
- [ ] ASTEROIDES: se pueden mantener a la vez ◀ o ▶ junto con ▲ y DISPARO; el multitoque funciona por botón.
- [ ] Un botón nunca emite `keyup` sin su `keydown` previo ni deja una tecla pegada: tras pulsar PAUSA o FIN con un botón mantenido, la nave o la paleta dejan de moverse al reanudar sin tocar nada.
- [ ] Al desmontar el reproductor (SALIR) con un botón mantenido se emiten los `keyup` pendientes y se limpian los temporizadores.
- [ ] Con PAUSA activa o el modal "FIN DEL JUEGO" abierto, el mando no emite eventos de juego.
- [ ] Tocar el mando no desplaza la página, no hace zoom con doble toque, no selecciona texto y una pulsación larga no abre el menú contextual.
- [ ] El teclado físico sigue funcionando en los cuatro juegos con el mando visible.
- [ ] El modal "FIN DEL JUEGO" permite escribir el nombre con el teclado del móvil y GUARDAR PUNTUACIÓN inserta la fila en `scores` como antes.
- [ ] A 390×844 (vertical) el canvas se ve completo con su relación 4:3, sin scroll horizontal, con el HUD legible y el mando bajo el marco CRT.
- [ ] A 390×844 aparece el aviso «GIRA EL DISPOSITIVO PARA JUGAR MEJOR»; a 844×390 y en escritorio no aparece, y en ningún caso impide jugar.
- [ ] A 844×390 (apaisado) el mando queda a ambos lados del canvas, el canvas se ve completo sin scroll vertical ni horizontal y `.crt-bottom` está oculto.
- [ ] El mando es legible en modo claro y oscuro y en las skins disponibles de cada juego.
- [ ] Jugar una partida completa hasta el fin en un juego, solo con toques, y guardar la puntuación funciona (verificado en emulación).
- [ ] Salir de un juego y volver no duplica los listeners ni los temporizadores del mando.
- [ ] `CLAUDE.md` documenta el campo `controles` y el modo de añadirlo a un juego.
- [ ] Probado en al menos un móvil real (comprobación manual del usuario: toques, multitoque y orientación).

## Decisiones tomadas y descartadas

- **Sí:** mando virtual con botones en pantalla. Respuesta del usuario. Es el único enfoque que no exige tocar los motores y que sirve igual para los cuatro juegos, que usan entre 2 y 5 teclas.
- **No:** gestos sobre el canvas (deslizar, arrastrar, tocar para rotar). Es más natural, pero obliga a reescribir la entrada de cada motor y a diseñar gestos distintos por juego. Queda para una spec propia, posiblemente solo para SERPENTINA y BLOQUE BUSTER.
- **Sí:** el mando emite `KeyboardEvent` sintéticos en `window` con el `code` que ya lee cada motor. Respuesta del usuario (opción recomendada) y consecuencia de la arquitectura actual: los motores ya escuchan `window`, no comprueban `isTrusted` y descartan solo eventos de campos de texto (el `target` del evento sintético es `window`).
- **No:** añadir a cada motor una API de entrada propia (`engine.press("left")`). Cambia el contrato `GameEngine` y obliga a tocar los cuatro motores y la plantilla `engine.ts.tpl`.
- **Sí:** los tres modos `mantener`, `repetir` y `pulso`, porque los motores consumen la entrada de tres maneras distintas (estado por fotograma, una acción por `keydown` repetible y una acción por `keydown` aislada). Con un solo modo uno de los juegos se rompería.
- **Sí:** eventos de puntero (`pointerdown`/`pointerup`/`pointercancel`) con `setPointerCapture`, no `touchstart`/`click`. Permiten multitoque por botón, funcionan igual con ratón al emular y evitan el retardo de `click`.
- **Sí:** el alcance son los cuatro juegos reales. Respuesta del usuario. Los placeholders no tienen motor, así que no hay nada que controlar.
- **No:** incluir el cambio del skill `/add-game` para exigir `controles` en juegos nuevos. Es otra herramienta y otra decisión; como `controles` es opcional, un juego nuevo sigue funcionando solo con teclado hasta que se le añada. Queda como seguimiento.
- **Sí:** `controles` es opcional en `JuegoReal`. Un juego sin él no muestra mando y sigue compilando; así esta spec no rompe la receta de `/add-game` ni obliga a tocar juegos que se añadan después.
- **Sí:** canvas escalado por CSS manteniendo 4:3 y aviso discreto de girar en vertical. Respuesta del usuario. Mantiene todos los juegos jugables en ambas orientaciones sin bloquear al jugador.
- **No:** exigir apaisado con pantalla «GIRA TU DISPOSITIVO». Bloquea al jugador que no puede girar el móvil (por ejemplo con la rotación bloqueada).
- **No:** solo escalar sin aviso. En vertical el canvas queda en unos 360×270 px y el jugador no sabe que apaisado se juega mejor.
- **Sí:** el mando se muestra solo con `(pointer: coarse)`, resuelto por CSS. Respuesta del usuario. No hay JavaScript de detección, no hay desajuste de hidratación y un portátil táctil con ratón queda como `fine` y no ve el mando.
- **No:** interruptor manual para mostrar u ocultar el mando. No se pidió; es una mejora posible si un dispositivo híbrido se detecta mal.
- **No:** `screen.orientation.lock()` ni pantalla completa. Solo funcionan con restricciones (pantalla completa previa y no disponible en iPhone) y no son necesarios para jugar.
- **Sí:** `activo = !paused && !over` y liberar las teclas al desactivarse. Evita que una tecla quede pegada si el jugador pausa con un botón mantenido, que es el fallo más habitual de los mandos virtuales.
- **Sí:** esta spec toca `game-player.tsx` y `globals.css`, aunque `CLAUDE.md` indica no tocar `game-player.tsx` al añadir un juego: esa regla es para registrar juegos, y esto es un cambio de la plataforma.
- **Sí:** la verificación de ejecución se hace en emulación táctil y se pide además una comprobación manual en un móvil real. La emulación no reproduce el rendimiento ni el multitoque físico.

## Riesgos

| Riesgo                                                                                                           | Mitigación                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Una tecla queda pegada si el dedo sale del botón o se cancela el toque                                           | `setPointerCapture` y `pointercancel`/`lostpointercapture` emiten el `keyup`; criterio explícito de PAUSA con botón mantenido |
| Un motor futuro comprueba `e.isTrusted` y rechaza los eventos sintéticos                                         | Hoy ninguno lo hace; criterio de aceptación por juego y nota en `CLAUDE.md`                                                   |
| La repetición de CAÍDA se siente distinta a la del SO (retardo y cadencia varían por sistema)                    | Valores fijos de 220/90 ms, ajustables viendo el juego sin cambiar la estructura                                              |
| Los botones tapan el juego o no caben en pantallas pequeñas (360×640)                                            | El mando va **fuera** del canvas, no encima; comprobar 360×640, 390×844 y 844×390                                             |
| Dispositivos híbridos (portátil táctil con ratón) detectados como `fine` y sin mando                             | Aceptado en esta spec; el interruptor manual queda fuera y se valorará si aparece el caso                                     |
| `dvh` no está disponible en navegadores antiguos y el canvas desborda en apaisado                                | Valor de respaldo con `vh` antes del `dvh`                                                                                    |
| El teclado virtual del móvil tapa el modal al escribir el nombre al guardar la puntuación                        | Se comprueba en el paso 5; si ocurre, se corrige el alto del modal sin cambiar su comportamiento                              |
| Los eventos sintéticos activan el `preventDefault` de `GAME_KEYS` en los componentes de juego sin efecto visible | Es inocuo: `preventDefault` sobre un evento sintético no hace nada; se verifica que no hay errores en consola                 |
| La emulación del navegador no detecta problemas de multitoque, latencia ni rendimiento reales                    | Criterio manual en un móvil real; la verificación automática se declara como emulada, no como prueba en dispositivo           |
| Un juego añadido después no declara `controles` y queda injugable en móvil sin que nadie lo note                 | `controles` opcional; seguimiento anotado para actualizar el skill `/add-game`                                                |

## Qué **no** está en esta spec

- Gestos sobre el canvas, joystick analógico y Gamepad API.
- Interruptor manual del mando, vibración y sonido de los botones.
- Bloqueo de orientación, pantalla completa y PWA.
- Cambios en los motores, en la jugabilidad o en el balance.
- Actualizar el skill `/add-game` y sus plantillas.
- Rediseño móvil del Home, la Biblioteca, el Salón de la Fama y Auth.
- Los juegos placeholder.

Cada uno, si llega, va en su propia spec.
