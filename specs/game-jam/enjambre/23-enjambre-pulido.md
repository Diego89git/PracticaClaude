# SPEC 23 — Game jam «Invasores»: ENJAMBRE, pulido y cierre

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06, SPEC 07, SPEC 16, SPEC 21, SPEC 22
> **Fecha:** 2026-11-18
> **Objetivo:** Terminar ENJAMBRE en su variante «Asedio», con pantalla de espera, tres vidas con reaparición e invulnerabilidad, la Reina del enjambre como objetivo de bonificación y efectos visuales dibujados en el canvas, y cerrar el juego con la verificación completa.

## Por qué existe esta spec

La SPEC 21 dejó ENJAMBRE jugable en su variante «Clásica» y la SPEC 22 lo convirtió en la variante «Reflejo», con escudo, balas perforantes, blindados y niveles. Aún tiene tres asperezas. La formación marcha en cuanto se monta la página, antes de que el jugador sepa dónde está el cañón; un solo disparo acaba la partida, algo duro en el nivel 7, con 6 disparos a la vez; y el juego casi no responde a lo que hace el jugador: un dron destruido desaparece sin más, una cadena de ×4 no se nota y el impacto en el cañón es un corte seco.

Esta spec cierra el juego como variante **«Asedio»**: una partida larga de varias oleadas en la que se pierde terreno y se resiste. Llegan las vidas, la Reina del enjambre (un objetivo que cruza el cielo y vale el doble si se derriba con un reflejo) y los efectos que dan respuesta a cada acción. Como en la SPEC 22, no toca Supabase, la portada ni `components.tsx`: solo el motor `app/games/enjambre/engine.ts` y la línea de `enjambre` en `app/games/catalog.ts`, que pasa a mostrar Vidas. Es la última spec del juego, así que termina con la verificación final completa. Sigue la receta de `.claude/skills/add-game/references/pattern.md`.

## Alcance

**Dentro:**

- Pantalla de espera dibujada en el canvas («PULSA UNA FLECHA O ESPACIO PARA DEFENDER») hasta la primera tecla válida, también tras JUGAR DE NUEVO.
- 3 vidas con `onLivesChange` y `hud.vidas: true` en `catalog.ts`; tras un impacto, el cañón desaparece 1,0 s con la formación congelada y reaparece en `x = 400` con 2,0 s de invulnerabilidad, parpadeando.
- La invasión sigue terminando la partida aunque queden vidas.
- La Reina del enjambre: cruza el cielo en `y = 60` a 120 px/s cada 18 s de oleada, alternando el lado; vale 150 con bala normal y 300 con bala reflejada.
- Cartel «OLEADA n» de 1,2 s al empezar cada oleada, sin congelar el juego.
- Indicador del enfriamiento del escudo bajo el cañón.
- Fondo de estrellas fijas, partículas (dron destruido, cañón alcanzado, Reina derribada), sacudida del dibujo al recibir un impacto, chispa en el blindado que absorbe una bala normal, destello del reflejo y avisos flotantes de cadena, Reina y bonificación.
- Un generador pseudoaleatorio propio para los efectos, que no consume `Math.random`.
- Verificación final completa del juego (plataforma, Supabase, degradación, remontajes, anchos de pantalla y mando táctil).
- Mecánicas de las SPEC 21 y 22 sin cambios salvo las reglas de vidas, espera y Reina de esta spec.

**Fuera de alcance (specs futuras):**

- Sonido, assets e imágenes: los efectos se dibujan con formas y texto del canvas.
- Vidas extra por puntos o por objetos, y objetos nuevos.
- Búnkeres, picados y drones que se separan de la formación.
- Animación de muerte previa al modal: al perder la última vida el modal se abre de inmediato.
- Pantalla de resumen o de récords en el juego.
- Skins y `setSkin`: los aplica el agente `skin-designer` en su propia tarea.
- Controles distintos de los de las SPEC 21 y 22, teclas WASD y ratón.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cambios en Supabase, en la portada, en `components.tsx` y en los otros juegos.

## Modelo de datos

Esta spec no introduce estructuras en la base de datos: la ficha de la SPEC 21 no cambia.

Entrada del registro (`app/games/catalog.ts`), la única línea que cambia: `hud.vidas` pasa a `true` y `controles` se conserva igual que en la SPEC 22.

```ts
enjambre: { hud: { vidas: true, nivel: true }, controles: [/* sin cambios */] },
```

Constantes nuevas del motor (las de las SPEC 21 y 22 se conservan):

```ts
const START_LIVES = 3;
const RESPAWN_S = 1.0; // cañón ausente y formación congelada tras un impacto
const INVULN_S = 2.0; // invulnerabilidad tras reaparecer
const BLINK_S = 0.1; // el cañón alterna visible/oculto cada 0,1 s
// Reina del enjambre
const QUEEN_EVERY_S = 18; // segundos de oleada activa entre apariciones
const QUEEN_Y = 60; // centro: ocupa y de 50 a 70
const QUEEN_W = 48;
const QUEEN_H = 20;
const QUEEN_SPEED = 120; // px/s
const QUEEN_SCORE = 150; // con bala normal
const QUEEN_REFLECT_SCORE = 300; // con bala reflejada
// Avisos y efectos
const BANNER_S = 1.2; // cartel «OLEADA n»
const FX_SEED = 20261118; // semilla del generador de efectos
const STARS = 60;
const DRONE_PARTICLES = 6;
const HIT_PARTICLES = 16;
const QUEEN_PARTICLES = 10;
const PARTICLE_LIFE_S = 0.4;
const PARTICLE_SPEED = 140; // px/s
const MAX_PARTICLES = 120;
const SHAKE_S = 0.3;
const SHAKE_AMP = 6; // px, decae linealmente hasta 0
const SPARK_S = 0.15; // chispa en un blindado que absorbe una bala normal
const FLASH_S = 0.2; // destello del reflejo: anillo de radio 4 a 20 px
const POPUP_S = 0.8;
const POPUP_RISE_PX = 30;
const MAX_POPUPS = 6;
```

Estado nuevo:

```ts
let waiting: boolean; // true hasta la primera tecla válida
let lives: number;
let respawn: number; // segundos con el cañón ausente (0 = presente)
let invuln: number; // segundos de invulnerabilidad que quedan
let queen: { x: number; dir: 1 | -1 } | null; // la Reina en vuelo (centro x)
let queenT: number; // segundos de oleada activa desde la última aparición
let queenSide: 1 | -1; // sentido de la próxima Reina: 1 = entra por la izquierda
let banner: number; // segundos de cartel que quedan
let clock: number; // segundos de juego acumulados, para parpadeos (se detiene en pausa y en espera)
let shake: number;
let stars: { x: number; y: number; r: number }[]; // fijas, generadas en cada restart()
let particles: {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}[];
let popups: { x: number; y: number; text: string; life: number }[];
let sparks: { x: number; y: number; life: number }[];
let flashes: { x: number; y: number; life: number }[];
let fxState: number; // estado del generador de efectos
```

Reglas:

- **Espera:** al empezar y tras `restart()`, `waiting = true`. Mientras espera, `update` no hace nada (la formación, el disparo del enjambre, la Reina y los temporizadores no avanzan), el cañón está en `x = 400` y se dibuja el texto de espera centrado en `(400, 330)`, monoespaciada de 20 px `#e0e0e0`. La primera ←, →, ↑ o ESPACIO (`keydown` con `repeat: false`) pone `waiting = false`; ESPACIO que inicia la partida **no** dispara, ↑ que la inicia **no** levanta el escudo y una flecha que la inicia sí empieza a mover el cañón. `pause()` y `resume()` no alteran `waiting`. Con `waiting = false` se muestra el cartel «OLEADA 1».
- **Vidas:** `lives = 3` al empezar y tras `restart()`, con `onLivesChange(3)`. En el paso del impacto en el cañón, si un disparo enemigo toca el cañón con `respawn ≤ 0` e `invuln ≤ 0`: `lives` baja 1 y se notifica; se retiran todos los disparos enemigos (la bala del jugador y las reflejadas siguen su camino); si `lives` llega a 0, se llama `onGameOver(score)` (una sola vez, después de notificar las vidas); si no, `respawn = 1,0` y `held` se vacía.
- **Reaparición:** con `respawn > 0` el cañón no se dibuja, no se mueve, no dispara ni levanta el escudo; la formación no marcha, el enjambre no dispara y la Reina no avanza ni cuenta tiempo (las balas en vuelo sí se mueven). Al llegar `respawn` a 0, el cañón vuelve a `x = 400` con `invuln = 2,0`.
- **Invulnerabilidad:** `invuln` baja con `dt`. Mientras `> 0` los disparos enemigos atraviesan el cañón sin efecto y el cañón se dibuja solo si `floor(clock / 0,1)` es par. El escudo funciona con normalidad y refleja.
- **Invasión:** termina la partida aunque queden vidas: `lives` pasa a 0, se notifica `onLivesChange(0)` y después `onGameOver(score)`, una sola vez, para que el modal abra con el HUD en Vidas 0.
- **Reina:** con la formación activa, sin reaparición pendiente y sin Reina en vuelo, `queenT` sube con `dt`; al llegar a 18 nace la Reina en `x = −24` con `dir = 1` si `queenSide = 1`, o en `x = 824` con `dir = −1` si no; `queenSide` se invierte y `queenT = 0`. Avanza `120 × dir × dt` px por fotograma (cruza en 7,07 s) y se retira al salir (`x > 824` o `x < −24`). No dispara. Una bala normal que la toca (rectángulo barrido contra `x ± 24`, `y` de 50 a 70) la derriba, se retira y suma 150; una bala reflejada la derriba, suma 300 y sigue subiendo sin contar en su cadena. Al limpiar una oleada la Reina en vuelo se retira; al empezar cada oleada, `queenT = 0`. `restart()` deja `queenSide = 1`. La Reina no consume `Math.random`.
- **Cartel de oleada:** al empezar cada oleada (y la primera, al salir de la espera), `banner = 1,2`; se dibuja `OLEADA n` en monoespaciada de 24 px `#ffd84d` centrado en `(400, 330)`. No congela el juego.
- **Indicador del escudo:** bajo el cañón, en `y = 562`, una barra de 44×3 px `#fff6b0` que se rellena en proporción `1 − shieldCd / 0,8`; llena y a opacidad 0,4 cuando el escudo está listo.
- **Estrellas:** 60 puntos fijos generados con el generador de efectos en cada `restart()`, con `x` en `[0, 800)`, `y` en `[0, 520)` y radio 1 o 2; opacidad `0,3 + 0,3 × sin(2 × clock + i)`. Sin efecto en la jugabilidad.
- **Partículas:** al destruir un dron nacen 6 partículas del color de su fila en su centro, en ángulos `i × 2π / 6`; al recibir un impacto el cañón, 16 partículas `#ffd84d` en ángulos aleatorios del generador de efectos; al derribar la Reina, 10 partículas `#ff5ec8` en ángulos `i × 2π / 10`. Todas de 3×3 px, a 140 px/s y con 0,4 s de vida. El total no pasa de 120: si no hay sitio, se descartan las nuevas.
- **Sacudida:** al recibir un impacto el cañón (también el último), `shake = 0,3`; el dibujo de ese fotograma se traslada `(dx, dy)` con `dx` y `dy` aleatorios del generador en `[−1, 1] × 6 × shake / 0,3` px. No afecta a la lógica.
- **Chispa y destello:** una bala normal absorbida por un blindado deja una estrella de 4 puntas `#ffe9a0` de 0,15 s en el punto del impacto; un reflejo deja un anillo `#fff6b0` que crece de 4 a 20 px en 0,2 s y se desvanece.
- **Avisos flotantes:** un dron destruido por una bala reflejada con `chain ≥ 2` deja un texto `×k +p` (multiplicador y puntos de ese dron); la Reina deja `+150` o `+300`; la bonificación de oleada deja `+50×n` con su valor (`+100`, `+150`...) en `(400, 300)`. Suben 30 px en 0,8 s y se desvanecen. Máximo 6 a la vez: si no hay sitio, se descarta el más antiguo.
- **Generador de efectos:** `mulberry32` con semilla `FX_SEED`, propio del motor, reiniciado en cada `restart()` y que **no** consume `Math.random`. Las pruebas con aleatorio fijo de las SPEC 21 y 22 siguen dando la misma formación, los mismos disparos y los mismos puntos.
- **Reloj y pausa:** `clock`, las partículas, los avisos, las chispas, los destellos, la sacudida y el cartel avanzan solo dentro de `update` y se congelan en pausa y en espera. No se usa `performance.now()` en los efectos.
- **Orden de un fotograma (`update(dt)`):** si `waiting`, nada. Si no: (1) reloj, `wavePause` (y oleada siguiente), `fireCd`, escudo, `respawn`, `invuln`, `queenT` y cartel; (2) mover el cañón; (3) escudo; (4) disparo del jugador; (5) mover la bala, los disparos, las reflejadas y la Reina; (6) impactos en drones y en la Reina, bonificación y oleada limpia; (7) reflejo; (8) disparo enemigo contra el cañón (con vidas); (9) pasos de la formación; (10) invasión; (11) disparo del enjambre; (12) aparición de la Reina; (13) efectos. Al terminar la partida, las siguientes no se evalúan salvo los efectos, que siguen dibujándose.
- **Equilibrio:** ninguna constante de las SPEC 21 y 22 cambia. Las vidas, la reaparición con la formación congelada y la Reina son los únicos cambios de dificultad y de puntuación.
- **Pruebas heredadas:** las pruebas de comportamiento de las SPEC 21 y 22 empiezan ahora con un ESPACIO que solo sale de la espera; sus tiempos se cuentan desde ese ESPACIO. El impacto de los 3,19 s de la SPEC 21 ya no termina la partida: deja Vidas 2.

Dibujo: lo de las SPEC 21 y 22 más lo anterior. La Reina es un dron-abeja grande de 48×20 px `#ff5ec8` con corona de tres puntas `#ffe9a0` y alas que baten con `floor(clock / 0,15)`. Las estrellas se dibujan antes que todo lo demás. Sin puntuación, nivel, vidas ni «GAME OVER» dibujados salvo los textos propios del juego.

Convenciones: las de la SPEC 21.

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas") y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components, según exige `AGENTS.md`.

1. **Pantalla de espera.** Añadir `waiting`, el texto y el inicio con la primera tecla (ESPACIO sin disparo, ↑ sin escudo). Verificar: `npx tsc --noEmit`, `npx eslint app/games`, el smoke del motor y, en el navegador, que la formación no marcha hasta pulsar una tecla y que JUGAR DE NUEVO vuelve a la espera.
2. **Vidas.** Añadir `lives`, `respawn`, `invuln`, la congelación durante la reaparición, el parpadeo, la invasión con Vidas 0 y `hud.vidas: true` en `catalog.ts`. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y la prueba de comportamiento escrita fuera del repo con `Math.random` fijo en 0 (sección 8 de `pattern.md`): ESPACIO para empezar, 0,5625 s a la izquierda y esperar; el primer disparo alcanza al cañón a los 3,19 s ±1 fotograma, `lives` pasa a 2, el cañón vuelve a `x = 400` 1,0 s después y la formación no da ningún paso en ese segundo; tras tres impactos se llama `onLivesChange(0)` y después `onGameOver` una sola vez; con solo ESPACIO para empezar, la invasión termina la partida a los 287,4 s ±0,1 s con `onLivesChange(0)` antes de `onGameOver`.
3. **Reina.** Añadir `queen`, `queenT`, `queenSide`, sus impactos y su dibujo. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y la prueba de comportamiento: la primera Reina nace a los 18,0 s ±1 fotograma de oleada activa por la izquierda, cruza en 7,07 s y la segunda entra por la derecha; las pruebas de la SPEC 22 dan los mismos resultados.
4. **Avisos del juego.** Añadir el cartel de oleada y el indicador del escudo. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y la captura de cada aviso en el navegador.
5. **Efectos.** Añadir el generador de efectos, las estrellas, las partículas, la sacudida, las chispas, los destellos y los avisos flotantes. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, que el hash de `engine-perf.mjs --trace` de los pasos 3 y 4 no cambia al añadir los efectos y que la prueba con aleatorio fijo no cambia.
6. **Equilibrio.** Jugar 3 partidas completas y comprobar que la duración típica queda entre 1 y 5 minutos; si no, anotarlo como pendiente en la spec (ninguna constante se cambia sin dejarlo escrito aquí).
7. **Cierre.** Verificación final completa: `npm run lint`, `npm run build` sin trazas de error, `get_advisors` de seguridad sin avisos, `node .claude/skills/add-game/scripts/rls-check.mjs enjambre`, `node --expose-gc .claude/skills/add-game/scripts/engine-perf.mjs app/games/enjambre/engine.ts createEnjambre` sin fugas tras `restart()` y `destroy()`, prueba de degradación con clave inválida (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=invalida npm run build` y `npx next start -p 3200`; después reconstruir con la clave real), una partida completa visible en `/juegos/enjambre` y en la pestaña de ENJAMBRE de `/salon`, el mando táctil a 390×844 y 844×390 con `(pointer: coarse)`, y los criterios de plataforma de abajo. Borrar todas las filas de prueba de `scores` (incluida `RLSTEST`).

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores ni trazas de error.
- [ ] El HUD de `/jugar/enjambre` muestra Puntuación, Vidas y Nivel; al empezar, Vidas 3 y Nivel 1.
- [ ] Al montar `/jugar/enjambre` y tras JUGAR DE NUEVO, el canvas muestra «PULSA UNA FLECHA O ESPACIO PARA DEFENDER» y la formación, el disparo del enjambre y la Reina no avanzan hasta la primera tecla.
- [ ] ESPACIO como primera tecla inicia la partida sin disparar; ↑ como primera tecla la inicia sin levantar el escudo; una flecha como primera tecla la inicia y mueve el cañón; después aparece «OLEADA 1» durante 1,2 s.
- [ ] Un disparo enemigo que alcanza al cañón resta una vida, retira los disparos enemigos, oculta el cañón 1,0 s (±1 fotograma) con la formación, el enjambre y la Reina congelados, y lo hace reaparecer en `x = 400` invulnerable 2,0 s.
- [ ] Con invulnerabilidad el cañón parpadea cada 0,1 s, los disparos enemigos lo atraviesan sin restar vida y el escudo sigue reflejando.
- [ ] Al perder la tercera vida se llama `onLivesChange(0)` y después `onGameOver`, una sola vez, y el modal "FIN DEL JUEGO" se abre con el HUD ya en Vidas 0.
- [ ] La invasión termina la partida aunque queden vidas, con el HUD en Vidas 0 al abrirse el modal.
- [ ] La Reina aparece tras 18 s de oleada activa (±1 fotograma), alternando la entrada por la izquierda (la primera) y por la derecha, cruza en `y = 60` a 120 px/s y no dispara.
- [ ] Derribar la Reina con una bala normal suma 150 y retira la bala; con una bala reflejada suma 300, la bala sigue subiendo y la Reina no cuenta en su cadena.
- [ ] Al limpiar una oleada la Reina en vuelo desaparece y el contador de 18 s vuelve a 0 en la oleada siguiente.
- [ ] Bajo el cañón se dibuja la barra del enfriamiento del escudo, llena y tenue cuando se puede levantar.
- [ ] Al destruir un dron nacen 6 partículas de su color; al recibir un impacto el cañón nacen 16 partículas y el dibujo se sacude 0,3 s con una amplitud inicial de 6 px; al derribar la Reina nacen 10; nunca hay más de 120 partículas.
- [ ] Una bala normal absorbida por un blindado deja una chispa de 0,15 s y un reflejo deja un anillo que crece de 4 a 20 px en 0,2 s.
- [ ] Un dron destruido en una cadena de 2 o más muestra `×k +p`; la Reina muestra `+150` o `+300`; la bonificación de oleada muestra su valor; nunca hay más de 6 avisos a la vez.
- [ ] Hay 60 estrellas fijas por encima de `y = 520` que titilan y no afectan a la jugabilidad.
- [ ] Los efectos no consumen `Math.random`: con `Math.random` fijo en 0 la formación, los disparos y las puntuaciones son idénticos a los de las SPEC 21 y 22 (contando el tiempo desde el ESPACIO que sale de la espera).
- [ ] PAUSA congela el reloj, las partículas, los avisos, las chispas, los destellos, la sacudida, el cartel, la reaparición, la invulnerabilidad y la Reina; REANUDAR continúa sin saltos.
- [ ] Las constantes de equilibrio de las SPEC 21 y 22 (velocidades, pasos, disparos, escudo, cadena, blindados, puntos y fórmulas del nivel) no han cambiado.
- [ ] `onScoreChange`, `onLivesChange`, `onLevelChange` y `onGameOver` solo se llaman cuando el valor cambia, y `onGameOver` una sola vez y después de notificar vidas.
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras se juega.
- [ ] PAUSA muestra "EN PAUSA"; FIN abre el modal con la puntuación actual; con el modal abierto, ESPACIO no cambia la puntuación y teclear el nombre no mueve el cañón, no dispara ni levanta el escudo.
- [ ] El nombre se pre-rellena desde `localStorage["av_player_name"]`; GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "enjambre"` y `user_id: null`; tres clics seguidos insertan una sola fila.
- [ ] Si el insert falla, el modal muestra un error, no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] La puntuación guardada aparece en `/juegos/enjambre` y en la pestaña de ENJAMBRE de `/salon` al recargar.
- [ ] JUGAR DE NUEVO deja puntuación 0, Vidas 3, Nivel 1, la pantalla de espera, el cañón en `x = 400`, la formación del nivel 1, sin Reina y con la próxima Reina por la izquierda.
- [ ] Salir de `/jugar/enjambre` y volver no duplica el bucle: los frames por segundo no aumentan tras tres remontajes.
- [ ] `engine-perf.mjs` no detecta fugas tras `restart()` ni `destroy()`.
- [ ] El canvas se ve completo sin scroll horizontal a 1440 px y a 768 px de ancho.
- [ ] Con `(pointer: coarse)` a 390×844 y 844×390, el mando muestra la cruceta ◀ ▶ y los botones redondos DISPARO y ◆ ESCUDO, sin scroll horizontal, y la primera pulsación sobre él inicia la partida.
- [ ] `app/games/enjambre/engine.ts` no contiene `document.` y solo usa `window.` para registrar y quitar `keydown`, `keyup` y `blur`.
- [ ] Con la clave publishable, el `INSERT` válido en `scores` pasa, los inválidos se rechazan y `UPDATE`/`DELETE` no modifican filas.
- [ ] `/juegos/no-existe` y `/jugar/no-existe` muestran la pantalla 404.
- [ ] Con una clave de Supabase inválida, `/biblioteca` sigue respondiendo 200 y `/jugar/enjambre` carga.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

- **Sí:** decidido por game-jam a partir del tema "Invasores"; el usuario no fue consultado. Todas las decisiones de esta spec son propuestas para revisar.
- **Sí:** pantalla de espera dibujada en el canvas. La formación marcha y el primer disparo llega a los 2,0 s; la plataforma no tiene un estado de "listo" y el jugador necesita ver el cañón antes.
- **Sí:** ESPACIO o ↑ que inician la partida no disparan ni levantan el escudo. Un disparo involuntario gastaría la única bala y un escudo involuntario su enfriamiento.
- **Sí:** 3 vidas, con el cañón ausente 1,0 s y la formación congelada, y 2,0 s de invulnerabilidad al reaparecer en el centro. Congelar evita que la formación gane terreno mientras no hay defensa, y el centro es el punto más alejado de los dos bordes.
- **Sí:** la invasión termina la partida aunque queden vidas y deja el HUD en Vidas 0. Es la derrota del tema; si costara una vida, la formación habría que recolocarla y el tema perdería su amenaza.
- **No:** vidas extra por puntos. Cambia el equilibrio y no hace falta para terminar el juego.
- **Sí:** la Reina del enjambre como objetivo de bonificación, sin disparar, a 120 px/s y cada 18 s de oleada activa, alternando el lado sin `Math.random`. Da un objetivo de riesgo (hay que mirar arriba mientras llueven disparos) y su valor doble con reflejo refuerza la variante «Reflejo». Es determinista, así que no altera las pruebas con aleatorio fijo.
- **No:** que la Reina dispare o baje. Sería un segundo enemigo con IA propia y saldría del alcance de una game jam.
- **Sí:** el cartel «OLEADA n» no congela el juego. La plataforma ya muestra el nivel; el cartel solo avisa del cambio.
- **Sí:** estrellas, partículas, sacudida, chispas, destellos y avisos flotantes con un generador propio sembrado y fuera de `Math.random`. Así los efectos no alteran la partida ni la prueba con aleatorio fijo, y `engine-perf` puede comparar el hash de jugabilidad.
- **Sí:** el reloj de los efectos avanza dentro de `update` y no con `performance.now()`. Así la pausa congela parpadeos y animaciones sin saltos.
- **No:** sombras (`shadowBlur`) para el brillo del neón. Cuestan fotogramas en equipos modestos; los trazos dobles dan un efecto parecido.
- **Sí:** tope de 120 partículas y 6 avisos. Acotan el dibujo por fotograma: una cadena de 4 en una oleada densa genera 24 partículas.
- **Sí:** al perder la última vida el modal se abre de inmediato, sin animación previa, para no retrasar el guardado; la sacudida y las partículas del último impacto se siguen dibujando detrás del modal.
- **Pendiente:** confirmar con tres partidas reales que la duración típica queda entre 1 y 5 minutos. Con 3 vidas y la formación congelada en cada impacto podrían alargarse; el paso 6 del plan lo comprueba y, si no, se anota aquí qué constante se ajusta.

## Riesgos

| Riesgo                                                              | Mitigación                                                                                                 |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Los efectos consumen `Math.random` y alteran la partida o la prueba | Generador propio sembrado; criterio de aleatorio fijo; el hash de `--trace` no debe cambiar                |
| El parpadeo o las animaciones saltan al pausar                      | Reloj propio dentro de `update`; criterio de PAUSA                                                         |
| `onGameOver` llega antes que las vidas a 0 en la invasión           | La invasión pone `lives = 0` y `emitChanges()` notifica vidas antes de `onGameOver`; criterio explícito    |
| Un disparo en vuelo alcanza al cañón justo al reaparecer            | Al recibir un impacto se retiran todos los disparos enemigos y la reaparición da 2,0 s de invulnerabilidad |
| La Reina tapa información o choca con la fila 0                     | Vuela en `y` de 50 a 70 y la fila 0 empieza en `y = 88` como mínimo; se comprueba en la captura            |
| Demasiadas partículas en equipos modestos                           | Tope de 120 partículas y 6 avisos, sin `shadowBlur`; `engine-perf` mide las llamadas por fotograma         |
| El texto de espera o el cartel tapan la formación                   | Se dibujan en `y = 330`, por debajo de la formación inicial (fila 3 hasta `y = 294` como máximo)           |
| Los listeners se duplican al remontar                               | Sin cambios en `destroy()`; criterio de bucle tras tres remontajes                                         |

## Qué **no** está en esta spec

- Sonido, assets e imágenes.
- Vidas extra por puntos o por objetos, y objetos nuevos.
- Búnkeres, picados y drones que se separan de la formación.
- Animación de muerte previa al modal y pantallas de resumen.
- Skins y `setSkin`.
- Controles distintos de los de las SPEC 21 y 22, teclas WASD y ratón.
- Ranking por tiempo o donde menos puntos es mejor, y validación de puntuaciones en servidor.
- Cambios en Supabase, en la portada, en `components.tsx` y en los otros juegos.

Cada uno, si llega, va en su propia spec.
