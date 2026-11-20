# SPEC 12 — Game jam «Gravedad invertida»: INVERSOR, pulido y cierre

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06, SPEC 07, SPEC 10, SPEC 11
> **Fecha:** 2026-11-17
> **Objetivo:** Terminar INVERSOR con una pantalla de espera, tres vidas con invulnerabilidad tras cada golpe y efectos visuales dibujados en el canvas (estela, partículas y sacudida), y cerrar el juego con la verificación completa.

## Por qué existe esta spec

La SPEC 10 dejó INVERSOR jugable y la SPEC 11 le dio progresión: niveles, velocidad creciente, obstáculos nuevos y cristales. Aún tiene dos asperezas. La partida arranca corriendo en cuanto se monta la página, así que el primer pincho puede llegar antes de que el jugador mire la pantalla, y un solo error acaba la partida, algo duro con velocidades de hasta 640 px/s. Esta spec corrige ambas cosas y añade la respuesta visual que hace que cada acción se sienta: estela del cubo, partículas al invertir, recoger o chocar, y sacudida al recibir un golpe.

Como en las SPEC 10 y 11, no toca Supabase, la portada ni `components.tsx`: solo el motor `app/games/inversor/engine.ts` y la línea de `inversor` en `app/games/catalog.ts`, que pasa a mostrar Vidas. Es la última spec del juego, así que termina con la verificación final completa. Sigue la receta de `.claude/skills/add-game/references/pattern.md`.

## Alcance

**Dentro:**

- Pantalla de espera dibujada en el canvas («PULSA ESPACIO, ↑ O ↓») hasta la primera tecla válida, también tras JUGAR DE NUEVO.
- 3 vidas con `onLivesChange` y `hud.vidas: true` en `catalog.ts`; invulnerabilidad de 0,75 s tras cada golpe con el cubo parpadeando.
- Estela del cubo, partículas (al invertir, al recoger un cristal y al chocar) y sacudida del dibujo al recibir un golpe.
- Un generador pseudoaleatorio propio para los efectos, que no consume `Math.random`.
- Verificación final completa del juego (plataforma, Supabase, degradación, remontajes y anchos de pantalla).
- Mecánicas de las SPEC 10 y 11 sin cambios: física, entrada, niveles, velocidad, obstáculos, cristales y puntuación.

**Fuera de alcance (specs futuras):**

- Sonido, assets e imágenes: los efectos se dibujan con rectángulos del canvas.
- Vidas extra, escudos u otros power-ups.
- Animación de muerte previa al modal: al perder la última vida el modal se abre de inmediato.
- Controles táctiles o para móvil, ratón y teclas WASD.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cambios en Supabase, en la portada y en los otros juegos.

## Modelo de datos

Esta spec no introduce estructuras en la base de datos: la ficha de la SPEC 10 no cambia.

Entrada del registro (`app/games/catalog.ts`), la única línea que cambia:

```ts
inversor: { hud: { vidas: true, nivel: true } },
```

Constantes nuevas del motor (las de las SPEC 10 y 11 se conservan):

```ts
const START_LIVES = 3;
const INVULN_S = 0.75; // invulnerabilidad tras un golpe
const BLINK_MS = 80; // el cubo alterna visible/oculto cada 80 ms
const TRAIL_LEN = 6; // muestras de la estela
const TRAIL_STEP_S = 0.03; // una muestra cada 30 ms
const FX_SEED = 12345; // semilla del generador de efectos
const PARTICLE_SIZE = 4;
const PARTICLE_LIFE_S = 0.3;
const PARTICLES_FLIP = 6;
const PARTICLES_CRYSTAL = 10;
const PARTICLES_HIT = 14;
const MAX_PARTICLES = 64;
const SHAKE_S = 0.25;
const SHAKE_AMP = 8; // px, decae linealmente hasta 0
```

Estado nuevo:

```ts
let waiting: boolean; // true hasta la primera tecla válida
let lives: number;
let invuln: number; // segundos de invulnerabilidad que quedan
let trail: { y: number; age: number }[];
let particles: {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}[];
let shake: number; // segundos de sacudida que quedan
let fxSeed: number; // estado del generador de efectos
```

Reglas:

- **Espera:** al montar el motor y tras `restart()`, `waiting = true`. En espera no avanzan `distance`, la física, los obstáculos ni los efectos, y el cubo está posado en el suelo en `(160, 528)`. Se dibuja el texto `PULSA ESPACIO, ↑ O ↓` en `#e0e0e0`, monoespaciada de 24 px, centrado en `(400, 300)`.
- **Salir de la espera:** la primera pulsación de ESPACIO, ↑ o ↓ pone `waiting = false` y se aplica como en la SPEC 10 (↓ no cambia nada porque el cubo ya cae al suelo, ESPACIO y ↑ invierten). ← y → no hacen nada. Un `keydown` con `repeat: true` no arranca la partida.
- **Vidas:** `lives = 3` al empezar y tras `restart()`, con `onLivesChange(3)`. Antes eran 0 constante: ahora el HUD las muestra.
- **Golpe:** si hay choque (reglas de la SPEC 10) y `invuln = 0`: `lives −= 1` y se notifica con `onLivesChange`. Si `lives > 0`: `invuln = 0,75`, `shake = 0,25` y 14 partículas magenta (`#ff4fd8`). Si `lives = 0`: se notifica `onLivesChange(0)` y **después** `onGameOver(score)`, una sola vez; la lógica deja de avanzar y no hay animación previa.
- **Invulnerabilidad:** mientras `invuln > 0`, los choques se ignoran y `invuln` baja con `dt`. El cubo se dibuja visible o oculto alternando cada 80 ms. Los cristales se siguen recogiendo. Ningún grupo sigue solapado al acabar: el más ancho (dos pinchos, 72 px de hitbox más 32 del cubo) lo cruza a 320 px/s en 0,33 s, menos de 0,75 s.
- **Estela:** cada 0,03 s se guarda `{ y, age: 0 }` y se conservan las 6 últimas; `age` sube con `dt`. Cada muestra se dibuja como un cuadrado de 32×32 `#ffe14d` en `x = 160 − speed × age`, con opacidad `0,35 × (1 − age / 0,18)`. La estela no se dibuja en la espera.
- **Partículas:** cuadrados de 4×4 con vida de 0,3 s, velocidad entre 80 y 240 px/s en dirección aleatoria y opacidad `vida restante / 0,3`. Se emiten 6 `#ffe14d` en el centro del cubo al invertir la gravedad, 10 `#4de8ff` en el cristal al recogerlo y 14 `#ff4fd8` en el choque que no acaba la partida. El máximo es 64: al llegar, se descartan las más antiguas.
- **Sacudida:** mientras `shake > 0`, todo el dibujo del canvas se desplaza `(fx × a, fx × a)` con `a = 8 × shake / 0,25` y `fx` aleatorio en −1…1 del generador de efectos. Solo afecta al dibujo, nunca a las coordenadas de la lógica.
- **Generador de efectos:** `fxSeed = (fxSeed × 1664525 + 1013904223) >>> 0`, valor `fxSeed / 2³²`, con semilla `12345`, que se restablece en `restart()`. Los efectos **no** llaman a `Math.random`, para que el orden de las cinco llamadas de la SPEC 11 no cambie.
- **Pausa:** `invuln`, el parpadeo, la estela, las partículas y la sacudida avanzan solo con `update(dt)`, así que se congelan con PAUSA y no saltan al REANUDAR.
- **Callbacks:** `onLivesChange` solo cuando `lives` cambia (3 al empezar, 2, 1 y 0); `onGameOver(score)` una sola vez y después de notificar las vidas, para que el modal abra con el HUD ya a 0.

Convenciones: las de las SPEC 10 y 11 (canvas 800×600, tiempos en segundos, `dt` ≤ 50 ms).

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas" y la sección 8, "Verificación"), la sección 6 de `.claude/skills/add-game/references/porting.md` y las SPEC 10 y 11, y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components y Cache Components, según exige `AGENTS.md`.

1. **Pantalla de espera.** En `engine.ts`, añadir `waiting`, su dibujo y la salida con ESPACIO, ↑ o ↓; limpiar en `restart()`. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, el smoke del motor y, en el navegador, el cubo no avanza hasta la primera tecla y JUGAR DE NUEVO vuelve a la espera.
2. **Vidas e invulnerabilidad.** Añadir `lives`, `invuln`, el parpadeo y el fin por última vida, y poner `vidas: true` en `inversor` dentro de `catalog.ts`. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, la prueba de comportamiento con `Math.random` fijo (tres choques seguidos dejan las vidas en 2, 1 y 0 y abren el modal una vez) y en el navegador el HUD muestra Vidas.
3. **Efectos.** Añadir el generador `fxSeed`, la estela, las partículas y la sacudida, todos avanzados con `dt`. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y la captura de una partida con partículas y estela visibles; comprobar que la secuencia de aparición con `Math.random` fijo es idéntica a la de la SPEC 11.
4. **Cierre completo.** `npm run lint`, `npm run build` sin trazas de error, `get_advisors` de seguridad sin avisos, `node .claude/skills/add-game/scripts/rls-check.mjs inversor`, tres remontajes con medición de frames por segundo, capturas a 1440 px y a 768 px, `/juegos/no-existe` y `/jugar/no-existe`, `npm run build` con `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=invalida` (y `/biblioteca` en 200), y una partida completa hasta verla en `/juegos/inversor` y en la pestaña de INVERSOR de `/salon`. Borrar todas las filas de prueba de `scores`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `catalog.ts` declara `inversor: { hud: { vidas: true, nivel: true } }` y el HUD de la plataforma muestra Puntuación, Vidas y Nivel.
- [ ] No hay cambios en `supabase/migrations/`, en `app/globals.css` ni en `app/games/components.tsx`.
- [ ] Al montar el juego se ve el texto «PULSA ESPACIO, ↑ O ↓», el cubo posado en `(160, 528)`, sin pinchos, y la puntuación no sube mientras no se pulsa una tecla.
- [ ] ESPACIO, ↑ y ↓ arrancan la partida y el texto desaparece; ← y → no hacen nada en la espera; un `keydown` con `repeat: true` tampoco.
- [ ] Con PAUSA activa durante la espera, REANUDAR vuelve a la espera sin avanzar el mundo.
- [ ] El HUD muestra 3 vidas al empezar y `onLivesChange` se llama con 3, 2, 1 y 0 sin repetir valores.
- [ ] Un choque con `invuln = 0` resta una vida, deja `invuln = 0,75` y no abre el modal mientras queden vidas.
- [ ] Durante los 0,75 s de invulnerabilidad un segundo choque no resta vida; pasados 0,75 s, un choque nuevo sí.
- [ ] El cubo alterna visible y oculto cada 80 ms durante la invulnerabilidad y vuelve a verse siempre al terminar.
- [ ] Los cristales se recogen durante la invulnerabilidad y suman 50 puntos.
- [ ] Perder la tercera vida deja las vidas del HUD en 0 y abre el modal "FIN DEL JUEGO" con la puntuación final, una sola vez; `onLivesChange(0)` se llama antes de `onGameOver`.
- [ ] La estela guarda como máximo 6 muestras, una cada 0,03 s, y cada una se dibuja con opacidad `0,35 × (1 − age / 0,18)`; no hay estela en la espera.
- [ ] Invertir la gravedad crea 6 partículas, recoger un cristal crea 10 y un choque que no termina la partida crea 14; nunca hay más de 64.
- [ ] Una partícula vive 0,3 s y desaparece de la lista al acabar.
- [ ] Un choque con vidas restantes sacude el dibujo durante 0,25 s con amplitud inicial de 8 px y decreciente; `y`, `vy` y las posiciones de la lógica no cambian por la sacudida.
- [ ] Los efectos no llaman a `Math.random`: con `Math.random` fijo en 0, la secuencia de apariciones de obstáculos y cristales es idéntica con y sin efectos.
- [ ] PAUSA congela la invulnerabilidad, el parpadeo, la estela, las partículas y la sacudida; REANUDAR continúa sin saltos.
- [ ] FIN abre el modal "FIN DEL JUEGO" con la puntuación actual, también en la espera (puntuación 0).
- [ ] JUGAR DE NUEVO deja puntuación 0, nivel 1, 3 vidas, velocidad 320 px/s, `invuln` en 0, sin obstáculos, cristales, estela ni partículas, y vuelve a la pantalla de espera.
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras se juega ni durante la espera.
- [ ] Con el modal abierto, ESPACIO no cambia la puntuación y teclear el nombre no mueve el cubo ni arranca la partida.
- [ ] El nombre se pre-rellena desde `localStorage["av_player_name"]`; GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "inversor"` y `user_id: null`.
- [ ] El botón se deshabilita durante el envío: tres clics seguidos insertan una sola fila.
- [ ] Si el insert falla, el modal muestra un error, no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] La puntuación guardada aparece en `/juegos/inversor` y en la pestaña de INVERSOR de `/salon` al recargar.
- [ ] Salir de `/jugar/inversor` y volver no duplica el bucle: los frames por segundo no aumentan tras tres remontajes.
- [ ] El canvas se ve completo sin scroll horizontal a 1440 px y a 768 px de ancho.
- [ ] `app/games/inversor/engine.ts` no contiene `document.` y solo usa `window.` para registrar y quitar `keydown`.
- [ ] Con la clave publishable, el `INSERT` válido en `scores` pasa, los inválidos se rechazan y `UPDATE`/`DELETE` no modifican filas.
- [ ] `/juegos/no-existe` y `/jugar/no-existe` muestran la pantalla 404.
- [ ] Con una clave de Supabase inválida, `/biblioteca` sigue respondiendo 200 y `/jugar/inversor` carga.
- [ ] `/biblioteca` muestra 10 tarjetas y el Home (`/`) sigue con las mismas 6 mini tarjetas.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

- **Sí:** decidido por game-jam a partir del tema «Gravedad invertida»; el usuario no fue consultado. Todas las decisiones de esta spec son propuestas para revisar.
- **Sí:** pantalla de espera dibujada en el canvas, como el texto «PULSA UNA FLECHA» de SERPENTINA (SPEC 09): la plataforma no tiene pantalla de inicio y el motor es lo único que sabe cuándo empezar.
- **No:** arrancar sola, como en la SPEC 10. Con el mundo a 320 px/s el jugador no tiene tiempo de mirar la pantalla al entrar.
- **Sí:** ESPACIO, ↑ y ↓ arrancan y se aplican; ← y → se ignoran porque no son teclas del juego.
- **Sí:** 3 vidas, sin vidas extra. Es la cifra de ASTEROIDES y BLOQUE BUSTER y el HUD ya sabe mostrarla.
- **No:** vidas extra por nivel o por cristales. Son power-ups y otra spec.
- **Sí:** invulnerabilidad de 0,75 s con parpadeo de 80 ms. Un grupo, por ancho que sea, se cruza en 0,33 s a 320 px/s y en 0,16 s a 640 px/s, así que un solo error no se cobra dos veces; además la pareja de pinchos (separados 403 a 576 px) no se cruza entera dentro de la invulnerabilidad: a 640 px/s, 0,75 s son 480 px, menos que los 576 px de separación.
- **No:** invulnerabilidad de 1,5 s. A 640 px/s cubriría 960 px y el segundo pincho de una pareja no costaría nada.
- **Sí:** el último golpe abre el modal de inmediato, sin animación de muerte. La plataforma ya pone el modal, y la animación exigiría que el motor retrasara `onGameOver`.
- **Sí:** los efectos usan un generador propio con semilla fija y no `Math.random`. Mantiene intacta la secuencia de las cinco llamadas de la SPEC 11 y la prueba de comportamiento con aleatorio fijo.
- **Sí:** la sacudida solo se aplica al dibujo, nunca a la lógica. Una sacudida que moviera el cubo cambiaría las colisiones.
- **Sí:** las partículas son cuadrados de 4×4 con un máximo de 64. Mantiene el coste de dibujo constante y el estilo de píxeles del resto del catálogo.
- **Sí:** los efectos avanzan con `dt` en `update`, no con temporizadores, para que PAUSA los congele sin código aparte.
- **No:** sonido ni animación de muerte previa al modal. Quedan fuera de alcance de la game jam.
- **Sí:** esta spec cierra el juego con la verificación completa, no solo con lint y build: es la última que lo toca.

## Riesgos

| Riesgo                                                                                   | Mitigación                                                                                                |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Strict Mode monta el efecto dos veces y duplica el bucle                                 | `destroy()` cancela el frame y quita el listener; criterio de frames por segundo tras tres remontajes     |
| Envíos repetidos al guardar                                                              | `ref` que bloquea al instante; criterio de tres clics seguidos                                            |
| Los efectos cambian la secuencia de obstáculos de las SPEC 10 y 11                       | Generador propio `fxSeed`; criterio de secuencia idéntica con `Math.random` fijo                          |
| Un golpe se cobra dos veces porque el grupo sigue solapado al acabar la invulnerabilidad | Los 0,75 s superan el cruce del grupo más ancho (0,33 s a 320 px/s); criterio de golpe tras 0,75 s        |
| La sacudida desplaza el cubo y cambia las colisiones                                     | Solo se aplica con `translate` al dibujar; criterio de coordenadas de la lógica sin cambios               |
| Muchas partículas bajan los fotogramas por segundo                                       | Máximo de 64 y rectángulos de 4×4; se mide en la captura y en el criterio de frames por segundo           |
| Pausar durante la invulnerabilidad deja el cubo parpadeando para siempre                 | `invuln` solo baja en `update(dt)` y `resume()` pone `lastTime = null`; criterio de PAUSA                 |
| El carácter ↑ del texto de espera no se ve con la fuente monoespaciada del canvas        | Se comprueba la captura y se cambia a «PULSA ESPACIO O FLECHA ARRIBA/ABAJO» sin tocar las reglas          |
| Si Supabase falla, `inversor` no aparece en la Biblioteca porque no tiene ficha local    | Es el comportamiento de ASTEROIDES; criterio de degradación con clave inválida para el resto del catálogo |

## Qué **no** está en esta spec

- Sonido, assets e imágenes.
- Vidas extra, escudos y otros power-ups.
- Animación de muerte previa al modal.
- Controles táctiles, ratón y teclas WASD.
- Ranking por tiempo o donde menos puntos es mejor, y validación de puntuaciones en servidor.
- Cambios en Supabase, en la portada y en los otros juegos.

Cada uno, si llega, va en su propia spec.
