# SPEC 21 — Game jam «Invasores»: ENJAMBRE, núcleo jugable

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06, SPEC 07, SPEC 16
> **Fecha:** 2026-11-18
> **Objetivo:** Añadir ENJAMBRE, un shooter de formación creado desde cero en el que un cañón frena a un enjambre de drones que desciende paso a paso, al catálogo de Arcade Vault, jugable en `/jugar/enjambre` y con su leaderboard real en Supabase.

## Por qué existe esta spec

ENJAMBRE nace del tema de game jam **«Invasores»** y es la primera de las tres specs del juego (SPEC 21 núcleo, SPEC 22 progresión, SPEC 23 pulido). Cada una cierra una variante jugable distinta del mismo juego: esta entrega la variante **«Clásica»** (disparas, el enjambre baja, una sola bala en pantalla), la SPEC 22 la convierte en la variante **«Reflejo»** (los disparos del enjambre se devuelven con un escudo y son tu mejor munición) y la SPEC 23 la cierra como variante **«Asedio»** (vidas, la Reina del enjambre y efectos).

El tema es la mecánica: el enemigo no persigue ni esquiva, **invade**. Una formación de 32 drones marcha de lado a lado, baja 20 px cada vez que toca un borde y acelera a medida que pierde drones; si su fila más baja llega a la línea del cañón, la invasión ha triunfado. El jugador gana tiempo destruyendo drones y pierde en cuanto un disparo del enjambre le alcanza. Esta spec entrega lo mínimo para jugar de principio a fin y entrar en el ranking: ficha, portada, motor con cañón, bala, formación, disparos enemigos, oleadas infinitas, puntuación y fin de partida.

No se porta nada: `references/started-games/` no tiene un juego así, y como en SERPENTINA (SPEC 09) las reglas se definen aquí, con números. Es una versión original del género: drones-abeja de neón con alas, sin los nombres, las criaturas, los búnkeres ni el arte de ningún juego existente. No reemplaza a ningún placeholder: es un juego nuevo con id propio, portada propia y su ficha **solo en Supabase**, como ASTEROIDES, así que el Home no cambia. Sigue la receta de `.claude/skills/add-game/references/pattern.md` y usa el registro de juegos que creó la SPEC 07 y el mando táctil de la SPEC 16 (con el reparto cruceta/redondos de la SPEC 17).

## Alcance

**Dentro:**

- Fila `enjambre` en la tabla `games` de Supabase, con su migración en `supabase/migrations/`.
- Portada `.cover-enjambre` en `app/globals.css`, dibujada con el propio juego (formación de drones, cañón y una bala).
- Motor en `app/games/enjambre/engine.ts`: lógica nueva descrita en el modelo de datos, con el contrato de `pattern.md` (canvas por parámetro, listeners con limpieza, callbacks hacia el HUD).
- Componente cliente `app/components/enjambre-game.tsx` que monta el motor en un `<canvas>` de 800×600 dentro del marco CRT.
- Entrada de `enjambre` en el registro de juegos (`app/games/catalog.ts`, con su mando táctil) y en `app/games/components.tsx`: HUD solo con Puntuación, sin Vidas ni Nivel.
- PAUSA, FIN, JUGAR DE NUEVO y GUARDAR PUNTUACIÓN con el juego real; puntuación guardada en `scores`.
- Mecánica: cañón a 320 px/s en la línea `y = 550`; una sola bala en pantalla a 600 px/s; formación de 8×4 drones que avanza a pasos de 10 px y baja 20 px al tocar un borde, con un paso entre 0,60 s (32 drones) y 0,05 s (1 dron); disparos enemigos cada 1,0 s, como máximo 3 a la vez; 30, 20 y 10 puntos según la fila; oleadas infinitas e iguales; fin por impacto o por invasión.
- Control solo con teclado: ← → mueven el cañón y ESPACIO dispara. Las flechas y ESPACIO no hacen scroll de la página.

**Fuera de alcance (specs futuras):**

- Escudo reflector, balas perforantes con cadena, drones blindados, dificultad creciente por oleada y Nivel en el HUD: SPEC 22.
- Vidas, pantalla de espera, la Reina del enjambre, estrellas, partículas, sacudida y avisos visuales: SPEC 23.
- Búnkeres o barreras destructibles: no están en ninguna de las tres specs (ver decisiones).
- Skins (`clasico`, `neon`, `retro`) y `setSkin`: los aplica el agente `skin-designer` en su propia tarea.
- Sonido, imágenes y cualquier asset: el juego se dibuja con formas del canvas.
- Teclas WASD y ratón.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cambios en los otros juegos, reales o placeholder (incluido el placeholder `invasores`).

## Modelo de datos

Fila de `games` (migración `supabase/migrations/20261118140000_game_enjambre.sql`):

```sql
insert into public.games (id, title, short, long, cat, cover, color) values (
  'enjambre',
  'ENJAMBRE',
  'Frena al enjambre antes de que toque tierra.',
  'Un enjambre de drones de neón desciende en formación, paso a paso, y cuantos menos quedan más rápido avanza. Mueve tu cañón por la línea de defensa, dispara entre sus ráfagas y no dejes que la colmena llegue al suelo: cada oleada que limpias trae otra.',
  'SHOOTER',
  'cover-enjambre',
  'yellow'
);
```

Entrada del registro (`app/games/catalog.ts`), con el mando táctil de la SPEC 16:

```ts
enjambre: {
  hud: { vidas: false, nivel: false },
  controles: [
    { code: "ArrowLeft", etiqueta: "◀", aria: "Mover el cañón a la izquierda", modo: "mantener", zona: "izquierda" },
    { code: "ArrowRight", etiqueta: "▶", aria: "Mover el cañón a la derecha", modo: "mantener", zona: "izquierda" },
    { code: "Space", etiqueta: "DISPARO", aria: "Disparar", modo: "pulso", zona: "derecha" },
  ],
},
```

Motor: `createEnjambre(canvas: HTMLCanvasElement, events: GameEvents): GameEngine`, con el contrato de `.claude/skills/add-game/references/pattern.md` sección 2. Constantes del juego:

```ts
const W = 800;
const H = 600;
// Cañón
const CANNON_W = 44;
const CANNON_H = 16;
const CANNON_Y = 550; // centro: ocupa y de 542 a 558
const CANNON_SPEED = 320; // px/s
const CANNON_MIN_X = 30;
const CANNON_MAX_X = 770;
const START_X = 400;
// Bala del jugador
const BULLET_W = 4;
const BULLET_H = 14;
const BULLET_SPEED = 600; // px/s hacia arriba
// Formación
const COLS = 8;
const ROWS = 4;
const DRONE_W = 36;
const DRONE_H = 24;
const GAP_X = 60; // distancia entre centros de columnas
const GAP_Y = 44; // distancia entre centros de filas
const ORIGIN_X = 190; // centro de la columna 0 = 400 − 3,5 × 60
const ORIGIN_Y = 100; // centro de la fila 0
const STEP_X = 10; // px por paso horizontal
const DROP_Y = 20; // px por bajada
const EDGE_MIN = 10; // ningún borde de dron vivo sale de [10, 790]
const EDGE_MAX = 790;
const STEP_SLOW = 0.6; // s por paso con 32 drones vivos
const STEP_FAST = 0.05; // s por paso con 1 dron vivo
// stepS(vivos) = 0,05 + 0,55 × (vivos − 1) / 31
const ROW_SCORE = [30, 20, 10, 10]; // fila 0 (arriba) a fila 3 (abajo); una oleada suma 560
// Disparos del enjambre
const SHOT_W = 4;
const SHOT_H = 12;
const SHOT_SPEED = 240; // px/s hacia abajo
const FIRE_S = 1.0; // un disparo por segundo
const FIRST_FIRE_S = 2.0; // primer disparo de cada oleada
const MAX_SHOTS = 3;
// Fin y oleadas
const INVADE_Y = 530; // si el borde inferior de un dron vivo llega a 530, la invasión gana
const WAVE_PAUSE_S = 1.0; // pausa entre oleadas
```

Estado del motor (variables de cierre dentro de `createEnjambre`):

```ts
interface Drone {
  col: number; // 0..7
  row: number; // 0..3
  alive: boolean;
}
interface Shot {
  x: number; // centro horizontal
  y: number; // borde superior
}
let cx: number; // centro horizontal del cañón
let held: Set<string>; // ArrowLeft, ArrowRight mantenidas
let wantFire: boolean; // ESPACIO pulsado desde el último update
let bullet: Shot | null; // bala del jugador (como máximo una)
let shots: Shot[]; // disparos del enjambre
let drones: Drone[]; // 32, en orden de filas (fila 0 primero) y columnas
let fx: number; // desplazamiento horizontal de la formación respecto del origen
let fy: number; // desplazamiento vertical
let dir: 1 | -1; // sentido de la marcha
let stepT: number; // tiempo acumulado hacia el siguiente paso
let wing: 0 | 1; // fotograma de las alas, cambia en cada paso
let fireCd: number; // segundos hasta el siguiente disparo del enjambre
let wave: number; // oleada actual, empieza en 1
let wavePause: number; // segundos de pausa entre oleadas (0 = formación activa)
let score: number;
let over: boolean;
let paused: boolean;
```

Reglas:

- **Posición de un dron:** su centro es `(190 + 60 × col + fx, 100 + 44 × row + fy)` y su rectángulo mide 36×24 alrededor del centro (`±18`, `±12`).
- **Inicio:** `cx = 400`, `fx = fy = 0`, `dir = 1`, `stepT = 0`, `wing = 0`, `fireCd = 2,0`, `wave = 1`, `wavePause = 0`, sin bala, sin disparos, los 32 drones vivos y puntuación 0. No hay pantalla de espera: la formación marcha desde el primer fotograma.
- **Cañón:** con `dx = (derecha ? 1 : 0) − (izquierda ? 1 : 0)`, `cx += 320 × dx × dt`, limitado a `[30, 770]`. No hay inercia.
- **Disparo del jugador:** ESPACIO (un `keydown` con `repeat: false`) pone `wantFire = true`. En el `update` siguiente, si no hay bala en pantalla, nace una bala con centro `x = cx` y borde superior `y = 528` (justo encima del cañón). `wantFire` vuelve a `false` en cada `update`, haya disparado o no: una pulsación con una bala ya en pantalla se pierde, no se guarda. Mantener ESPACIO no dispara más.
- **Bala:** sube `600 × dt` px por fotograma y se retira cuando `y + 14 < 0`.
- **Impacto en un dron:** se comprueba con el rectángulo barrido de la bala en ese fotograma (`x ± 2` en horizontal, desde el `y` nuevo hasta el `y` anterior `+ 14` en vertical) contra los drones vivos. Si toca varios, cuenta el de fila mayor (el primero que encuentra al subir). El dron muere, la bala se retira y se suma `ROW_SCORE[row]`: 30 en la fila 0, 20 en la 1 y 10 en las filas 2 y 3.
- **Paso de la formación:** con la formación activa, `stepT += dt` y, **mientras** `stepT ≥ stepS(vivos)`, se resta `stepS` y se da un paso, recalculando `stepS` con los drones vivos de ese momento. Un paso es: si `dir = 1` y el borde derecho más a la derecha de los drones vivos `+ 10 > 790`, o si `dir = −1` y el borde izquierdo más a la izquierda `− 10 < 10`, la formación **baja** (`fy += 20`) y cambia de sentido (`dir = −dir`); si no, avanza (`fx += 10 × dir`). En ambos casos `wing` alterna. Con los 32 drones vivos, los 16 primeros pasos van a la derecha y el paso 17 (a los 10,2 s) es la primera bajada.
- **Velocidad:** `stepS(vivos) = 0,05 + 0,55 × (vivos − 1) / 31`: 0,60 s con 32 drones, ≈ 0,316 s con 16 y 0,05 s con 1.
- **Disparos del enjambre:** con la formación activa, `fireCd` baja con `dt`; al llegar a `≤ 0` se pone `fireCd = 1,0` y se elige el tirador: se construye la lista de columnas con algún dron vivo en orden de columna, se hace **una** llamada a `Math.random` y se toma la columna de índice `floor(r × longitud)`; dispara su dron vivo de fila mayor. Si hay menos de 3 disparos en pantalla, nace uno con centro `x` del dron y borde superior en el borde inferior del dron (`y` del centro `+ 12`); si ya hay 3, ese disparo se pierde. Con `Math.random` fijo en 0 dispara siempre la columna viva de índice menor.
- **Disparo enemigo:** baja `240 × dt` px por fotograma y se retira cuando `y > 600`. Si su rectángulo barrido (`x ± 2`, desde el `y` anterior hasta el `y` nuevo `+ 12`) toca el rectángulo del cañón (`cx ± 22`, `y` de 542 a 558), la partida termina. Los disparos y la bala no chocan entre sí.
- **Invasión:** tras los pasos del fotograma, si algún dron vivo tiene su borde inferior (`y` del centro `+ 12`) en `y ≥ 530`, la partida termina. Con todos los drones vivos y sin disparar, ocurre en la 15.ª bajada (`fy = 300`), en el paso 479, a los 287,4 s.
- **Oleada limpia:** cuando muere el último dron, `wavePause = 1,0` y se retiran todos los disparos enemigos (la bala del jugador sigue su camino). Con `wavePause > 0` la formación no se dibuja, no marcha ni dispara. Al llegar `wavePause` a 0, `wave` sube 1 y la formación vuelve a su estado inicial (`fx = fy = 0`, `dir = 1`, `stepT = 0`, `wing = 0`, 32 drones vivos) con `fireCd = 2,0`. En esta spec todas las oleadas son iguales; la puntuación no tiene tope.
- **Orden de un fotograma (`update(dt)`):** (1) bajar `wavePause` (y empezar la oleada siguiente si llega a 0) y, con la formación activa, `fireCd`; (2) mover el cañón; (3) disparo del jugador; (4) mover la bala y los disparos; (5) impacto de la bala en un dron y oleada limpia; (6) disparo enemigo contra el cañón; (7) pasos de la formación; (8) invasión; (9) disparo del enjambre. Al terminar la partida por una causa, las siguientes no se evalúan.
- **Fin:** `onScoreChange` solo cuando el valor cambia y **antes** de `onGameOver(score)`, que se llama una sola vez; la lógica no avanza más y sigue dibujando. `onLivesChange(0)` y `onLevelChange(1)` se llaman una vez al empezar y tras cada `restart()`.
- **Entrada:** `keydown` y `keyup` en `window` con `e.code`. Se ignora todo evento cuyo `e.target` sea un `INPUT`, `TEXTAREA` o `SELECT` o tenga `isContentEditable`. Con la partida terminada o en pausa las teclas no hacen nada. `pause()`, `resume()`, `restart()` y `blur` de la ventana vacían `held` y ponen `wantFire = false`.

Dibujo (valores iniciales, se ajustan viendo la captura sin cambiar el comportamiento): fondo `#07060f`; línea de suelo de 2 px `#4a3f10` en `y = 575`; cañón `#ffd84d`, una base trapezoidal de 44×10 px (`y` de 548 a 558) con una torreta de 8×6 px encima (`y` de 542 a 548); drones-abeja originales, un hexágono de 24×16 px con un ojo central de 4×4 px `#07060f` y dos alas triangulares a los lados que apuntan arriba con `wing = 0` y abajo con `wing = 1`, de color `#ff5ec8` en la fila 0, `#5de8ff` en la fila 1 y `#ffd84d` en las filas 2 y 3; bala del jugador, rectángulo de 4×14 `#fff6b0`; disparo enemigo, un zigzag de 4×12 `#ff6a3d`. Sin puntuación, nivel, vidas ni «GAME OVER»: los pone la plataforma. Lo propio del juego sí se dibuja en monoespaciada de 20 px `#e0e0e0`: `OLEADA n` alineado a la derecha en `(780, 30)`.

Convenciones: canvas de 800×600 px (4:3, llena el marco CRT); tiempos en segundos; `dt` limitado a 50 ms; coordenadas en píxeles con origen arriba a la izquierda.

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas") y la sección 6 de `.claude/skills/add-game/references/porting.md` (modo «desde cero»), y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components y Cache Components, según exige `AGENTS.md`. Usar `/frontend-design` para la portada.

1. **Ficha.** Crear la migración con la fila `enjambre` y aplicarla con `apply_migration` **tras pedir confirmación al usuario**. No se añade a `app/data.ts`. Verificar: `list_tables` y una consulta muestran la fila; `/biblioteca` muestra una tarjeta más que antes (10 con el catálogo actual: las 8 entradas de `app/data.ts`, ASTEROIDES y ENJAMBRE; una más por cada juego de game-jam implementado antes que este) y la de ENJAMBRE muestra `best` 0; `/juegos/enjambre` carga con el estado vacío del ranking; `/jugar/enjambre` muestra el placeholder.
2. **Portada.** Añadir `.cover-enjambre` a `app/globals.css` junto a las otras `.cover-*`, con un SVG en `::after` (viewBox 400×300) que dibuje tres filas de drones-abeja (magenta, cian y amarillo) en formación, un cañón amarillo abajo y una bala subiendo, sobre un fondo casi negro con halo amarillo, siguiendo la idea de la portada de ASTEROIDES y sin parecerse a `.cover-invaders`. Verificar: captura de la tarjeta en `/biblioteca` y en `/juegos/enjambre`, distinta de las demás portadas.
3. **Motor: cañón, formación y dibujo.** Crear `app/games/enjambre/engine.ts` desde `.claude/skills/add-game/assets/engine.ts.tpl` con las constantes, el cañón con `held`, los pasos de la formación, la invasión, el dibujo, los callbacks iniciales, `keydown`, `keyup` y `blur`. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, `node .claude/skills/add-game/scripts/engine-smoke.mjs app/games/enjambre/engine.ts createEnjambre` y una prueba de comportamiento escrita fuera del repo (sección 8 de `pattern.md`): sin tocar nada, la primera bajada ocurre a los 10,2 s ±1 fotograma con `fy = 20` y `dir = −1`.
4. **Motor: bala, disparos, oleadas y fin.** Añadir la bala, los disparos del enjambre, los impactos con puntos, la oleada limpia y `onGameOver(score)` una sola vez. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, el smoke del motor y la prueba de comportamiento con `Math.random` fijo en 0: mover a la derecha 0,09375 s (`cx = 430`) y pulsar ESPACIO destruye el dron de la columna 4, fila 3, antes de 0,6 s y suma 10; mover a la izquierda 0,5625 s (`cx = 220`) y esperar hace que el primer disparo del enjambre (a los 2,0 s, desde `(220, 244)`) termine la partida a los 3,19 s ±1 fotograma con 0 puntos; sin tocar nada, la partida termina por invasión a los 287,4 s ±0,1 s con 0 puntos.
5. **Componente.** Crear `app/components/enjambre-game.tsx` desde `.claude/skills/add-game/assets/game-component.tsx.tpl` con el canvas de 800×600.
6. **Registro.** Añadir `enjambre` a `catalog.ts` (con `controles`) y a `components.tsx`. Verificar en el navegador: `/jugar/enjambre` muestra el canvas con el cañón, la formación de 32 drones y `OLEADA 1`, el HUD muestra solo Puntuación, ESPACIO dispara una bala, PAUSA congela y FIN abre el modal.
7. **Cierre.** `npm run lint`, `npm run build` sin trazas de error, `get_advisors` de seguridad sin avisos, `node .claude/skills/add-game/scripts/rls-check.mjs enjambre` y una partida completa hasta verla en `/juegos/enjambre` y en la pestaña de ENJAMBRE de `/salon`. Borrar todas las filas de prueba de `scores` (incluida `RLSTEST`).

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] La tabla `games` contiene la fila `enjambre` con `cover-enjambre`, categoría `SHOOTER` y color `yellow`; `supabase/migrations/` contiene su migración.
- [ ] `/biblioteca` muestra una tarjeta más que antes (10 con el catálogo actual) y la de ENJAMBRE muestra `best` 0 y una portada distinta de las demás, incluida la del placeholder INVASORES.
- [ ] El Home (`/`) sigue mostrando exactamente las mismas 6 mini tarjetas.
- [ ] `/juegos/enjambre` muestra título, descripción larga y, sin puntuaciones, "Sé el primero en entrar al salón de la fama".
- [ ] `/jugar/enjambre` muestra el juego real en un canvas de 800×600 dentro del marco CRT, sin el placeholder; los demás juegos siguen como antes.
- [ ] El canvas no dibuja puntuación, nivel, vidas ni "GAME OVER"; solo dibuja el suelo, el cañón, los drones, las balas, los disparos y `OLEADA n`. El HUD de la plataforma muestra Puntuación y no muestra Vidas ni Nivel.
- [ ] Al empezar, el cañón está centrado en `x = 400`, hay 32 drones en 4 filas de 8 con la columna 0 en `x = 190` y la fila 0 en `y = 100`, la puntuación es 0 y se lee `OLEADA 1`.
- [ ] ← y → mueven el cañón a 320 px/s (±1 fotograma), se detiene al soltar y nunca sale de `[30, 770]`.
- [ ] ESPACIO dispara una bala que sube a 600 px/s; con una bala en pantalla, ESPACIO no dispara otra ni la deja guardada; mantener ESPACIO (`repeat: true`) no dispara más de una.
- [ ] Destruir un dron de la fila 0 suma 30, de la fila 1 suma 20 y de las filas 2 y 3 suma 10; una oleada completa suma 560.
- [ ] Con `Math.random` fijo en 0, mover a la derecha 0,09375 s y pulsar ESPACIO destruye el dron de la columna 4, fila 3, y suma 10.
- [ ] La formación avanza 10 px por paso; con 32 drones vivos da un paso cada 0,60 s y la primera bajada de 20 px ocurre en el paso 17 (10,2 s ±1 fotograma), tras la que marcha hacia la izquierda.
- [ ] El tiempo entre pasos es `0,05 + 0,55 × (vivos − 1) / 31` s: con 16 drones vivos ≈ 0,316 s y con 1 dron 0,05 s.
- [ ] El enjambre dispara cada 1,0 s desde el dron vivo más bajo de una columna elegida al azar, con el primer disparo de cada oleada a los 2,0 s; nunca hay más de 3 disparos enemigos en pantalla.
- [ ] Con `Math.random` fijo en 0, el primer disparo del enjambre sale a los 2,0 s (±1 fotograma) desde `(220, 244)`; con el cañón en `x = 220` lo alcanza a los 3,19 s y abre el modal "FIN DEL JUEGO" con 0 puntos, una sola vez.
- [ ] Un dron vivo cuyo borde inferior llega a `y = 530` abre el modal "FIN DEL JUEGO" con la puntuación actual, una sola vez; con `Math.random` fijo en 0 y sin tocar nada ocurre a los 287,4 s ±0,1 s.
- [ ] Al destruir el último dron desaparecen los disparos enemigos, la formación no se ve durante 1,0 s y vuelve completa en su posición inicial con `OLEADA n+1` y el primer disparo a los 2,0 s.
- [ ] Una bala a 600 px/s no atraviesa un dron sin destruirlo aunque el fotograma dure 50 ms (rectángulo barrido).
- [ ] `onScoreChange` solo se llama cuando la puntuación cambia; `onLivesChange(0)` y `onLevelChange(1)` se llaman una vez al empezar y tras JUGAR DE NUEVO; `onGameOver` se llama una sola vez, después de la última notificación de puntuación.
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras se juega.
- [ ] PAUSA congela el juego (cañón, formación, bala, disparos y temporizadores) y muestra "EN PAUSA"; REANUDAR continúa donde estaba, sin pasos acumulados de golpe; una flecha mantenida al pausar no se queda pegada.
- [ ] En pausa y con la partida terminada, ESPACIO y las flechas no disparan ni mueven el cañón.
- [ ] FIN abre el mismo modal con la puntuación actual.
- [ ] Con el modal abierto, ESPACIO no cambia la puntuación y teclear el nombre no mueve el cañón ni dispara.
- [ ] El nombre se pre-rellena desde `localStorage["av_player_name"]`; GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "enjambre"` y `user_id: null`.
- [ ] El botón se deshabilita durante el envío: tres clics seguidos insertan una sola fila.
- [ ] Si el insert falla, el modal muestra un error, no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] La puntuación guardada aparece en `/juegos/enjambre` y en la pestaña de ENJAMBRE de `/salon` al recargar.
- [ ] JUGAR DE NUEVO deja puntuación 0, `OLEADA 1`, el cañón en `x = 400`, la formación completa en su posición inicial, sin bala ni disparos.
- [ ] Salir de `/jugar/enjambre` y volver no duplica el bucle: los frames por segundo no aumentan tras tres remontajes.
- [ ] El canvas se ve completo sin scroll horizontal a 1440 px y a 768 px de ancho.
- [ ] Con `(pointer: coarse)` el mando muestra una cruceta con ◀ ▶ y un botón redondo DISPARO; las flechas mueven el cañón mientras se mantienen y DISPARO dispara una bala por toque.
- [ ] `app/games/enjambre/engine.ts` no contiene `document.` y solo usa `window.` para registrar y quitar `keydown`, `keyup` y `blur`.
- [ ] Con la clave publishable, el `INSERT` válido en `scores` pasa, los inválidos se rechazan y `UPDATE`/`DELETE` no modifican filas.
- [ ] `/juegos/no-existe` y `/jugar/no-existe` muestran la pantalla 404.
- [ ] Con una clave de Supabase inválida, `/biblioteca` sigue respondiendo 200 y `/jugar/enjambre` carga.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

- **Sí:** decidido por game-jam a partir del tema "Invasores"; el usuario no fue consultado. El tema salió de un sorteo de la ejecución programada sobre la lista de pendientes de `references/game-suggestions-todo.md`. Todas las decisiones de esta spec son propuestas para revisar.
- **Sí:** el tema es la mecánica: el enemigo avanza solo hacia ti en formación y la derrota es la invasión, no solo el impacto. Un shooter en el que los enemigos vuelan libres no cumpliría el tema.
- **Sí:** versión original del género, con drones-abeja de neón, un enjambre y una colmena. No se copian nombres, criaturas, búnkeres, sonidos ni arte de ningún juego existente.
- **Sí:** id `enjambre`, título ENJAMBRE, `SHOOTER` y color `yellow`. El amarillo no lo usa ningún juego real (ASTEROIDES y BLOQUE BUSTER son cian, CAÍDA magenta, SERPENTINA y FROGGER verdes) y es el del enjambre. El id no choca con `catalog.ts`, `app/data.ts`, `implemented-games.md` ni con otra carpeta de `specs/game-jam/`. La spec en borrador de INVERSOR (SPEC 10) también propone `yellow`; si ambas se implementan, conviene revisar uno de los dos colores.
- **No:** usar el id `invasores` ni reemplazar su placeholder. Una game jam crea un juego nuevo; reemplazar un placeholder es una decisión del usuario con `/add-game`. Queda anotado como riesgo que la Biblioteca tendrá dos tarjetas de la misma familia.
- **Sí:** la ficha vive solo en Supabase y no se añade a `app/data.ts`, como ASTEROIDES: el Home lee `GAMES.slice(0, 6)` y no cambia.
- **Sí:** la ficha describe el juego sin el escudo ni los blindados de la SPEC 22. Las SPEC 22 y 23 no tocan Supabase, y el texto sigue siendo cierto tras ellas.
- **Sí:** una sola bala del jugador en pantalla y sin guardar la pulsación. Obliga a apuntar cada disparo, que es la tensión clásica del género, y hace verificable la cadencia.
- **Sí:** marcha por pasos de 10 px y bajada de 20 px al tocar un borde, con el paso entre 0,60 s y 0,05 s según los drones vivos. Es la seña del género: matar drones acelera la invasión, y la fórmula lineal se verifica con una cuenta.
- **No:** movimiento continuo de la formación. Pierde el ritmo de pasos y complica la prueba con tiempos exactos.
- **Sí:** el tirador se elige con una sola llamada a `Math.random` sobre las columnas vivas y dispara el dron más bajo. Es reproducible con aleatorio fijo y nunca dispara un dron tapado por otro.
- **Sí:** como máximo 3 disparos enemigos a la vez y el primero a los 2,0 s. Da tiempo a orientarse al empezar cada oleada y acota la presión.
- **Sí:** 30, 20 y 10 puntos por fila. Premia apuntar arriba, que exige abrir hueco en la formación.
- **Sí:** oleadas infinitas e iguales en esta spec. La puntuación queda sin tope desde la primera entrega; la dificultad creciente es de la SPEC 22.
- **Sí:** sin vidas: un impacto acaba la partida y el HUD solo muestra Puntuación. Las vidas son de la SPEC 23; `onLivesChange(0)` constante, como CAÍDA.
- **No:** búnkeres o barreras destructibles. Exigen colisión por píxel o por celda y suman código que no aporta al tema; en la SPEC 22 el escudo reflector cumple su papel de defensa activa.
- **No:** choque entre la bala y los disparos enemigos. Añade una regla sin interés hasta que existe el escudo (SPEC 22).
- **Sí:** colisiones con rectángulo barrido. A 600 px/s y 50 ms la bala avanza 30 px, más que la altura de un dron (24 px).
- **Sí:** `OLEADA n` dibujado en el canvas mientras el HUD no tiene Nivel. Se retira en la SPEC 22, cuando la oleada pasa a ser el Nivel del HUD.
- **Sí:** el mando táctil se declara desde el primer momento (SPEC 16): ◀ ▶ en `mantener` (el motor lee el estado de la tecla) y DISPARO en `pulso` (una acción por `keydown`). ◀ y ▶ caen en la cruceta y DISPARO en un botón redondo (SPEC 17).
- **Sí:** sin assets ni sonido. Es una game jam: alcance pequeño y terminable.
- **Sí:** `dt` limitado a 50 ms y pasos de la formación en bucle `while`, porque en la SPEC 22 el paso puede bajar de 50 ms.
- **Sí:** `keyup` y `blur` vaciando `held` porque el movimiento es continuo, y se ignoran teclas con foco en un campo de texto para que teclear el nombre no mueva el cañón.

## Riesgos

| Riesgo                                                                                | Mitigación                                                                                                             |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Strict Mode monta el efecto dos veces y duplica el bucle                              | `destroy()` cancela el frame y quita `keydown`, `keyup` y `blur`; criterio de frames por segundo tras tres remontajes  |
| Envíos repetidos al guardar                                                           | `ref` que bloquea al instante; criterio de tres clics seguidos                                                         |
| Una flecha se queda mantenida tras pausar, perder el foco o abrir el modal            | `pause()`, `resume()`, `restart()` y `blur` vacían `held` y `wantFire`; criterio de PAUSA                              |
| La bala atraviesa un dron en un fotograma largo                                       | Rectángulo barrido entre la posición anterior y la nueva; criterio explícito                                           |
| Al reanudar se acumulan pasos de la formación                                         | `resume()` pone `lastTime = null` y `dt ≤ 50 ms`; criterio de PAUSA                                                    |
| Dos tarjetas parecidas en la Biblioteca (ENJAMBRE y el placeholder INVASORES)         | Portada propia distinta de `.cover-invaders`; reemplazar o retirar el placeholder es decisión del usuario en otra spec |
| Partidas demasiado cortas: un solo impacto acaba la partida                           | Es la variante «Clásica»; el primer disparo llega a los 2,0 s y hay como máximo 3; la SPEC 23 añade las vidas          |
| El último dron va a 200 px/s y es difícil de acertar                                  | Es la tensión del género; la oleada limpia da 1,0 s de respiro                                                         |
| Si Supabase falla, `enjambre` no aparece en la Biblioteca porque no tiene ficha local | Es el comportamiento de ASTEROIDES; criterio de degradación con clave inválida para el resto del catálogo              |

## Qué **no** está en esta spec

- Escudo reflector, balas perforantes con cadena, drones blindados, dificultad creciente y Nivel en el HUD (SPEC 22).
- Vidas, pantalla de espera, la Reina del enjambre, estrellas, partículas, sacudida y avisos visuales (SPEC 23).
- Búnkeres o barreras destructibles.
- Skins y `setSkin`.
- Sonido, assets, teclas WASD y ratón.
- Ranking por tiempo o donde menos puntos es mejor, y validación de puntuaciones en servidor.
- Cambios en los otros juegos, reales o placeholder.

Cada uno, si llega, va en su propia spec.
