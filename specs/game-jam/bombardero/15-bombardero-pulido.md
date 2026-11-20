# SPEC 15 — Game jam «Bombardero»: BOMBARDERO, pulido y cierre

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06, SPEC 07, SPEC 13, SPEC 14
> **Fecha:** 2026-11-17
> **Objetivo:** Terminar BOMBARDERO con una pantalla de espera, tres vidas con invulnerabilidad tras cada golpe, un cartel de nivel y efectos visuales dibujados en el canvas (partículas, sacudida, avisos de cadena y de mecha), y cerrar el juego con la verificación completa.

## Por qué existe esta spec

La SPEC 13 dejó BOMBARDERO jugable y la SPEC 14 le dio niveles, enemigos y mejoras. Aún tiene tres asperezas. La partida arranca corriendo en cuanto se monta la página, así que el tiempo ya gasta segundos antes de que el jugador mire el tablero; un solo error (una llama o un enemigo) acaba la partida, algo duro con 8 enemigos y alcance 5; y las explosiones, que son el centro del tema, no se notan: no hay respuesta visual al romper bloques, encadenar bombas o recibir un golpe. Esta spec corrige las tres cosas.

Como en las SPEC 13 y 14, no toca Supabase, la portada ni `components.tsx`: solo el motor `app/games/bombardero/engine.ts` y la línea de `bombardero` en `app/games/catalog.ts`, que pasa a mostrar Vidas. Es la última spec del juego, así que termina con la verificación final completa. Sigue la receta de `.claude/skills/add-game/references/pattern.md`.

## Alcance

**Dentro:**

- Pantalla de espera dibujada en el canvas («PULSA UNA FLECHA O ESPACIO») hasta la primera tecla válida, también tras JUGAR DE NUEVO.
- 3 vidas con `onLivesChange` y `hud.vidas: true` en `catalog.ts`; reaparición en `(1, 1)` con invulnerabilidad de 2 s y el jugador parpadeando.
- Cartel «NIVEL n» de 1,2 s al empezar cada nivel a partir del 2, con el mundo congelado.
- Partículas (al romper un bloque, al matar un enemigo y al recibir un golpe), sacudida del dibujo (golpe y cadenas de 2 bombas o más), aviso «×N» en cada cadena de 2 o más, parpadeo de la bomba en el último 0,6 s de su mecha y aviso de tiempo en rojo en los últimos 10 s.
- Un generador pseudoaleatorio propio para los efectos, que no consume `Math.random`.
- Verificación final completa del juego (plataforma, Supabase, degradación, remontajes y anchos de pantalla).
- Mecánicas de las SPEC 13 y 14 sin cambios: tablero, movimiento, bombas, cadena, puntos, enemigos, mejoras, niveles y tiempos. Ninguna constante de equilibrio cambia.

**Fuera de alcance (specs futuras):**

- Sonido, assets e imágenes: los efectos se dibujan con rectángulos y texto del canvas.
- Vidas extra por puntos o por mejoras, y mejoras nuevas.
- Animación de muerte previa al modal: al perder la última vida el modal se abre de inmediato.
- Pantalla de victoria o de «NIVEL SUPERADO» con resumen.
- Controles táctiles o para móvil, ratón y teclas WASD.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cambios en Supabase, en la portada y en los otros juegos.

## Modelo de datos

Esta spec no introduce estructuras en la base de datos: la ficha de la SPEC 13 no cambia.

Entrada del registro (`app/games/catalog.ts`), la única línea que cambia:

```ts
bombardero: { hud: { vidas: true, nivel: true } },
```

Constantes nuevas del motor (las de las SPEC 13 y 14 se conservan):

```ts
const START_LIVES = 3;
const INVULN_S = 2.0; // invulnerabilidad tras un golpe
const BLINK_MS = 100; // el jugador alterna visible/oculto cada 100 ms
const BANNER_S = 1.2; // cartel «NIVEL n»
const FUSE_WARN_S = 0.6; // la bomba parpadea en el último 0,6 s de su mecha
const FUSE_BLINK_MS = 100;
const TIME_WARN_S = 10; // TIEMPO en rojo en los últimos 10 s
const FX_SEED = 12345; // semilla del generador de efectos
const PARTICLE_SIZE = 4;
const PARTICLE_LIFE_S = 0.35;
const PARTICLES_BLOCK = 6;
const PARTICLES_ENEMY = 10;
const PARTICLES_HIT = 14;
const MAX_PARTICLES = 96;
const SHAKE_HIT_S = 0.3;
const SHAKE_HIT_AMP = 8; // px, decae linealmente hasta 0
const SHAKE_CHAIN_S = 0.2;
const SHAKE_CHAIN_AMP = 4; // px, para cadenas de N ≥ 2
const POPUP_S = 0.8;
const POPUP_RISE_PX = 40;
const MAX_POPUPS = 6;
```

Estado nuevo:

```ts
let waiting: boolean; // true hasta la primera tecla válida
let lives: number;
let invuln: number; // segundos de invulnerabilidad que quedan
let banner: number; // segundos de cartel de nivel que quedan
let particles: {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}[];
let popups: { x: number; y: number; n: number; life: number }[]; // aviso «×N»
let shakeT: number; // segundos de sacudida que quedan
let shakeDur: number; // duración total de la sacudida en curso
let shakeAmp: number; // amplitud inicial de la sacudida en curso
let fxSeed: number; // estado del generador de efectos
```

Reglas:

- **Espera:** al montar el motor y tras `restart()`, `waiting = true`. En espera no avanzan `timeLeft`, el jugador, las bombas, las llamas, los enemigos ni los efectos, y se dibuja el tablero del nivel 1 con el jugador en `(1, 1)`. Sobre el centro del canvas se dibuja una banda `#0a0a18` al 80 % de opacidad de 560×60 y el texto `PULSA UNA FLECHA O ESPACIO` en `#e0e0e0`, monoespaciada de 24 px, centrado en `(400, 300)`.
- **Salir de la espera:** la primera pulsación de una flecha o de ESPACIO pone `waiting = false` y se aplica como en las SPEC 13 y 14 (una flecha empieza a mover, ESPACIO pone la primera bomba). Un `keydown` con `repeat: true` no arranca la partida.
- **Cartel de nivel:** al generar un nivel `n ≥ 2` se pone `banner = 1,2`. Mientras `banner > 0` no avanzan `timeLeft`, el jugador, las bombas, las llamas, los enemigos ni los efectos, ESPACIO no pone bombas, las flechas se registran en `held` y se dibuja `NIVEL n` con la misma banda y letra que la espera. `banner` baja con `dt`. El nivel 1 no tiene cartel: lo cubre la espera.
- **Vidas:** `lives = 3` al empezar y tras `restart()`, con `onLivesChange(3)`. Antes eran 0 constante: ahora el HUD las muestra.
- **Golpe:** si el jugador toca una llama o comparte casilla con un enemigo (reglas de las SPEC 13 y 14) y `invuln = 0`: `lives −= 1` y se notifica con `onLivesChange`. Si `lives > 0`: el jugador vuelve a `(1, 1)` con `moveCd = 0` y `held` vacío, `invuln = 2,0`, `shakeT = 0,3` con amplitud 8 y 14 partículas `#4de8ff` en la casilla donde recibió el golpe; las bombas, llamas, enemigos, mejoras, el tiempo y la puntuación no cambian. Si `lives = 0`: se notifica `onLivesChange(0)` y **después** `onGameOver(score)`, una sola vez; la lógica deja de avanzar y no hay animación previa.
- **Invulnerabilidad:** mientras `invuln > 0`, las llamas y los enemigos no matan al jugador, que sigue pudiendo moverse, poner bombas y recoger mejoras; `invuln` baja con `dt`. El jugador se dibuja visible u oculto alternando cada 100 ms y al terminar vuelve a verse. Los golpes que llegan con `invuln = 0` (por ejemplo un enemigo que siga compartiendo casilla al acabar) se cobran de nuevo.
- **Superar el nivel y golpes:** si en un fotograma el jugador recibe un golpe que no es el último y a la vez muere el último enemigo, el golpe prevalece y el nivel se supera en el fotograma siguiente.
- **Tiempo agotado:** pone `lives = 0`, notifica `onLivesChange(0)` y después `onGameOver(score)`. Así el modal abre con el HUD ya a 0 aunque quedaran vidas.
- **Partículas:** cuadrados de 4×4 con vida de 0,35 s, velocidad entre 60 y 180 px/s en dirección aleatoria y opacidad `vida restante / 0,35`. Se emiten 6 `#ff4fd8` en cada bloque destruido, 10 `#ffe14d` en cada enemigo muerto y 14 `#4de8ff` en el golpe al jugador, todas en el centro de la casilla. El máximo es 96: al llegar, se descartan las más antiguas.
- **Sacudida:** `shakeT`, `shakeDur` y `shakeAmp` guardan la sacudida en curso. Una cadena de `N ≥ 2` pone `shakeT = 0,2` con amplitud 4; un golpe pone 0,3 con amplitud 8. Una sacudida nueva solo sustituye a la actual si su amplitud inicial es mayor que la restante. Mientras `shakeT > 0`, todo el dibujo del canvas se desplaza `(fx × a, fx × a)` con `a = shakeAmp × shakeT / shakeDur` y `fx` aleatorio en −1…1 del generador de efectos. Solo afecta al dibujo, nunca a las coordenadas de la lógica.
- **Aviso de cadena:** cada cadena de `N ≥ 2` crea un aviso `×N` en el centro de la casilla de la primera bomba detonada, que sube 40 px en 0,8 s mientras se atenúa, dibujado en `#ffe14d`, monoespaciada de 24 px. El máximo es 6: al llegar, se descarta el más antiguo.
- **Mecha:** en los últimos 0,6 s de `fuse`, la bomba alterna entre `#e0e0e0` y `#ff4fd8` cada 100 ms (según `floor(fuse × 1000 / 100)`); es una función del estado, sin variables nuevas.
- **Tiempo:** con `timeLeft ≤ 10`, `TIEMPO n` se dibuja en `#ff4fd8` en lugar de `#e0e0e0`.
- **Generador de efectos:** `fxSeed = (fxSeed × 1664525 + 1013904223) >>> 0`, valor `fxSeed / 2³²`, con semilla `12345`, que se restablece en `restart()`. Los efectos **no** llaman a `Math.random`, para que el orden de las llamadas de las SPEC 13 y 14 (bloques, enemigos, mejoras y pasos de enemigos) no cambie.
- **Pausa:** `invuln`, el parpadeo, el cartel, las partículas, los avisos y la sacudida avanzan solo con `update(dt)`, así que se congelan con PAUSA y no saltan al REANUDAR.
- **Callbacks:** `onLivesChange` solo cuando `lives` cambia (3 al empezar, 2, 1 y 0); `onGameOver(score)` una sola vez y después de notificar las vidas, para que el modal abra con el HUD ya a 0.

Convenciones: las de las SPEC 13 y 14 (canvas 800×600, tiempos en segundos, `dt` ≤ 50 ms, casillas de 40 px con origen en `(20, 40)`).

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas" y la sección 8, "Verificación"), la sección 6 de `.claude/skills/add-game/references/porting.md` y las SPEC 13 y 14, y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components y Cache Components, según exige `AGENTS.md`.

1. **Espera y cartel de nivel.** En `engine.ts`, añadir `waiting` y `banner`, sus dibujos y la salida de la espera con una flecha o ESPACIO; limpiar en `restart()`. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, el smoke del motor y, en el navegador, el tiempo no corre hasta la primera tecla, JUGAR DE NUEVO vuelve a la espera y al superar el nivel 1 aparece «NIVEL 2» durante 1,2 s con el mundo quieto.
2. **Vidas e invulnerabilidad.** Añadir `lives`, `invuln`, el parpadeo, la reaparición y el fin por última vida o por tiempo, y poner `vidas: true` en `bombardero` dentro de `catalog.ts`. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, la prueba de comportamiento con `Math.random` fijo (tres golpes seguidos, separados más de 2 s, dejan las vidas en 2, 1 y 0 y abren el modal una vez) y en el navegador el HUD muestra Vidas.
3. **Efectos.** Añadir el generador `fxSeed`, las partículas, la sacudida, los avisos `×N`, el parpadeo de la mecha y el aviso de tiempo, todos avanzados con `dt` o calculados del estado. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y la captura de una partida con partículas y un aviso `×2` visibles; comprobar que la secuencia de generación con `Math.random` fijo es idéntica a la de las SPEC 13 y 14.
4. **Cierre completo.** `npm run lint`, `npm run build` sin trazas de error, `get_advisors` de seguridad sin avisos, `node .claude/skills/add-game/scripts/rls-check.mjs bombardero`, tres remontajes con medición de frames por segundo, capturas a 1440 px y a 768 px, `/juegos/no-existe` y `/jugar/no-existe`, `npm run build` con `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=invalida` (y `/biblioteca` en 200), y una partida completa hasta verla en `/juegos/bombardero` y en la pestaña de BOMBARDERO de `/salon`. Borrar todas las filas de prueba de `scores`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `catalog.ts` declara `bombardero: { hud: { vidas: true, nivel: true } }` y el HUD de la plataforma muestra Puntuación, Vidas y Nivel.
- [ ] No hay cambios en `supabase/migrations/`, en `app/globals.css` ni en `app/games/components.tsx`.
- [ ] Al montar el juego se ve «PULSA UNA FLECHA O ESPACIO», el tablero con el jugador en `(1, 1)` y `TIEMPO` en 150; el tiempo, los enemigos y la puntuación no cambian mientras no se pulsa una tecla.
- [ ] Una flecha y ESPACIO arrancan la partida y el texto desaparece; la primera pulsación se aplica (ESPACIO pone una bomba, una flecha mueve); un `keydown` con `repeat: true` no la arranca.
- [ ] Con PAUSA activa durante la espera, REANUDAR vuelve a la espera sin avanzar nada.
- [ ] Al superar el nivel 1 aparece «NIVEL 2» durante 1,2 s (±1 fotograma); durante el cartel no avanzan el tiempo, los enemigos ni el jugador, ESPACIO no pone bombas y las flechas pulsadas se aplican al terminar.
- [ ] El nivel 1 no muestra cartel de nivel.
- [ ] El HUD muestra 3 vidas al empezar y `onLivesChange` se llama con 3, 2, 1 y 0 sin repetir valores.
- [ ] Un golpe (llama o enemigo) con `invuln = 0` resta una vida, devuelve al jugador a `(1, 1)`, deja `invuln = 2,0` y no abre el modal mientras queden vidas.
- [ ] El golpe no cambia las bombas, llamas, enemigos, mejoras, puntuación ni el tiempo.
- [ ] Durante los 2,0 s de invulnerabilidad un segundo golpe no resta vida; pasados 2,0 s, un golpe nuevo sí.
- [ ] El jugador alterna visible y oculto cada 100 ms durante la invulnerabilidad y vuelve a verse siempre al terminar.
- [ ] Durante la invulnerabilidad el jugador puede poner bombas, moverse y recoger mejoras.
- [ ] Perder la tercera vida deja las vidas del HUD en 0 y abre el modal "FIN DEL JUEGO" con la puntuación final, una sola vez; `onLivesChange(0)` se llama antes de `onGameOver`.
- [ ] Al agotarse `TIEMPO` con vidas restantes, el HUD pasa a 0 vidas y se abre el modal con la puntuación actual, una sola vez.
- [ ] Si en un mismo fotograma hay un golpe que no es el último y muere el último enemigo, el nivel se supera en el fotograma siguiente.
- [ ] Cada bloque destruido crea 6 partículas, cada enemigo muerto crea 10 y un golpe al jugador crea 14; nunca hay más de 96.
- [ ] Una partícula vive 0,35 s y desaparece de la lista al acabar.
- [ ] Un golpe sacude el dibujo durante 0,3 s con amplitud inicial de 8 px y decreciente; una cadena de `N ≥ 2` lo sacude 0,2 s con amplitud inicial de 4 px; una sacudida nueva solo sustituye a la actual si su amplitud inicial es mayor que la restante.
- [ ] La sacudida no cambia `px`, `py`, las casillas de enemigos, bombas y llamas ni ninguna coordenada de la lógica.
- [ ] Una cadena de `N ≥ 2` crea un aviso `×N` que sube 40 px en 0,8 s y desaparece; una de `N = 1` no crea ninguno; nunca hay más de 6 avisos.
- [ ] En los últimos 0,6 s de su mecha, la bomba alterna de color cada 100 ms.
- [ ] Con `timeLeft ≤ 10`, `TIEMPO n` se dibuja en `#ff4fd8`; antes se dibuja en `#e0e0e0`.
- [ ] Los efectos no llaman a `Math.random`: con `Math.random` fijo en 0, la secuencia de bloques, enemigos y mejoras es idéntica con y sin efectos.
- [ ] PAUSA congela la invulnerabilidad, el parpadeo, el cartel, las partículas, los avisos y la sacudida; REANUDAR continúa sin saltos.
- [ ] FIN abre el modal "FIN DEL JUEGO" con la puntuación actual, también en la espera (puntuación 0).
- [ ] JUGAR DE NUEVO deja puntuación 0, nivel 1, 3 vidas, `timeLeft = 150`, `maxBombs = 2`, `range = 2`, `invuln` en 0, sin partículas ni avisos, un tablero nuevo, y vuelve a la pantalla de espera.
- [ ] Las puntuaciones, mecha de 2,0 s, alcance, cadenas `10 × N` y `100 × N`, niveles, enemigos y mejoras de las SPEC 13 y 14 no han cambiado.
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras se juega ni durante la espera.
- [ ] Con el modal abierto, ESPACIO no cambia la puntuación y teclear el nombre no mueve al jugador, no pone bombas ni arranca la partida.
- [ ] El nombre se pre-rellena desde `localStorage["av_player_name"]`; GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "bombardero"` y `user_id: null`.
- [ ] El botón se deshabilita durante el envío: tres clics seguidos insertan una sola fila.
- [ ] Si el insert falla, el modal muestra un error, no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] La puntuación guardada aparece en `/juegos/bombardero` y en la pestaña de BOMBARDERO de `/salon` al recargar.
- [ ] Salir de `/jugar/bombardero` y volver no duplica el bucle: los frames por segundo no aumentan tras tres remontajes.
- [ ] El canvas se ve completo sin scroll horizontal a 1440 px y a 768 px de ancho.
- [ ] `app/games/bombardero/engine.ts` no contiene `document.` y solo usa `window.` para registrar y quitar `keydown`, `keyup` y `blur`.
- [ ] Con la clave publishable, el `INSERT` válido en `scores` pasa, los inválidos se rechazan y `UPDATE`/`DELETE` no modifican filas.
- [ ] `/juegos/no-existe` y `/jugar/no-existe` muestran la pantalla 404.
- [ ] Con una clave de Supabase inválida, `/biblioteca` sigue respondiendo 200 y `/jugar/bombardero` carga.
- [ ] `/biblioteca` muestra una tarjeta más que antes de la SPEC 13 (10 con el catálogo actual) y el Home (`/`) sigue con las mismas 6 mini tarjetas.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

- **Sí:** decidido por game-jam a partir del tema "Bombardero"; el usuario no fue consultado. Todas las decisiones de esta spec son propuestas para revisar.
- **Sí:** pantalla de espera dibujada en el canvas, como el texto «PULSA UNA FLECHA» de SERPENTINA (SPEC 09): la plataforma no tiene pantalla de inicio y el motor es lo único que sabe cuándo empezar.
- **No:** arrancar sola, como en las SPEC 13 y 14. El tiempo corre desde el primer fotograma y el jugador no tiene ocasión de mirar el tablero.
- **Sí:** la primera tecla arranca y se aplica. Evita una pulsación perdida y es el comportamiento de la espera de INVERSOR (SPEC 12).
- **Sí:** cartel «NIVEL n» de 1,2 s con el mundo quieto desde el nivel 2. Sin él, un tablero nuevo con enemigos más rápidos y el tiempo ya corriendo castiga al jugador por algo que no vio.
- **No:** cartel también en el nivel 1. La pantalla de espera ya cumple esa función.
- **Sí:** 3 vidas, sin vidas extra. Es la cifra de ASTEROIDES y BLOQUE BUSTER y el HUD ya sabe mostrarla; esta spec **cambia** la regla de «muerte inmediata» de las SPEC 13 y 14.
- **No:** vidas extra por puntos o por mejoras. Son otra mecánica y otra spec.
- **Sí:** el golpe devuelve al jugador a `(1, 1)` y deja intacto el resto del tablero. Castiga por el tiempo y la posición perdidos sin deshacer lo conseguido.
- **Sí:** invulnerabilidad de 2,0 s con parpadeo de 100 ms. Una llama dura 0,5 s y un enemigo cruza una casilla en 0,25 a 0,5 s, así que 2 s dan tiempo de salir de ambos sin regalar una partida sin riesgo.
- **No:** invulnerabilidad de 3 s o más. Con el tiempo en marcha, esperar pasaría a ser una estrategia.
- **Sí:** el tiempo agotado pierde todas las vidas y notifica 0 antes de `onGameOver`. El modal abre con el HUD ya a 0, como pide el patrón, y un tiempo agotado es un fin de partida, no una vida perdida.
- **No:** quitar una vida y reiniciar el reloj al agotarse el tiempo. Añade un estado más y alargaría las partidas más allá de 5 minutos.
- **Sí:** un golpe prevalece sobre superar el nivel en el mismo fotograma, que se supera en el siguiente. Evita decidir entre dos eventos simultáneos y no pierde la bonificación.
- **Sí:** el último golpe abre el modal de inmediato, sin animación de muerte. La plataforma ya pone el modal, y la animación exigiría que el motor retrasara `onGameOver`.
- **Sí:** los efectos usan un generador propio con semilla fija y no `Math.random`. Mantiene intacta la secuencia de llamadas de las SPEC 13 y 14 y la prueba de comportamiento con aleatorio fijo.
- **Sí:** la sacudida solo se aplica al dibujo, nunca a la lógica. Una sacudida que moviera al jugador cambiaría las colisiones.
- **Sí:** el aviso `×N` para cadenas de 2 o más y la sacudida de 4 px en ellas. El tema es la cadena y es la acción que más conviene que el jugador note.
- **Sí:** el parpadeo de la mecha y el aviso de tiempo se calculan del estado, sin variables nuevas, y se congelan solos con PAUSA.
- **Sí:** las partículas son cuadrados de 4×4 con un máximo de 96. Mantiene el coste de dibujo constante y el estilo de píxeles del resto del catálogo.
- **Sí:** ninguna constante de equilibrio cambia respecto a las SPEC 13 y 14. Con 3 vidas y 2 s de invulnerabilidad la dificultad con alcance 5 y 5 bombas queda compensada, que era el riesgo anotado en la SPEC 14; si la partida completa muestra lo contrario, se corrige en otra spec.
- **No:** sonido ni animación de muerte previa al modal. Quedan fuera de alcance de la game jam.
- **Sí:** esta spec cierra el juego con la verificación completa, no solo con lint y build: es la última que lo toca.

## Riesgos

| Riesgo                                                                                            | Mitigación                                                                                                                         |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Strict Mode monta el efecto dos veces y duplica el bucle                                          | `destroy()` cancela el frame y quita `keydown`, `keyup` y `blur`; criterio de frames por segundo tras tres remontajes              |
| Envíos repetidos al guardar                                                                       | `ref` que bloquea al instante; criterio de tres clics seguidos                                                                     |
| Los efectos cambian la secuencia de bloques, enemigos o mejoras de las SPEC 13 y 14               | Generador propio `fxSeed`; criterio de secuencia idéntica con `Math.random` fijo                                                   |
| Al reaparecer, un enemigo sigue compartiendo casilla con el jugador al acabar la invulnerabilidad | Se cobra un golpe nuevo, que es el comportamiento buscado: el jugador tiene 2 s para moverse                                       |
| Un golpe se cobra dos veces en el mismo fotograma (llama y enemigo a la vez)                      | Solo se resta una vida por fotograma; criterio de golpe con `invuln = 0`                                                           |
| La sacudida desplaza al jugador y cambia las colisiones                                           | Solo se aplica con `translate` al dibujar; criterio de coordenadas de la lógica sin cambios                                        |
| Muchas partículas y avisos bajan los fotogramas por segundo                                       | Máximo de 96 partículas y 6 avisos, rectángulos de 4×4; se mide en la captura y en el criterio de frames por segundo               |
| Pausar durante la invulnerabilidad o el cartel los deja avanzando o parpadeando para siempre      | `invuln` y `banner` solo bajan en `update(dt)` y `resume()` pone `lastTime = null`; criterio de PAUSA                              |
| El motor supera de largo las 500 líneas con las tres specs                                        | Los efectos son funciones pequeñas que se calculan del estado; si pasa de unas 600, se anota para una refactorización en otra spec |
| Si Supabase falla, `bombardero` no aparece en la Biblioteca porque no tiene ficha local           | Es el comportamiento de ASTEROIDES; criterio de degradación con clave inválida para el resto del catálogo                          |

## Qué **no** está en esta spec

- Sonido, assets e imágenes.
- Vidas extra, mejoras nuevas y bombas de control remoto.
- Animación de muerte previa al modal y pantalla de «NIVEL SUPERADO» con resumen.
- Enemigos que persigan o esquiven bombas, y multijugador.
- Controles táctiles, ratón y teclas WASD.
- Ranking por tiempo o donde menos puntos es mejor, y validación de puntuaciones en servidor.
- Cambios en Supabase, en la portada y en los otros juegos.

Cada uno, si llega, va en su propia spec.
