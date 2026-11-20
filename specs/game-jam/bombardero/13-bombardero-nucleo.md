# SPEC 13 — Game jam «Bombardero»: BOMBARDERO, núcleo jugable

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-11-17
> **Objetivo:** Añadir BOMBARDERO, un juego de bombas con mecha y explosiones en cruz sobre una cuadrícula de bloques destructibles creado desde cero, al catálogo de Arcade Vault, jugable en `/jugar/bombardero` y con su leaderboard real en Supabase.

## Por qué existe esta spec

BOMBARDERO nace del tema de game jam **«Bombardero»** y es la primera de las tres specs del juego (SPEC 13 núcleo, SPEC 14 progresión, SPEC 15 pulido). El tema es la mecánica: el jugador solo puede avanzar y puntuar con bombas, cada bomba tiene mecha y estalla en cruz, y las bombas que toca una llamarada estallan en cadena. Un jugador, una cuadrícula, solo teclado. Esta spec entrega lo mínimo para jugar de principio a fin y entrar en el ranking: ficha, portada, motor con tablero, bombas, explosiones, bloques, puntuación por cadenas y fin de partida.

No se porta nada: `references/started-games/` no tiene un juego así, y como en SERPENTINA (SPEC 09) las reglas se definen aquí, con números. A diferencia de las SPEC 07 a 09, no reemplaza a ningún placeholder: es un juego nuevo con id propio, portada propia y su ficha **solo en Supabase**, como ASTEROIDES, así que el Home no cambia. Sigue la receta de `.claude/skills/add-game/references/pattern.md` y usa el registro de juegos que creó la SPEC 07.

## Alcance

**Dentro:**

- Fila `bombardero` en la tabla `games` de Supabase, con su migración en `supabase/migrations/`.
- Portada `.cover-bombardero` en `app/globals.css`, dibujada con el propio juego (cuadrícula, bombas, bloques y cruz de fuego).
- Motor en `app/games/bombardero/engine.ts`: lógica nueva descrita en el modelo de datos, con el contrato de `pattern.md` (canvas por parámetro, listeners con limpieza, callbacks hacia el HUD).
- Componente cliente `app/components/bombardero-game.tsx` que monta el motor en un `<canvas>` de 800×600 dentro del marco CRT.
- Entrada de `bombardero` en el registro de juegos (`app/games/catalog.ts` y `app/games/components.tsx`): HUD solo con Puntuación, sin Vidas ni Nivel.
- PAUSA, FIN, JUGAR DE NUEVO y GUARDAR PUNTUACIÓN con el juego real; puntuación guardada en `scores`.
- Mecánica: cuadrícula de 19×13 casillas con muros, pilares y bloques destructibles; jugador que se mueve casilla a casilla; hasta 2 bombas a la vez con mecha de 2 s; explosión en cruz de alcance 2 que se detiene en pilares y bloques; reacción en cadena entre bombas; 10 puntos por bloque multiplicados por las bombas de la cadena; fin al quedar atrapado en una llamarada, al agotarse los 150 s o al destruir todos los bloques.
- Control solo con teclado: ← ↑ → ↓ mueven y ESPACIO pone una bomba. Las flechas y ESPACIO no hacen scroll de la página.

**Fuera de alcance (specs futuras):**

- Enemigos, niveles, mejoras de alcance y de bombas, y pasar a otro tablero al limpiar el actual: SPEC 14.
- Vidas, pantalla de espera, partículas, sacudida y avisos visuales: SPEC 15.
- Multijugador y cualquier IA.
- Sonido, imágenes y cualquier asset: el juego se dibuja con formas del canvas.
- Controles táctiles, ratón o teclas WASD.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cambios en los otros juegos, reales o placeholder.

## Modelo de datos

Fila de `games` (migración `supabase/migrations/20261117110000_game_bombardero.sql`):

```sql
insert into public.games (id, title, short, long, cat, cover, color) values (
  'bombardero',
  'BOMBARDERO',
  'Pon la mecha, corre y deja que la cadena haga el resto.',
  'Una cuadrícula de neón llena de bloques que solo ceden a las bombas. Pon la mecha, huye de la cruz de fuego y encadena explosiones: cuantas más bombas estallen a la vez, más vale cada bloque. Un paso en falso dentro de la llamarada y se acabó.',
  'ARCADE',
  'cover-bombardero',
  'magenta'
);
```

Entrada del registro (`app/games/catalog.ts`):

```ts
bombardero: { hud: { vidas: false, nivel: false } },
```

Motor: `createBombardero(canvas: HTMLCanvasElement, events: GameEvents): GameEngine`, con el contrato de `.claude/skills/add-game/references/pattern.md` sección 2. Constantes del juego:

```ts
const W = 800;
const H = 600;
const CELL = 40; // casilla de 40×40 px
const COLS = 19;
const ROWS = 13;
const OX = 20; // (800 − 19 × 40) / 2
const OY = 40; // (600 − 13 × 40) / 2: deja 40 px arriba y abajo para texto del juego
const START = { x: 1, y: 1 }; // casilla inicial del jugador
const SAFE = [
  { x: 1, y: 1 },
  { x: 2, y: 1 },
  { x: 1, y: 2 },
]; // casillas que nunca llevan bloque
const BLOCK_PROB = 0.5; // un bloque si Math.random() < 0,5
const STEP_S = 0.15; // tiempo del jugador por casilla
const FUSE_S = 2.0; // mecha de una bomba
const FLAME_S = 0.5; // una casilla de llama dura 0,5 s
const RANGE = 2; // alcance de la cruz en casillas
const MAX_BOMBS = 2; // bombas a la vez
const BLOCK_SCORE = 10; // por bloque, × bombas de la cadena
const TIME_LIMIT_S = 150;
const CLEAR_BONUS_PER_S = 5; // al limpiar el tablero: 5 × segundos que quedan
const DIRS = ["up", "right", "down", "left"]; // orden fijo de las cuatro ramas de la cruz
```

Estado del motor (variables de cierre dentro de `createBombardero`):

```ts
type Dir = "up" | "right" | "down" | "left";
interface Bomb {
  x: number;
  y: number;
  fuse: number; // segundos que quedan
}
interface Flame {
  x: number;
  y: number;
  life: number; // segundos que quedan
}
let blocks: boolean[]; // blocks[y * COLS + x]
let px: number; // casilla lógica del jugador (la de destino mientras se mueve)
let py: number;
let fromX: number; // casilla de origen, solo para dibujar el desplazamiento
let fromY: number;
let moveCd: number; // segundos hasta poder empezar otro paso
let held: Dir[]; // flechas mantenidas, la última pulsada manda
let bombs: Bomb[];
let flames: Flame[]; // una sola entrada por casilla
let timeLeft: number;
let over: boolean;
let paused: boolean;
```

Reglas:

- **Tablero:** 19×13 casillas, índices `x = 0…18`, `y = 0…12`. Son **muros** los bordes (`x = 0`, `x = 18`, `y = 0`, `y = 12`) y los **pilares** de las casillas con `x` par e `y` par. Hay 40 pilares en el interior. Muros y pilares nunca cambian, no se atraviesan y detienen las llamas. Quedan 147 casillas libres en el interior.
- **Bloques:** al empezar y tras `restart()` se recorren las casillas libres en orden de filas (`y` de 1 a 11, `x` de 1 a 17), saltando las 3 de `SAFE`, y cada una consume **una** llamada a `Math.random`: hay bloque si el valor es `< 0,5`. Son 144 llamadas y, con aleatorio fijo en 0, 144 bloques; con 0,9, ninguno.
- **Inicio:** el jugador en `(1, 1)`, sin bombas ni llamas, `timeLeft = 150`, puntuación 0. No hay pantalla de espera: el tiempo corre desde el primer fotograma.
- **Zona segura:** las tres casillas de `SAFE` forman una L siempre libre. Con bloques en `(3, 1)` y `(1, 3)` se puede poner la primera bomba en `(2, 1)` y refugiarse en `(1, 2)`, que no está en su cruz.
- **Movimiento:** `moveCd` baja con `dt` hasta 0. Con `moveCd = 0` y alguna flecha mantenida, el jugador intenta un paso en la dirección de la última pulsada: si la casilla de destino no es muro, pilar, bloque ni bomba, `fromX/fromY` toman la casilla actual, `px/py` pasan a la de destino y `moveCd = 0,15`. Mantener una flecha encadena pasos; soltarla los detiene. Un `keydown` con `repeat: true` se ignora (la lista `held` ya la contiene) y `keyup` quita la flecha de `held`.
- **Bombas:** ESPACIO (sin `repeat`) pone una bomba en la casilla `(px, py)` si `bombs.length < 2` y no hay ya una bomba allí; `fuse = 2,0`. El jugador puede salir de su casilla, pero ninguna bomba es transitable después: no se entra en una casilla con bomba.
- **Explosión:** cuando `fuse ≤ 0` la bomba estalla y se retira. La cruz parte de su casilla (siempre llama) y recorre las ramas `up`, `right`, `down`, `left`, en ese orden, hasta 2 casillas. En cada casilla de una rama: si es muro o pilar, la rama termina sin llama; si es un bloque, se marca como destruido, hay llama y la rama termina; si hay otra bomba, hay llama, esa bomba pasa a `fuse = 0` (estalla en la misma cadena) y la rama termina; si no, hay llama y la rama continúa. Cada casilla con llama queda con `life = 0,5`; si ya tenía llama se renueva a 0,5.
- **Cadena:** `N` es el número de bombas que estallan dentro de un mismo `update(dt)`, tanto las que llegan a `fuse ≤ 0` como las que una llama detona. Las bombas se procesan en el orden en que se detonan (primero las de mecha agotada, en el orden de `bombs`, y luego las detonadas por llamas, en el orden en que se alcanzan). Los bloques marcados como destruidos no se retiran hasta que la cadena termina, así una llama no los atraviesa y el resultado no depende del orden.
- **Puntos de la cadena:** al terminar la cadena se retiran los bloques destruidos (cada bloque cuenta una vez aunque lo alcancen dos llamas) y la puntuación sube `10 × N × bloques destruidos`. Con 2 bombas en cadena que rompen 3 bloques suma 60.
- **Llamas:** `life` baja con `dt` y la casilla se retira al llegar a 0 o menos. Una llama dura 0,5 s.
- **Muerte:** si la casilla `(px, py)` del jugador tiene llama, se acaba la partida. Se comprueba tras la cadena de cada fotograma, así que entrar en una llama que sigue viva también mata.
- **Limpiar el tablero:** si en un `update` se destruyó al menos un bloque y ya no queda ninguno, y el jugador no murió en ese fotograma, la puntuación sube `5 × floor(timeLeft)` y la partida termina como victoria (se trata como fin de partida). La muerte tiene prioridad sobre limpiar. Con 0 bloques al empezar (aleatorio fijo en 0,9) no se limpia nada: la comprobación exige haber destruido uno.
- **Tiempo:** `timeLeft` baja con `dt` desde 150. Al llegar a 0 se acaba la partida con la puntuación actual.
- **Orden de un fotograma (`update(dt)`):** (1) bajar `timeLeft`; (2) mover al jugador; (3) envejecer y retirar llamas; (4) mechas, detonaciones, cadena y puntos; (5) muerte; (6) limpiar el tablero; (7) tiempo agotado. Al terminar la partida por una de las tres causas, las siguientes no se evalúan.
- **Entrada ignorada:** con la partida terminada o en pausa, las teclas no hacen nada. En `pause()`, `resume()`, `restart()` y al perder el foco la ventana (`blur`) se vacía `held`.
- **Fin:** `onScoreChange` solo cuando el valor cambia y **antes** de `onGameOver(score)`, que se llama una sola vez; la lógica no avanza más y sigue dibujando. `onLivesChange(0)` y `onLevelChange(1)` se llaman una vez al empezar y tras cada `restart()`.

Dibujo (valores iniciales, se ajustan viendo la captura sin cambiar el comportamiento): fondo `#0a0a18`; suelo con rejilla `#12122a`; muros y pilares `#1a1a35` con borde de 2 px `#4de8ff`; bloques `#7a1f6b` con borde de 2 px `#ff4fd8`; jugador, un círculo de radio 14 `#4de8ff` con ojos negros, que se desplaza entre `fromX/fromY` y `px/py` según `moveCd / 0,15`; bomba, círculo de radio 14 `#e0e0e0` con una chispa `#ffe14d`; llama, un cuadrado de 32×32 `#ffb03a` con núcleo de 16×16 `#fff3b0`. Todo se dibuja desplazado por `(OX, OY)`. Sin puntuación, nivel, vidas ni «GAME OVER»: los pone la plataforma. Lo propio del juego sí se dibuja en monoespaciada de 20 px `#e0e0e0`: `TIEMPO n` (con `n = ceil(timeLeft)`) alineado a la izquierda en `(20, 28)` y `BOMBAS n` (`n = 2 − bombs.length`) alineado a la derecha en `(780, 28)`.

Convenciones: canvas de 800×600 px (4:3, llena el marco CRT); tiempos en segundos; `dt` limitado a 50 ms; coordenadas de casilla con origen arriba a la izquierda y píxeles `(OX + x × 40, OY + y × 40)`.

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas") y la sección 6 de `.claude/skills/add-game/references/porting.md` (modo «desde cero»), y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components y Cache Components, según exige `AGENTS.md`. Usar `/frontend-design` para la portada.

1. **Ficha.** Crear la migración con la fila `bombardero` y aplicarla con `apply_migration` **tras pedir confirmación al usuario**. No se añade a `app/data.ts`. Verificar: `list_tables` y una consulta muestran la fila; `/biblioteca` muestra una tarjeta más que antes (10 con el catálogo actual: 8 placeholders de `app/data.ts`, ASTEROIDES y BOMBARDERO; 11 si INVERSOR, SPEC 10, ya está implementado) y la de BOMBARDERO muestra `best` 0; `/juegos/bombardero` carga con el estado vacío del ranking; `/jugar/bombardero` muestra el placeholder.
2. **Portada.** Añadir `.cover-bombardero` a `app/globals.css` junto a las otras `.cover-*`, con un SVG en `::after` (viewBox 400×300) que dibuje un trozo de cuadrícula con pilares, bloques magenta, una bomba con chispa y una cruz de fuego, siguiendo la idea de la portada de ASTEROIDES. Verificar: captura de la tarjeta en `/biblioteca` y en `/juegos/bombardero`, distinta de las demás portadas.
3. **Motor: tablero y jugador.** Crear `app/games/bombardero/engine.ts` desde `.claude/skills/add-game/assets/engine.ts.tpl` con las constantes, la generación del tablero, el movimiento con `held`, el dibujo y los callbacks iniciales; `keydown` y `keyup` en `window`, y `blur`. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y `node .claude/skills/add-game/scripts/engine-smoke.mjs app/games/bombardero/engine.ts createBombardero`.
4. **Motor: bombas y llamas.** Añadir `bombs`, `flames`, ESPACIO, mechas, explosión en cruz, reacción en cadena, bloques destruidos y la muerte por llama. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y una prueba de comportamiento escrita fuera del repo con `Math.random` fijo (sección 8 de `pattern.md`): cruz con alcance 2, parada en pilar y en bloque, cadena de dos bombas en el mismo fotograma y muerte en la casilla de la bomba.
5. **Motor: puntuación y fin.** Añadir los puntos por cadena, limpiar el tablero, el tiempo y `onGameOver(score)` una sola vez. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, el smoke del motor y la prueba de comportamiento: con la primera llamada de `Math.random` en 0 y el resto en 0,9 solo hay un bloque en `(3, 1)`; ir a `(2, 1)`, poner la bomba, volver a `(1, 1)` y bajar a `(1, 2)` termina la partida con `10 + 5 × floor(timeLeft)` puntos.
6. **Componente.** Crear `app/components/bombardero-game.tsx` desde `.claude/skills/add-game/assets/game-component.tsx.tpl` con el canvas de 800×600.
7. **Registro.** Añadir `bombardero` a `catalog.ts` y `components.tsx`. Verificar en el navegador: `/jugar/bombardero` muestra el canvas con el tablero, el jugador en `(1, 1)` y el texto de tiempo y bombas, el HUD muestra solo Puntuación, PAUSA congela y FIN abre el modal.
8. **Cierre.** `npm run lint`, `npm run build` sin trazas de error, `get_advisors` de seguridad sin avisos, `node .claude/skills/add-game/scripts/rls-check.mjs bombardero` y una partida completa hasta verla en `/juegos/bombardero` y en la pestaña de BOMBARDERO de `/salon`. Borrar todas las filas de prueba de `scores` (incluida `RLSTEST`).

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] La tabla `games` contiene la fila `bombardero` con `cover-bombardero` y color `magenta`; `supabase/migrations/` contiene su migración.
- [ ] `/biblioteca` muestra una tarjeta más que antes (10 con el catálogo actual) y la de BOMBARDERO muestra `best` 0 y una portada distinta de las demás.
- [ ] El Home (`/`) sigue mostrando exactamente las mismas 6 mini tarjetas.
- [ ] `/juegos/bombardero` muestra título, descripción larga y, sin puntuaciones, "Sé el primero en entrar al salón de la fama".
- [ ] `/jugar/bombardero` muestra el juego real en un canvas de 800×600 dentro del marco CRT, sin el placeholder; los demás juegos siguen como antes.
- [ ] El canvas no dibuja puntuación, nivel, vidas ni "GAME OVER"; solo dibuja el tablero, `TIEMPO n` y `BOMBAS n`. El HUD de la plataforma muestra Puntuación y no muestra Vidas ni Nivel.
- [ ] El tablero es de 19×13 casillas de 40 px, dibujado en `(20, 40)`; hay 40 pilares interiores en las casillas de `x` e `y` pares y muros en los cuatro bordes.
- [ ] Con `Math.random` fijo en 0 hay 144 bloques; con 0,9 no hay ninguno; las casillas `(1, 1)`, `(2, 1)` y `(1, 2)` nunca tienen bloque.
- [ ] Al empezar, el jugador está en `(1, 1)`, no hay bombas ni llamas, `TIEMPO` marca 150 y la puntuación es 0.
- [ ] El jugador avanza una casilla cada 0,15 s (±1 fotograma) mientras mantiene una flecha, se detiene al soltarla y no entra en muros, pilares, bloques ni casillas con bomba.
- [ ] ESPACIO pone una bomba en la casilla del jugador con mecha de 2,0 s (±1 fotograma); una tercera bomba mientras hay 2 se ignora, una segunda en la misma casilla se ignora y mantener ESPACIO (`repeat: true`) no pone más de una.
- [ ] Tras salir de su casilla, el jugador no puede volver a entrar en la casilla de la bomba.
- [ ] La explosión es una cruz de alcance 2: con el jugador lejos y sin obstáculos produce 9 casillas de llama (centro más 2 por rama).
- [ ] La rama se detiene en un pilar o muro sin llama en él, y en un bloque lo destruye, deja llama en su casilla y no llega más lejos.
- [ ] Una llama dura 0,5 s (±1 fotograma) y la casilla se retira al acabar.
- [ ] Una llama que alcanza otra bomba la hace estallar en el mismo fotograma, y las dos cuentan como una cadena de `N = 2`.
- [ ] Cada bloque destruido suma `10 × N`: dos bombas en cadena que rompen 3 bloques suman 60; un bloque alcanzado por dos llamas de la misma cadena cuenta una vez.
- [ ] Un bloque marcado como destruido no deja pasar la llama de otra bomba de la misma cadena.
- [ ] Si la casilla del jugador tiene llama, abre el modal "FIN DEL JUEGO" con la puntuación final, una sola vez; entrar en una llama que sigue viva también lo abre.
- [ ] Poner una bomba en `(2, 1)` con bloques en `(3, 1)` y `(1, 3)` y refugiarse en `(1, 2)` pasando por `(1, 1)` no mata al jugador.
- [ ] Al destruir el último bloque, la puntuación sube `5 × floor(timeLeft)` además de los puntos del bloque y se abre el modal; si el jugador muere en ese mismo fotograma, no hay bonificación.
- [ ] Con 0 bloques al empezar (`Math.random` en 0,9) la partida no termina por «limpiar el tablero» al explotar una bomba sin romper nada.
- [ ] Al llegar `TIEMPO` a 0 se abre el modal con la puntuación actual; `TIEMPO` muestra `ceil(timeLeft)`.
- [ ] `onScoreChange` solo se llama cuando la puntuación cambia; `onLivesChange(0)` y `onLevelChange(1)` se llaman una vez al empezar y tras JUGAR DE NUEVO; `onGameOver` se llama una sola vez, después de la última notificación de puntuación.
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras se juega.
- [ ] PAUSA congela el juego (movimiento, mechas, llamas y tiempo) y muestra "EN PAUSA"; REANUDAR continúa donde estaba, sin salto de mecha ni de tiempo; una flecha mantenida al pausar no se queda pegada.
- [ ] En pausa y con la partida terminada, ESPACIO y las flechas no ponen bombas ni mueven al jugador.
- [ ] FIN abre el mismo modal con la puntuación actual.
- [ ] Con el modal abierto, ESPACIO no cambia la puntuación y teclear el nombre no mueve al jugador ni pone bombas.
- [ ] El nombre se pre-rellena desde `localStorage["av_player_name"]`; GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "bombardero"` y `user_id: null`.
- [ ] El botón se deshabilita durante el envío: tres clics seguidos insertan una sola fila.
- [ ] Si el insert falla, el modal muestra un error, no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] La puntuación guardada aparece en `/juegos/bombardero` y en la pestaña de BOMBARDERO de `/salon` al recargar.
- [ ] JUGAR DE NUEVO deja puntuación 0, `TIEMPO` en 150, el jugador en `(1, 1)`, sin bombas ni llamas y un tablero nuevo.
- [ ] Salir de `/jugar/bombardero` y volver no duplica el bucle: los frames por segundo no aumentan tras tres remontajes.
- [ ] El canvas se ve completo sin scroll horizontal a 1440 px y a 768 px de ancho.
- [ ] `app/games/bombardero/engine.ts` no contiene `document.` y solo usa `window.` para registrar y quitar `keydown`, `keyup` y `blur`.
- [ ] Con la clave publishable, el `INSERT` válido en `scores` pasa, los inválidos se rechazan y `UPDATE`/`DELETE` no modifican filas.
- [ ] `/juegos/no-existe` y `/jugar/no-existe` muestran la pantalla 404.
- [ ] Con una clave de Supabase inválida, `/biblioteca` sigue respondiendo 200 y `/jugar/bombardero` carga.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

- **Sí:** decidido por game-jam a partir del tema "Bombardero"; el usuario no fue consultado. Todas las decisiones de esta spec son propuestas para revisar.
- **Sí:** el tema es la mecánica: la bomba es la única herramienta, tiene mecha, explota en cruz y detona a sus vecinas, y de esa cadena sale la puntuación. Un juego donde la bomba solo decorase no cumpliría el tema.
- **Sí:** un solo jugador contra la cuadrícula, como pidió el encargo. Los peligros son la propia llamarada y el tiempo; los enemigos simples llegan en la SPEC 14.
- **No:** multijugador o IA de enemigos en el núcleo. Son decisiones en dominios distintos y exceden las 500 líneas de motor previstas para el juego completo.
- **Sí:** id `bombardero`, ARCADE y color `magenta`. Cyan lo usan dos juegos reales y verde uno; el amarillo está reservado por INVERSOR (SPEC 10). No hay ninguna otra bomba en el catálogo y el id no choca con `catalog.ts`, `app/data.ts` ni `implemented-games.md`.
- **Sí:** la ficha vive solo en Supabase y no se añade a `app/data.ts`, como ASTEROIDES: el Home lee `GAMES.slice(0, 6)` y no cambia.
- **Sí:** cuadrícula de 19×13 casillas de 40 px con la disposición clásica de pilares (`x` e `y` pares). Es impar en las dos direcciones, queda centrada en el canvas con 40 px libres arriba y abajo y todas las casillas libres están conectadas.
- **Sí:** los márgenes de 40 px arriba y abajo muestran `TIEMPO` y `BOMBAS`. Son lo propio del juego, como «SIGUIENTE» en CAÍDA; la plataforma no tiene un lugar para ellos.
- **Sí:** movimiento casilla a casilla con un paso cada 0,15 s y la casilla de destino como posición lógica desde el inicio del paso. Es exacto y verificable, y evita colisiones a medias entre casillas.
- **No:** movimiento libre en píxeles. Exige colisión con esquinas y deja las llamas ambiguas.
- **Sí:** 2 bombas a la vez, mecha de 2 s, alcance 2 y llama de 0,5 s. Con una sola bomba no habría cadenas, que son el tema; el alcance 2 permite que una bomba toque a otra a dos casillas.
- **Sí:** la zona segura en L garantiza una primera bomba sin riesgo: se pone en `(2, 1)` y el jugador se refugia en `(1, 2)`, fuera de su cruz.
- **Sí:** la llama que alcanza una bomba la detona en el mismo fotograma, y los bloques destruidos no se retiran hasta terminar la cadena. Así el resultado no depende del orden de las bombas y la prueba con aleatorio fijo es reproducible.
- **Sí:** cada bloque vale `10 × N`, con `N` las bombas de la cadena. El tema premia encadenar: dos bombas que se detonan entre sí valen el doble que dos bombas sueltas.
- **No:** puntos por sobrevivir o por tiempo. La puntuación debe salir de la mecánica central.
- **Sí:** la bonificación de limpiar el tablero es `5 × floor(timeLeft)` y termina la partida. Sin enemigos ni niveles es la forma de acabar con victoria; la SPEC 14 la sustituye.
- **Sí:** el tiempo (150 s) acaba la partida. Sin él, esperar no costaría nada. La partida dura entre 1 y 2,5 minutos, dentro de lo que pide la plataforma.
- **Sí:** al terminar la partida por muerte, limpieza o tiempo, la muerte tiene prioridad sobre limpiar y limpiar sobre el tiempo. Evita puntuaciones ambiguas en un mismo fotograma.
- **Sí:** no se puede volver a entrar en una casilla con bomba. Las bombas actúan de barrera, lo que da juego táctico al poner una en un pasillo.
- **Sí:** la muerte por llama es inmediata y sin vidas. Las vidas y la invulnerabilidad son de la SPEC 15.
- **Sí:** ESPACIO y las flechas se leen en `keydown` y `keyup` (esta vez sí hace falta `keyup`, porque el movimiento es continuo) y `blur` vacía las teclas para que una flecha no se quede pegada.
- **Sí:** sin assets ni sonido. Es una game jam: alcance pequeño y terminable.
- **Sí:** `dt` limitado a 50 ms. A 50 ms un fotograma no puede saltarse un paso de 0,15 s, y las mechas y llamas solo cambian de estado una vez por fotograma.
- **Sí:** el orden de las 144 llamadas a `Math.random` para los bloques queda fijado por la spec. Permite probar el motor con aleatorio fijo, como en las SPEC 07 y 09.

## Riesgos

| Riesgo                                                                                  | Mitigación                                                                                                            |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Strict Mode monta el efecto dos veces y duplica el bucle                                | `destroy()` cancela el frame y quita `keydown`, `keyup` y `blur`; criterio de frames por segundo tras tres remontajes |
| Envíos repetidos al guardar                                                             | `ref` que bloquea al instante; criterio de tres clics seguidos                                                        |
| Una flecha se queda mantenida tras pausar, perder el foco o abrir el modal              | `pause()`, `resume()`, `restart()` y `blur` vacían `held`; criterio de PAUSA                                          |
| Un tablero deja al jugador sin ninguna acción segura al empezar                         | Zona segura en L siempre libre y criterio de la bomba en `(2, 1)`                                                     |
| Resultado de las cadenas dependiente del orden de las bombas                            | Los bloques se retiran al terminar la cadena y `N` cuenta bombas por fotograma; prueba de comportamiento              |
| Limpiar el tablero con 0 bloques al empezar termina la partida al instante              | La comprobación exige haber destruido al menos un bloque en el fotograma; criterio explícito                          |
| El jugador queda encerrado por sus propias bombas y bloques                             | Solo hay 2 bombas y la mecha es de 2 s; el tiempo de 150 s acaba la partida de todos modos                            |
| Tablero demasiado cargado en la tarjeta de la portada                                   | Se comprueba la captura de la tarjeta y se ajusta el SVG sin tocar el resto                                           |
| Si Supabase falla, `bombardero` no aparece en la Biblioteca porque no tiene ficha local | Es el comportamiento de ASTEROIDES; criterio de degradación con clave inválida para el resto del catálogo             |

## Qué **no** está en esta spec

- Enemigos, niveles, mejoras de alcance y de bombas (SPEC 14).
- Vidas, pantalla de espera, partículas, sacudida y avisos visuales (SPEC 15).
- Multijugador e IA.
- Sonido, assets, controles táctiles, ratón y teclas WASD.
- Ranking por tiempo o donde menos puntos es mejor, y validación de puntuaciones en servidor.
- Cambios en los otros juegos, reales o placeholder.

Cada uno, si llega, va en su propia spec.
