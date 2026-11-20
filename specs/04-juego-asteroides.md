# SPEC 04 — Primer juego real: ASTEROIDES

> **Estado:** Obsoleto
> **Reemplazada por:** SPEC 05 (`05-asteroids-game`)
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-16
> **Objetivo:** Añadir al catálogo el juego ASTEROIDES, portando a TypeScript el `game.js` de `references/started-games/02-asteroids/` y jugándolo en `/jugar/asteroides` dentro del reproductor de la plataforma.

## Por qué existe esta spec

Hasta ahora `/jugar/[id]` muestra el mismo placeholder para todos los juegos (SPEC 01). ASTEROIDES es el primer juego real y fija el patrón que seguirán los demás: un motor de juego sin React, un componente cliente que lo monta en un `<canvas>`, y el reproductor de la plataforma que aporta el HUD, la pausa y el guardado de puntuación. El juego original es un único `game.js` con globales (`canvas`, `keys`, `ship`...) que no puede ejecutarse tal cual en un componente de React.

ASTEROIDES **no es** el juego `rocas` del catálogo. Es un juego nuevo con su propio id; `rocas` queda intacto.

## Alcance

**Dentro:**

- Nueva entrada `asteroides` en `GAMES` (`app/data.ts`), añadida como noveno juego.
- Nueva portada `.cover-asteroides` en `app/globals.css`.
- Motor del juego en `app/games/asteroides/engine.ts`: el código de `game.js` movido a TypeScript con los tipos mínimos y las adaptaciones obligadas (canvas recibido por parámetro, listeners con limpieza, callbacks hacia el HUD).
- Componente cliente `app/components/asteroides-game.tsx` que monta el motor en un `<canvas>` de 800×600 dentro del marco CRT.
- `app/components/game-player.tsx` usa el juego real cuando `game.id === "asteroides"`; el resto de juegos sigue con el placeholder.
- HUD de la plataforma (Jugador, Puntuación, Vidas, Nivel) alimentado por el motor.
- PAUSA, FIN, JUGAR DE NUEVO y GUARDAR PUNTUACIÓN funcionando con el juego real (`saveScore` de SPEC 01, `localStorage`).
- Mecánicas del original, sin cambios: nave con inercia, disparo, asteroides que se parten (grande → mediano → pequeño), partículas, 3 vidas con invencibilidad al reaparecer, niveles crecientes y power-up de triple disparo.
- Control solo con teclado: flechas y ESPACIO. Las flechas y ESPACIO no hacen scroll de la página mientras se juega.

**Fuera de alcance (specs futuras):**

- Tocar el juego `rocas` o cualquier otro juego del catálogo.
- Añadir OVNIs u otras mecánicas nuevas.
- Controles táctiles o para móvil.
- Recolorear el juego con el tema neón: se mantienen los trazos blancos sobre negro.
- Sonido.
- Ranking real o guardado de puntuaciones en Supabase; sigue `localStorage` (`av_scores`).
- Cambiar `seededScores`: el ranking de `/juegos/asteroides` y el Salón siguen mostrando datos ficticios.
- Reescribir la lógica del juego (balance, velocidades, puntos): se conserva la del original.

## Modelo de datos

Entrada nueva en `GAMES` (`app/data.ts`), con los tipos de SPEC 01:

```ts
{
  id: "asteroides",
  title: "ASTEROIDES",
  short: "...",          // texto corto en español, a revisar por el usuario
  long: "...",           // texto largo en español, sin mencionar OVNIs
  cat: "SHOOTER",
  cover: "cover-asteroides",
  color: "cyan",
  best: 0,
  plays: "0",
}
```

Interfaz del motor (`app/games/asteroides/engine.ts`):

```ts
export interface AsteroidesEvents {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onLevel: (level: number) => void;
  onGameOver: () => void;
}

export interface AsteroidesEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void; // cancela requestAnimationFrame y quita los listeners
}

export function createAsteroides(
  canvas: HTMLCanvasElement,
  events: AsteroidesEvents,
): AsteroidesEngine;
```

Props del componente (`app/components/asteroides-game.tsx`):

```ts
interface Props {
  paused: boolean;
  over: boolean; // true = partida terminada (por FIN o por game over)
  runId: number; // cambia en cada JUGAR DE NUEVO para reiniciar
  onScore: (n: number) => void;
  onLives: (n: number) => void;
  onLevel: (n: number) => void;
  onGameOver: () => void;
}
```

Convenciones: canvas fijo de 800×600 escalado por CSS al ancho del `.crt-screen` (proporción 4:3); coordenadas con origen arriba a la izquierda; tiempos en segundos; `dt` limitado a 50 ms como en el original.

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/` lo necesario sobre Client Components, según exige `AGENTS.md`. Usar `/frontend-design` solo para la portada y sin alejarse del estilo de las otras portadas.

1. **Ficha del juego.** Añadir la entrada `asteroides` al final de `GAMES` en `app/data.ts` y la clase `.cover-asteroides` a `app/globals.css`. El juego aún usa el placeholder. Verificar con `npm run dev`: `/biblioteca` muestra 9 tarjetas y `/juegos/asteroides` carga.
2. **Motor.** Crear `app/games/asteroides/engine.ts` con el código de `game.js` portado: clases `Bullet`, `Asteroid`, `PowerUp`, `Ship`, `Particle`, utilidades y constantes iguales; estado de módulo convertido en estado de cierre dentro de `createAsteroides`; `keydown`/`keyup` registrados en `window` y eliminados en `destroy`; sin `document.getElementById`; sin HUD ni GAME OVER dibujados en el canvas. Se conserva en el canvas el indicador `3x` del triple disparo. Al perder la última vida se llama a `onGameOver()` y el motor deja de aceptar entrada. Verificar con `npx tsc --noEmit` y `npx eslint app/games`.
3. **Componente.** Crear `app/components/asteroides-game.tsx` (`"use client"`): `<canvas width={800} height={600}>` con `ref`, `useEffect` que llama a `createAsteroides` y a `destroy` en la limpieza, y efectos que aplican `paused`, `over` y `runId`. Llama a `preventDefault` en flechas y ESPACIO mientras la partida está activa y el foco no está en un campo de texto.
4. **Reproductor.** En `app/components/game-player.tsx`, cuando `game.id === "asteroides"`: renderizar `<AsteroidesGame />` dentro de `.crt-screen` en lugar de `.game-arena`, no arrancar el temporizador de puntuación falsa, alimentar `score`, `lives` y `level` desde los callbacks (el nivel real, no el calculado por puntos), abrir el modal en `onGameOver`, y hacer que JUGAR DE NUEVO incremente `runId`. El resto de juegos conserva el placeholder sin cambios.
5. **Cierre.** Ejecutar `npm run lint` y `npm run build`, y jugar una partida completa en el navegador.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `/biblioteca` muestra 9 tarjetas y la categoría SHOOTER muestra INVASORES, ROCAS y ASTEROIDES.
- [ ] La tarjeta ASTEROIDES usa la portada `cover-asteroides` y es distinta de la de ROCAS.
- [ ] `/juegos/asteroides` carga con título, descripción larga sin mención a OVNIs y `best` en 0.
- [ ] El Home (`/`) sigue mostrando exactamente 6 mini tarjetas, las mismas de antes.
- [ ] `/jugar/asteroides` muestra el juego real en un canvas de 800×600 dentro del marco CRT, sin el placeholder.
- [ ] `/jugar/rocas` (y los demás juegos) siguen mostrando el placeholder.
- [ ] Las flechas izquierda/derecha rotan la nave, la flecha arriba la propulsa y ESPACIO dispara.
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras se juega.
- [ ] Destruir un asteroide grande suma 20, uno mediano 50 y uno pequeño 100; la puntuación del HUD se actualiza.
- [ ] Un asteroide grande se parte en 2 medianos y uno mediano en 2 pequeños; uno pequeño no se parte.
- [ ] Chocar con un asteroide resta una vida en el HUD y la nave reaparece tras 2 s parpadeando durante 3 s.
- [ ] Destruir todos los asteroides sube el nivel del HUD en 1 y genera `3 + nivel` asteroides.
- [ ] El power-up `3x` aparece, al recogerlo la nave dispara 3 balas durante 5 s y el canvas muestra el temporizador.
- [ ] PAUSA congela el juego y muestra "EN PAUSA"; REANUDAR continúa donde estaba.
- [ ] Perder la tercera vida abre el modal "FIN DEL JUEGO" con la puntuación final.
- [ ] FIN abre el mismo modal con la puntuación actual.
- [ ] GUARDAR PUNTUACIÓN muestra "PUNTUACIÓN GUARDADA" y añade una entrada con `game: "asteroides"` a `localStorage["av_scores"]`.
- [ ] JUGAR DE NUEVO reinicia puntuación a 0, vidas a 3 y nivel a 1, con 4 asteroides nuevos.
- [ ] Con el modal abierto, ESPACIO no dispara ni reinicia la partida.
- [ ] Escribir el nombre en el campo del modal no mueve la nave ni dispara.
- [ ] Salir de `/jugar/asteroides` y volver no duplica velocidad ni disparos: queda un único bucle y los listeners se eliminan al desmontar.
- [ ] El canvas se ve completo sin scroll horizontal a 1440 px y a 768 px de ancho.
- [ ] `app/games/asteroides/engine.ts` no contiene `document.` ni `window.` fuera del registro y la limpieza de `keydown`/`keyup`.

## Decisiones tomadas y descartadas

- **Sí:** juego nuevo con id `asteroides`, distinto de `rocas`. Decisión del usuario; evita sobrescribir un juego del catálogo.
- **Sí:** ortografía `asteroides` / ASTEROIDES en id y título, corrigiendo la errata "Asterioides" de la petición inicial.
- **Sí:** portar `game.js` a TypeScript con tipos mínimos. Se cumple "copiar tal cual" en lógica y estructura, y el código pasa `npm run lint` y `npm run build`.
- **No:** `.js` con `// @ts-nocheck`. Deja código sin tipos y con comprobaciones desactivadas en un repo estricto.
- **No:** `iframe` con `index.html`. Aísla el juego y no permite HUD, pausa ni guardado de puntuación de la plataforma.
- **Sí:** motor sin React en `app/games/asteroides/` y componente en `app/components/`. Separa lógica de interfaz y deja el patrón para los próximos juegos.
- **Sí:** el HUD, la pausa, FIN y el modal de puntuación los pone la plataforma. Se retiran del canvas el HUD y el GAME OVER propios.
- **Sí:** el game over abre el modal y se elimina el reinicio con ESPACIO. Evita reinicios accidentales y deja una sola forma de reiniciar.
- **Sí:** se conserva en el canvas el temporizador `3x` del triple disparo. El HUD de la plataforma no tiene campo para él; es una decisión de la spec a revisar.
- **Sí:** aspecto fiel al original (trazos blancos sobre negro). No se altera nada de la jugabilidad ni del dibujo.
- **No:** recolorear con el neón del tema. Es una decisión de diseño aparte.
- **Sí:** añadir el juego al final de `GAMES` (9 juegos). El Home usa `GAMES.slice(0, 6)` y no cambia.
- **Sí:** `best: 0` y `plays: "0"`. Es un juego real sin historial; no se inventan cifras.
- **Sí:** solo teclado. Controles táctiles requieren diseño y pruebas en dispositivo y van en otra spec.
- **Sí:** las puntuaciones se siguen guardando con `saveScore` en `localStorage`. La integración con Supabase (SPEC 03) se usará en una spec futura.
- **Sí:** esta spec reemplaza los criterios de SPEC 01 y SPEC 02 que cuentan "8 juegos" o "SHOOTER muestra exactamente INVASORES y ROCAS". Ahora son 9 juegos y SHOOTER muestra tres.

## Riesgos

| Riesgo                                                                                  | Mitigación                                                                                                            |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| React monta el efecto dos veces en desarrollo (Strict Mode) y duplica bucle y listeners | `destroy()` cancela `requestAnimationFrame` y quita los listeners; criterio explícito de un único bucle al desmontar. |
| Las flechas y ESPACIO hacen scroll de la página y ESPACIO activa botones enfocados      | `preventDefault` solo con la partida activa y fuera de campos de texto; verificado en los criterios.                  |
| El campo de nombre del modal captura teclas que el juego interpreta como entrada        | El motor ignora la entrada cuando la partida terminó, y el componente ignora eventos cuyo destino es un `input`.      |
| El canvas se deforma o desborda en pantallas estrechas                                  | Canvas con tamaño intrínseco 800×600 y CSS al 100 % del `.crt-screen` (4:3); comprobado a 1440 px y 768 px.           |
| Cambiar de pestaña acumula un `dt` enorme y la nave "salta"                             | Se conserva el límite de `dt` a 50 ms del original.                                                                   |
| El Prettier del repo reformatea el código portado y dificulta compararlo con `game.js`  | Aceptado: se conserva la lógica, no el estilo de espaciado. Comparar por comportamiento, no por diff literal.         |
| `best: 0` se ve raro junto a los otros juegos con cifras altas                          | Aceptado: es el dato real hasta que exista ranking persistente.                                                       |

## Qué **no** está en esta spec

- Cambios en `rocas` ni en ningún otro juego.
- OVNIs, sonido o mecánicas nuevas.
- Controles táctiles o versión móvil.
- Recolorear el juego con el tema neón.
- Ranking real, Supabase o tablas para puntuaciones.
- Cambios en `seededScores` o en el Salón de la Fama.

Cada uno, si llega, va en su propia spec.
