# SPEC 20 — Game jam «Eco en la oscuridad»: SONAR, pulido y cierre

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06, SPEC 07, SPEC 16, SPEC 18, SPEC 19
> **Fecha:** 2026-11-18
> **Objetivo:** Terminar SONAR con una pantalla de espera, tres vidas con invulnerabilidad tras cada mina, un aviso de proximidad, efectos visuales dibujados en el canvas (estela de burbujas, partículas, sacudida, eco con estela y avisos) y cerrar el juego con la verificación completa.

## Por qué existe esta spec

La SPEC 18 dejó SONAR jugable y la SPEC 19 le dio niveles, minas a la deriva y el premio por el silencio. Aún tiene tres asperezas. La partida arranca corriendo en cuanto se monta la página, así que el aire ya gasta segundos antes de que el jugador sepa dónde está; una sola mina invisible acaba la inmersión, algo duro con 11 minas, 4 de ellas a la deriva; y el juego casi no responde a lo que hace el jugador: el ping es un trazo fino, recoger una perla no se nota y chocar con una mina es un corte seco. Esta spec corrige las tres cosas.

Como en las SPEC 18 y 19, no toca Supabase, la portada ni `components.tsx`: solo el motor `app/games/sonar/engine.ts` y la línea de `sonar` en `app/games/catalog.ts`, que pasa a mostrar Vidas. Es la última spec del juego, así que termina con la verificación final completa. Sigue la receta de `.claude/skills/add-game/references/pattern.md`.

## Alcance

**Dentro:**

- Pantalla de espera dibujada en el canvas («PULSA UNA FLECHA O ESPACIO PARA SUMERGIRTE») hasta la primera tecla válida, también tras JUGAR DE NUEVO.
- 3 vidas con `onLivesChange` y `hud.vidas: true` en `catalog.ts`; tras tocar una mina, el submarino reaparece en `(450, 350)` con invulnerabilidad de 2 s y parpadeando, y la mina queda iluminada.
- Aviso de proximidad: una mina invisible a menos de 90 px del submarino se dibuja como un contorno tenue.
- Cartel «NIVEL n» de 1,2 s al subir de nivel, sin congelar el juego.
- Indicador del enfriamiento del ping alrededor del submarino y aire en rojo parpadeante en los últimos 10 s.
- Estela de burbujas, partículas (al recoger una perla y al chocar con una mina), sacudida del dibujo al chocar, estela doble en el anillo del ping y avisos flotantes de los puntos.
- Un generador pseudoaleatorio propio para los efectos, que no consume `Math.random`.
- Verificación final completa del juego (plataforma, Supabase, degradación, remontajes y anchos de pantalla).
- Mecánicas de las SPEC 18 y 19 sin cambios salvo las reglas de vidas y de espera de esta spec.

**Fuera de alcance (specs futuras):**

- Sonido, assets e imágenes: los efectos se dibujan con formas y texto del canvas.
- Vidas extra por puntos o por objetos, y objetos nuevos.
- Animación de muerte previa al modal: al perder la última vida el modal se abre de inmediato.
- Pantalla de resumen o de récords en el juego.
- Controles distintos de los de la SPEC 18, teclas WASD y ratón.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cambios en Supabase, en la portada y en los otros juegos.

## Modelo de datos

Esta spec no introduce estructuras en la base de datos: la ficha de la SPEC 18 no cambia.

Entrada del registro (`app/games/catalog.ts`), la única línea que cambia: `hud.vidas` pasa a `true` y `controles` se conserva igual.

```ts
sonar: { hud: { vidas: true, nivel: true }, controles: [/* sin cambios */] },
```

Constantes nuevas del motor (las de las SPEC 18 y 19 se conservan):

```ts
const START_LIVES = 3;
const INVULN_S = 2.0; // invulnerabilidad tras tocar una mina
const BLINK_S = 0.1; // el submarino alterna visible/oculto cada 0,1 s
const HIT_REVEAL_S = 2.0; // la mina que golpeó queda iluminada
const PROX_R = 90; // px: aviso de proximidad
const PROX_ALPHA = 0.25;
const BANNER_S = 1.2; // cartel «NIVEL n»
const O2_WARN_S = 10; // aire en rojo parpadeante
const FX_SEED = 20261118; // semilla del generador de efectos
const BUBBLE_EVERY_S = 0.08;
const BUBBLE_LIFE_S = 0.6;
const BUBBLE_RISE = 20; // px/s
const PEARL_PARTICLES = 8;
const HIT_PARTICLES = 14;
const PARTICLE_LIFE_S = 0.4;
const PARTICLE_SPEED = 120; // px/s
const MAX_PARTICLES = 96;
const SHAKE_S = 0.3;
const SHAKE_AMP = 8; // px, decae linealmente hasta 0
const POPUP_S = 0.8;
const POPUP_RISE_PX = 40;
const MAX_POPUPS = 6;
const ECHO_TRAIL = [30, 60]; // anillos de estela a 30 y 60 px por detrás del frente
```

Estado nuevo:

```ts
let waiting: boolean; // true hasta la primera tecla válida
let lives: number;
let invuln: number; // segundos de invulnerabilidad que quedan
let banner: number; // segundos de cartel de nivel que quedan
let clock: number; // segundos de juego acumulados, para parpadeos (se detiene en pausa y en espera)
let shake: number; // segundos de sacudida que quedan
let particles: {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  kind: "bubble" | "pearl" | "hit";
}[];
let popups: { x: number; y: number; text: string; life: number }[];
let bubbleCd: number; // segundos hasta la siguiente burbuja
let fxState: number; // estado del generador de efectos
```

Reglas:

- **Espera:** al empezar y tras `restart()`, `waiting = true`. Mientras espera, `update` no hace nada (el aire, el enfriamiento, las minas a la deriva y los `reveal` no avanzan), el submarino está en `(450, 350)` y se dibuja el texto de espera centrado en `(400, 330)`, monoespaciada de 20 px `#e0e0e0`. La primera flecha o ESPACIO (`keydown` con `repeat: false`) pone `waiting = false`; ESPACIO que inicia la partida **no** emite ping y una flecha que inicia la partida sí empieza a mover el submarino. `pause()` y `resume()` no alteran `waiting`.
- **Vidas:** `lives = 3` al empezar y tras `restart()`, con `onLivesChange(3)`. En el paso 5 de `update` (mina), si el submarino toca una mina y `invuln ≤ 0`: `lives` baja 1 y se notifica; el submarino vuelve a `(450, 350)`, `invuln = 2,0` y `held` se vacía; la mina que golpeó recibe `reveal = 2,0`; si `lives` llega a 0, se notifica `onLivesChange(0)` y después `onGameOver(score)` (una sola vez). Con `invuln > 0` las minas no hacen nada y el submarino puede atravesarlas.
- **Invulnerabilidad:** `invuln` baja con `dt`. Mientras `> 0`, el submarino se dibuja solo si `floor(clock / 0,1)` es par. Las perlas se recogen con normalidad.
- **Aire:** al llegar a 0 la partida termina directamente, sin consumir vidas, como en la SPEC 18. `onLivesChange` no se llama de nuevo.
- **Proximidad:** una mina con `reveal ≤ 0` y a una distancia `≤ 90` del submarino se dibuja como un contorno de 2 px `#ff4f6a` a opacidad 0,25, sin relleno ni púas. No cambia `reveal` ni la colisión. Con `reveal > 0` se dibuja normal. La perla no tiene aviso de proximidad.
- **Cartel de nivel:** al subir de nivel, `banner = 1,2`; se dibuja `NIVEL n` en monoespaciada de 24 px `#5dff8a` centrado en `(400, 80)`. No congela el juego.
- **Aire en rojo:** con `o2 ≤ 10` la barra de `AIRE` se rellena de `#ff4f6a` y parpadea con `floor(clock / 0,2)` par.
- **Indicador del ping:** si `pingCd > 0` se dibuja alrededor del submarino un arco de radio 20 y 2 px `#5dff8a` que cubre la fracción `1 − pingCd / 1,5` de la circunferencia, empezando arriba; con `pingCd = 0` se dibuja la circunferencia completa a opacidad 0,3.
- **Anillo del ping:** además del frente (3 px), se dibujan dos anillos de estela de radios `r − 30` y `r − 60` (solo si son `> 0`) con 2 px y opacidades 0,5 y 0,25 veces la del frente. Es solo dibujo: el reveal solo usa `r`.
- **Estela de burbujas:** mientras el submarino se mueve (alguna flecha mantenida y la partida activa), cada 0,08 s nace una burbuja en `(sx, sy)` con un desplazamiento horizontal aleatorio de ±6 px del generador de efectos; sube a 20 px/s, vive 0,6 s, es un círculo de radio 2 `#5dff8a` con opacidad `life / 0,6 × 0,5`. Sin ningún efecto sobre la jugabilidad.
- **Partículas de perla y de choque:** al recoger una perla nacen 8 partículas `#ffe14d` en su posición, en ángulos `i × 2π / 8` a 120 px/s, de 4×4 px y 0,4 s de vida. Al tocar una mina (sin invulnerabilidad) nacen 14 partículas `#ff4f6a` en ángulos aleatorios del generador de efectos, con la misma velocidad y vida. El total no pasa de 96: si no hay sitio, se descartan las nuevas.
- **Sacudida:** al chocar con una mina, `shake = 0,3`; el dibujo de ese fotograma se traslada `(dx, dy)` con `dx` y `dy` aleatorios del generador en `[−1, 1] × 8 × shake / 0,3` px. No afecta a la lógica.
- **Avisos flotantes:** al recoger una perla nace un texto con los puntos (`+100`, `+150`, `+200`, `+300`) en su posición; sube 40 px en 0,8 s y se desvanece. Si hubo silencio, el texto es `+200 SILENCIO` o `+300 SILENCIO`. Máximo 6 a la vez.
- **Generador de efectos:** `mulberry32` con semilla `FX_SEED`, propio del motor, reiniciado en cada `restart()` y que **no** consume `Math.random`. La prueba con aleatorio fijo de las SPEC 18 y 19 sigue dando los mismos resultados de mar y puntos.
- **Reloj y pausa:** `clock`, las burbujas, partículas, avisos, la sacudida y el cartel avanzan solo dentro de `update` y se congelan en pausa y en espera. No se usa `performance.now()` en los efectos.
- **Orden de un fotograma (`update(dt)`):** (1) reloj, aire, enfriamiento, invulnerabilidad, cartel y `reveal`; (2) mover el submarino; (3) mover las minas a la deriva; (4) avanzar el anillo y revelar; (5) mina (con vidas); (6) perlas, nivel y mina nueva; (7) aire agotado; (8) efectos (burbujas, partículas, avisos, sacudida). Al terminar la partida, las siguientes no se evalúan salvo los efectos, que siguen dibujándose.
- **Equilibrio:** ninguna constante de las SPEC 18 y 19 cambia. El aviso de proximidad (90 px, 0,5 s de nado) y las vidas son los únicos cambios de dificultad.

Dibujo: lo de las SPEC 18 y 19 más lo anterior. El mar sigue sin luz: las perlas, las minas y las minas a la deriva solo aparecen por su `reveal` o por la proximidad de una mina. Sin puntuación, nivel, vidas ni «GAME OVER» dibujados salvo los textos propios del juego.

Convenciones: las de la SPEC 18.

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas") y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components, según exige `AGENTS.md`.

1. **Pantalla de espera.** Añadir `waiting`, el texto y el inicio con la primera tecla (ESPACIO sin ping). Verificar: `npx tsc --noEmit`, `npx eslint app/games`, el smoke del motor y, en el navegador, que el aire no baja hasta pulsar una tecla y que JUGAR DE NUEVO vuelve a la espera.
2. **Vidas.** Añadir `lives`, `invuln`, la reaparición, `reveal` de la mina golpeada, el parpadeo y `hud.vidas: true` en `catalog.ts`. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y la prueba de comportamiento escrita fuera del repo con `Math.random` fijo en 0 (sección 8 de `pattern.md`): nadar hacia arriba desde `(450, 350)` toca la mina de `(450, 50)` a los 1,7125 s ±1 fotograma, `lives` pasa a 2 y el submarino vuelve a `(450, 350)`; tras tres golpes se llama `onLivesChange(0)` y después `onGameOver` una sola vez.
3. **Avisos del juego.** Añadir el aviso de proximidad, el cartel de nivel, el aire en rojo y el indicador del ping. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y la captura de cada aviso en el navegador.
4. **Efectos.** Añadir el generador de efectos, las burbujas, las partículas, la sacudida, los avisos flotantes y los anillos de estela. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, que el hash de `engine-perf.mjs --trace` de los pasos 2 y 3 no cambia al añadir los efectos y que el motor sigue sin consumir `Math.random` en ellos (la prueba con aleatorio fijo no cambia).
5. **Equilibrio.** Jugar 3 partidas completas y comprobar que la duración típica queda entre 1 y 5 minutos; si no, anotarlo como pendiente en la spec (ninguna constante se cambia sin dejarlo escrito aquí).
6. **Cierre.** Verificación final completa: `npm run lint`, `npm run build` sin trazas de error, `get_advisors` de seguridad sin avisos, `node .claude/skills/add-game/scripts/rls-check.mjs sonar`, `node --expose-gc .claude/skills/add-game/scripts/engine-perf.mjs app/games/sonar/engine.ts createSonar` sin fugas tras `restart()` y `destroy()`, prueba de degradación con clave inválida (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=invalida npm run build` y `npx next start -p 3200`; después reconstruir con la clave real), una partida completa visible en `/juegos/sonar` y en la pestaña de SONAR de `/salon`, y los criterios de plataforma de abajo. Borrar todas las filas de prueba de `scores` (incluida `RLSTEST`).

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores ni trazas de error.
- [ ] El HUD de `/jugar/sonar` muestra Puntuación, Vidas y Nivel; al empezar, Vidas 3 y Nivel 1.
- [ ] Al montar `/jugar/sonar` y tras JUGAR DE NUEVO, el canvas muestra «PULSA UNA FLECHA O ESPACIO PARA SUMERGIRTE» y el aire, el enfriamiento y las minas a la deriva no avanzan hasta la primera tecla.
- [ ] ESPACIO como primera tecla inicia la partida sin emitir ping; una flecha como primera tecla inicia la partida y mueve el submarino.
- [ ] Tocar una mina sin invulnerabilidad resta una vida, devuelve el submarino a `(450, 350)`, lo hace invulnerable 2,0 s (±1 fotograma) y deja la mina iluminada 2,0 s.
- [ ] Con invulnerabilidad el submarino parpadea cada 0,1 s y atravesar una mina no resta vida ni termina la partida.
- [ ] Al perder la tercera vida se llama `onLivesChange(0)` y después `onGameOver`, una sola vez, y el modal "FIN DEL JUEGO" se abre con el HUD ya en Vidas 0.
- [ ] El aire agotado termina la partida directamente, sin restar vidas.
- [ ] Una mina invisible a 90 px o menos del submarino se dibuja como contorno de opacidad 0,25; a más de 90 px sigue sin dibujarse; la perla no tiene aviso; y el aviso no cambia la colisión.
- [ ] Al subir de nivel aparece «NIVEL n» durante 1,2 s (±1 fotograma) sin detener el juego.
- [ ] Con `AIRE ≤ 10 s` la barra es roja y parpadea cada 0,2 s.
- [ ] Alrededor del submarino se dibuja un arco que muestra el enfriamiento del ping, completo y tenue cuando se puede emitir.
- [ ] El anillo del ping muestra dos anillos de estela a 30 y 60 px del frente y el reveal sigue dependiendo solo del radio del frente.
- [ ] Mientras el submarino se mueve nace una burbuja cada 0,08 s; ninguna dura más de 0,6 s y no hay más de 96 partículas en total.
- [ ] Al recoger una perla nacen 8 partículas amarillas y sube un texto con los puntos (`+100`, `+150`, `+200`, `+300` o con `SILENCIO`); al chocar con una mina nacen 14 partículas rosas y el dibujo se sacude 0,3 s con una amplitud inicial de 8 px.
- [ ] Los efectos no consumen `Math.random`: con `Math.random` fijo en 0 el mar y las puntuaciones son idénticos a los de las SPEC 18 y 19.
- [ ] PAUSA congela el reloj, las burbujas, las partículas, los avisos, la sacudida, el cartel y la invulnerabilidad; REANUDAR continúa sin saltos.
- [ ] Las constantes de equilibrio de las SPEC 18 y 19 (velocidades, aire, ping, minas, puntos) no han cambiado.
- [ ] `onScoreChange`, `onLivesChange`, `onLevelChange` y `onGameOver` solo se llaman cuando el valor cambia, y `onGameOver` una sola vez y después de notificar vidas.
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras se juega.
- [ ] PAUSA muestra "EN PAUSA"; FIN abre el modal con la puntuación actual; con el modal abierto, ESPACIO no cambia la puntuación y teclear el nombre no mueve el submarino ni emite pings.
- [ ] El nombre se pre-rellena desde `localStorage["av_player_name"]`; GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "sonar"` y `user_id: null`; tres clics seguidos insertan una sola fila.
- [ ] Si el insert falla, el modal muestra un error, no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] La puntuación guardada aparece en `/juegos/sonar` y en la pestaña de SONAR de `/salon` al recargar.
- [ ] JUGAR DE NUEVO deja puntuación 0, Vidas 3, Nivel 1, aire completo, la pantalla de espera y un mar nuevo.
- [ ] Salir de `/jugar/sonar` y volver no duplica el bucle: los frames por segundo no aumentan tras tres remontajes.
- [ ] `engine-perf.mjs` no detecta fugas tras `restart()` ni `destroy()`.
- [ ] El canvas se ve completo sin scroll horizontal a 1440 px y a 768 px de ancho.
- [ ] El mando táctil de la SPEC 18 sigue funcionando con `(pointer: coarse)` y la primera pulsación sobre él inicia la partida.
- [ ] `app/games/sonar/engine.ts` no contiene `document.` y solo usa `window.` para registrar y quitar `keydown`, `keyup` y `blur`.
- [ ] Con la clave publishable, el `INSERT` válido en `scores` pasa, los inválidos se rechazan y `UPDATE`/`DELETE` no modifican filas.
- [ ] `/juegos/no-existe` y `/jugar/no-existe` muestran la pantalla 404.
- [ ] Con una clave de Supabase inválida, `/biblioteca` sigue respondiendo 200 y `/jugar/sonar` carga.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

- **Sí:** decidido por game-jam a partir del tema "Eco en la oscuridad"; el usuario no fue consultado. Todas las decisiones de esta spec son propuestas para revisar.
- **Sí:** pantalla de espera dibujada en el canvas. El aire corre desde el primer fotograma y la plataforma no tiene un estado de "listo"; el jugador necesita ver dónde está antes de que el aire gaste.
- **Sí:** ESPACIO que inicia la partida no emite ping. Un ping involuntario al empezar gastaría el enfriamiento y el silencio de la primera perla.
- **Sí:** 3 vidas, con reaparición en el centro, 2 s de invulnerabilidad y la mina golpeada iluminada 2 s. Quien muere aprende dónde estaba la mina, que es el tema: el golpe también es un eco.
- **No:** que el aire agotado reste una vida. Es el límite de tiempo del juego; si no acabara la partida, se podría sobrevivir indefinidamente con vidas.
- **No:** vidas extra por puntos. Cambia el equilibrio y no hace falta para terminar el juego.
- **Sí:** aviso de proximidad de 90 px con opacidad 0,25. Da 0,5 s de reacción a 160 px/s sin revelar la mina, así que sigue siendo un juego de memoria y suma justicia al cambiar un golpe invisible por una decisión. Es el único cambio de dificultad de la spec.
- **No:** que las perlas tengan aviso de proximidad: sería una ayuda de recogida que anula el eco.
- **Sí:** el cartel «NIVEL n» no congela el juego. La plataforma ya muestra el nivel; el cartel solo avisa de que hay una mina nueva y el eco es más corto, y congelar gastaría el aire.
- **Sí:** estela de burbujas, partículas, sacudida, avisos flotantes y anillos de estela con un generador propio sembrado y fuera de `Math.random`. Así los efectos no alteran el mar ni la prueba con aleatorio fijo, y `engine-perf` puede comparar el hash de jugabilidad.
- **Sí:** el reloj de los efectos avanza dentro de `update` y no con `performance.now()`. Así la pausa congela parpadeos y animaciones sin saltos.
- **No:** sombras (`shadowBlur`) para el brillo del anillo. Cuestan fotogramas en equipos modestos y la estela de dos anillos da el mismo efecto con trazos simples.
- **Sí:** tope de 96 partículas y 6 avisos. Acotan el dibujo por fotograma.
- **Sí:** al perder la última vida el modal se abre de inmediato, sin animación previa, para no retrasar el guardado.
- **Sí:** la partida termina a los 3 golpes, pero los efectos siguen dibujándose (sacudida y partículas del último golpe). El motor deja de actualizar la lógica y sigue dibujando.
- **Pendiente:** confirmar con tres partidas reales que la duración típica queda entre 1 y 5 minutos. Con 3 vidas y 45 s de aire podrían ser más largas que en la SPEC 18; el paso 5 del plan lo comprueba y, si no, se anota aquí qué constante se ajusta.

## Riesgos

| Riesgo                                                                                   | Mitigación                                                                                                   |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Los efectos consumen `Math.random` y alteran el mar o la prueba                          | Generador propio sembrado; criterio de aleatorio fijo; el hash de `--trace` no debe cambiar                  |
| El parpadeo o las animaciones saltan al pausar                                           | Reloj propio dentro de `update`; criterio de PAUSA                                                           |
| Una mina a la deriva sigue encima del punto de reaparición al acabar la invulnerabilidad | Reaparece a `(450, 350)` con 2 s de margen para nadar y las minas nuevas evitan esas celdas; riesgo aceptado |
| El aviso de proximidad hace el juego demasiado fácil                                     | Solo 90 px y opacidad 0,25; se anota en el paso 5 y se puede bajar el radio sin tocar el resto               |
| Demasiadas partículas o anillos en equipos modestos                                      | Tope de 96 partículas, 6 avisos, sin `shadowBlur`; `engine-perf` mide las llamadas por fotograma             |
| El cartel o el texto de espera tapan información                                         | Se dibujan en `y = 80` y `y = 330`, fuera de la barra de aire; se comprueba en la captura                    |
| Los listeners se duplican al remontar                                                    | Sin cambios en `destroy()`; criterio de bucle tras tres remontajes                                           |

## Qué **no** está en esta spec

- Sonido, assets e imágenes.
- Vidas extra por puntos o por objetos, y objetos nuevos.
- Animación de muerte previa al modal y pantallas de resumen.
- Controles distintos de los de la SPEC 18, teclas WASD y ratón.
- Ranking por tiempo o donde menos puntos es mejor, y validación de puntuaciones en servidor.
- Cambios en Supabase, en la portada y en los otros juegos.

Cada uno, si llega, va en su propia spec.
