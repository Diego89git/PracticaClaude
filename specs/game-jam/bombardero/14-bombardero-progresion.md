# SPEC 14 — Game jam «Bombardero»: BOMBARDERO, progresión y profundidad

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06, SPEC 07, SPEC 13
> **Fecha:** 2026-11-17
> **Objetivo:** Dar a BOMBARDERO niveles con enemigos errantes y mejoras de alcance y de bombas escondidas en los bloques, de modo que la partida deje de acabar al limpiar el tablero y la dificultad crezca nivel a nivel.

## Por qué existe esta spec

La SPEC 13 dejó BOMBARDERO jugable: un tablero, bombas en cadena y una partida que acaba al morir, al agotarse el tiempo o al romper todos los bloques. Eso da una sola partida corta y sin motivo para repetir con más ambición. Esta spec añade lo que lo hace rejugable: enemigos simples que recorren el tablero y mueren con las mismas llamas, un nivel nuevo cada vez que se acaba con todos, mejoras de alcance y de bombas dentro de los bloques y un tiempo que se acorta con el nivel. La cadena sigue siendo el centro: matar enemigos también vale `× N`.

No toca Supabase, la portada ni `components.tsx`: solo el motor `app/games/bombardero/engine.ts` y la línea de `bombardero` en `app/games/catalog.ts`, que pasa a mostrar Nivel. Sigue la receta de `.claude/skills/add-game/references/pattern.md`.

## Alcance

**Dentro:**

- Niveles: acabar con todos los enemigos genera un tablero nuevo, con más enemigos y más rápidos; `onLevelChange` y `hud.nivel: true` en `catalog.ts`.
- Enemigos errantes (`chispa`): se mueven casilla a casilla, no pasan por muros, pilares, bloques ni bombas, matan al jugador por contacto y mueren en las llamas.
- Mejoras escondidas en los bloques: `alcance` (+1 de cruz) y `bomba` (+1 bomba a la vez), con un máximo de 5 cada una, que se conservan entre niveles.
- Tiempo por nivel que se acorta, y bonificación por superar el nivel.
- Puntos por matar enemigos y por recoger mejoras, con el mismo multiplicador de cadena que los bloques.
- Texto del juego en el canvas ampliado: `BOMBAS` libres y `ALCANCE`.
- Mecánicas de la SPEC 13 sin cambios salvo lo que esta spec dice que cambia: zona segura, movimiento, mecha, llama, cadena, puntos por bloque, muerte por llama y tiempo agotado.

**Fuera de alcance (specs futuras):**

- Vidas, pantalla de espera, partículas, sacudida y avisos visuales: SPEC 15.
- Enemigos que persigan al jugador o esquiven las bombas.
- Bombas de control remoto, empujar bombas y otras mejoras.
- Puerta de salida: el nivel se supera al acabar con los enemigos, no al llegar a una casilla.
- Sonido, imágenes y cualquier asset.
- Cambios en Supabase, en la portada y en los otros juegos.

## Modelo de datos

Esta spec no introduce estructuras en la base de datos: la ficha de la SPEC 13 no cambia.

Entrada del registro (`app/games/catalog.ts`), la única línea que cambia:

```ts
bombardero: { hud: { vidas: false, nivel: true } },
```

Constantes nuevas del motor (las de la SPEC 13 se conservan, con los cambios indicados en las reglas):

```ts
const ENEMIES_BASE = 1; // enemigos del nivel n = min(1 + n, 8)
const ENEMIES_MAX = 8;
const ENEMY_MIN_DIST = 8; // distancia Manhattan mínima a (1, 1) al aparecer
const ENEMY_STEP_BASE_S = 0.5; // tiempo por casilla de un enemigo en el nivel 1
const ENEMY_STEP_PER_LEVEL_S = 0.03;
const ENEMY_STEP_MIN_S = 0.25;
const ENEMY_SCORE = 100; // × chain de la llama
const ITEM_PROB = 0.25; // por bloque destruido
const ITEM_SCORE = 50;
const RANGE_MAX = 5;
const BOMBS_MAX = 5;
const LEVEL_BONUS = 100; // × nivel, al superarlo
const LEVEL_TIME_BASE_S = 150;
const LEVEL_TIME_STEP_S = 10; // cada nivel resta 10 s
const LEVEL_TIME_MIN_S = 90;
// enemyStepS(n) = max(0,25, 0,5 − 0,03 × (n − 1)); levelTimeS(n) = max(90, 150 − 10 × (n − 1))
```

`MAX_BOMBS` y `RANGE` dejan de ser constantes y pasan a variables que empiezan en 2 y 2 y suben con las mejoras. `TIME_LIMIT_S` pasa a `levelTimeS(level)`.

Estado nuevo:

```ts
interface Enemy {
  x: number;
  y: number;
  dir: Dir | null; // null hasta su primer paso
  cd: number; // segundos hasta el siguiente paso
}
interface Item {
  x: number;
  y: number;
  kind: "range" | "bomb";
}
// Flame gana el campo chain: number (el N de la cadena que la creó)
let level: number;
let enemies: Enemy[];
let items: Item[];
let maxBombs: number; // 2 al empezar, máximo 5
let range: number; // 2 al empezar, máximo 5
```

Reglas:

- **Generación de un nivel** (al empezar, tras `restart()` y al superar un nivel): primero los bloques, igual que en la SPEC 13 (144 llamadas a `Math.random`, una por casilla libre en orden de filas); después los enemigos. Hay `min(1 + level, 8)` enemigos: nivel 1 tiene 2, nivel 7 y siguientes tienen 8. Para cada uno, la lista de candidatas es el conjunto de casillas interiores que no son pilar y cuya distancia Manhattan a `(1, 1)` es ≥ 8, en orden de filas y sin las ya elegidas; una llamada a `Math.random` elige el índice `floor(r × candidatas.length)`. Si la casilla tiene bloque, se retira. Con aleatorio fijo en 0, los enemigos del nivel 1 aparecen en `(9, 1)` y `(10, 1)`.
- **Estado al cambiar de nivel:** sin bombas, llamas, mejoras en el suelo ni enemigos del nivel anterior; jugador en `(1, 1)` con `moveCd = 0`; `timeLeft = levelTimeS(level)`. `maxBombs` y `range` se conservan.
- **Tiempo por nivel:** `timeLeft` empieza en `max(90, 150 − 10 × (nivel − 1))`: 150 s en el nivel 1, 140 s en el 2 y 90 s desde el nivel 7. Agotarlo termina la partida, como en la SPEC 13.
- **Movimiento de un enemigo:** cada enemigo tiene `cd` que baja con `dt`; a 0, intenta un paso y `cd = enemyStepS(level)`. Si `dir` no es null y la casilla siguiente en esa dirección está libre (no es muro, pilar, bloque ni bomba), avanza. Si no, elige entre las direcciones libres, en el orden `up`, `right`, `down`, `left`, excluyendo la opuesta a `dir` salvo que sea la única; con una llamada a `Math.random` toma la de índice `floor(r × opciones.length)`. Sin ninguna libre, se queda quieto y no consume `Math.random`. Los enemigos pueden compartir casilla entre sí. Ningún enemigo entra en una casilla con bomba, pero sí en una con llama o con mejora.
- **Contacto:** si un enemigo y el jugador están en la misma casilla lógica, se acaba la partida. Se comprueba tras mover al jugador y tras mover a los enemigos.
- **Muerte de un enemigo:** si la casilla de un enemigo tiene llama, muere y la puntuación sube `100 × chain` de esa llama. Se comprueba tras la cadena de cada fotograma y tras mover a los enemigos, así que un enemigo que entra en una llama viva también muere.
- **Chain en las llamas:** cada llama guarda el `N` de la cadena que la creó. Los bloques valen `10 × N` como en la SPEC 13. Si una casilla de llama se renueva con otra cadena, conserva el mayor `N`. Dos enemigos en la misma casilla mueren a la vez y suman dos veces.
- **Mejoras:** al destruirse un bloque, al terminar la cadena y en el orden en que se retiran (por bomba, ramas `up`, `right`, `down`, `left`), una llamada a `Math.random`: si `r < 0,25` aparece una mejora y una segunda llamada decide el tipo: `< 0,5` `range`, si no `bomb`. Una mejora aparece en la casilla del bloque, después de la cadena, y por tanto no la destruye la llama que acaba de romper el bloque; una llama de una cadena posterior que alcance su casilla sí la destruye (la rama continúa). El jugador la recoge al entrar en su casilla: `range` sube `range` en 1 hasta 5, `bomb` sube `maxBombs` en 1 hasta 5, y la puntuación sube 50 aunque el valor ya esté en el máximo.
- **Superar el nivel:** si no queda ningún enemigo tras la cadena de un fotograma y el jugador sigue vivo, se suman `100 × level + 5 × floor(timeLeft)`, `level` sube en 1 y se genera el nivel siguiente. Esto **sustituye** la condición de la SPEC 13: destruir todos los bloques ya no termina la partida ni da bonificación. Con 0 enemigos (imposible en el juego) no se supera nada.
- **Orden de un fotograma (`update(dt)`):** (1) bajar `timeLeft`; (2) mover al jugador y recoger mejoras; (3) contacto con enemigos; (4) mover enemigos; (5) contacto con enemigos; (6) envejecer y retirar llamas; (7) mechas, detonaciones, cadena, puntos de bloques y aparición de mejoras; (8) muerte del jugador por llama; (9) muerte de enemigos por llama y puntos; (10) superar el nivel; (11) tiempo agotado. La muerte (3, 5 u 8) tiene prioridad sobre superar el nivel.
- **Callbacks:** `onLevelChange(level)` solo al cambiar (1 al empezar y tras `restart()`, y luego 2, 3...); `onLivesChange(0)` constante; `onScoreChange` solo al cambiar; `onGameOver(score)` una sola vez.
- **Pausa:** los temporizadores de enemigos avanzan solo con `update(dt)`, así que se congelan con PAUSA y no saltan al REANUDAR.

Dibujo (valores iniciales, se ajustan viendo la captura sin cambiar el comportamiento): enemigo, un cuadrado redondeado de 28×28 `#ffe14d` con dos ojos `#0a0a18`; mejora `range`, una cruz de 24×24 `#ff4fd8` con fondo `#1a1a35`; mejora `bomb`, un círculo de radio 10 `#e0e0e0` con fondo `#1a1a35`. El texto del juego pasa a `TIEMPO n` a la izquierda, y a la derecha `BOMBAS a/m ALCANCE r`, con `a = maxBombs − bombs.length` y `m = maxBombs`. Sin puntuación, nivel, vidas ni «GAME OVER» dibujados.

Convenciones: las de la SPEC 13 (canvas 800×600, tiempos en segundos, `dt` ≤ 50 ms, casillas de 40 px con origen en `(20, 40)`).

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas" y la sección 8, "Verificación"), la sección 6 de `.claude/skills/add-game/references/porting.md` y la SPEC 13, y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components y Cache Components, según exige `AGENTS.md`.

1. **Estructura de niveles.** En `engine.ts`, sacar la generación del tablero a una función `loadLevel(n)` que genera bloques, reinicia jugador, bombas, llamas y tiempo, convertir `MAX_BOMBS`, `RANGE` y `TIME_LIMIT_S` en `maxBombs`, `range` y `levelTimeS`, y notificar `onLevelChange`. Poner `nivel: true` en `bombardero` dentro de `catalog.ts`. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, el smoke del motor y que el HUD muestra Nivel 1 y el juego se comporta como en la SPEC 13.
2. **Enemigos.** Añadir `enemies`, su generación, su movimiento, el contacto con el jugador, su muerte por llama con `chain` en las llamas y los puntos. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y una prueba de comportamiento con `Math.random` fijo: aparición en `(9, 1)` y `(10, 1)`, un enemigo rodeado de bloques no se mueve y mata al jugador al compartir casilla.
3. **Superar el nivel.** Sustituir la condición de limpiar el tablero por acabar con todos los enemigos, con la bonificación, el cambio de tablero y `levelTimeS`. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y en la prueba de comportamiento que, al matar al último enemigo, el nivel pasa a 2, la puntuación suma `100 + 5 × floor(timeLeft)` y `timeLeft` pasa a 140.
4. **Mejoras.** Añadir `items`, su aparición al romper bloques, su recogida, los máximos y el texto `BOMBAS a/m ALCANCE r`. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y la prueba de comportamiento con `Math.random` fijo: con `r = 0` aparece una mejora `range` en cada bloque roto, con 0,9 ninguna, y recoger 4 de `range` deja `range` en 5 sin subir más.
5. **Cierre.** `npm run lint`, `npm run build` sin trazas de error, el smoke del motor, una partida en el navegador que supere el nivel 1 (la puntuación sube, el HUD muestra Nivel 2 y se ve un tablero nuevo) y el guardado de una puntuación en `/juegos/bombardero` y `/salon`. Borrar las filas de prueba de `scores`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `catalog.ts` declara `bombardero: { hud: { vidas: false, nivel: true } }` y el HUD de la plataforma muestra Puntuación y Nivel y no muestra Vidas.
- [ ] No hay cambios en `supabase/migrations/`, en `app/globals.css` ni en `app/games/components.tsx`.
- [ ] El HUD muestra Nivel 1 al empezar y `onLevelChange` se llama con 1, 2, 3... sin repetir valores.
- [ ] El nivel 1 tiene 2 enemigos, el nivel 2 tiene 3 y desde el nivel 7 hay 8.
- [ ] Con `Math.random` fijo en 0, los enemigos del nivel 1 aparecen en `(9, 1)` y `(10, 1)` y esas casillas no tienen bloque; ninguno aparece a menos de 8 casillas Manhattan de `(1, 1)` con ningún valor de aleatorio.
- [ ] Un enemigo avanza una casilla cada 0,5 s (±1 fotograma) en el nivel 1 y cada `max(0,25, 0,5 − 0,03 × (n − 1))` s en el nivel `n`.
- [ ] Un enemigo no entra en muros, pilares, bloques ni casillas con bomba, mantiene su dirección mientras la casilla siguiente esté libre y no da media vuelta salvo que sea su única salida.
- [ ] Un enemigo sin ninguna casilla libre alrededor se queda quieto.
- [ ] Compartir casilla con un enemigo abre el modal "FIN DEL JUEGO" con la puntuación final, una sola vez, tanto si el jugador entra en su casilla como si el enemigo entra en la del jugador.
- [ ] Un enemigo que está en una casilla con llama, o que entra en una con llama viva, muere y la puntuación sube `100 × N` de esa llama (200 con `N = 2`).
- [ ] Dos enemigos en la misma casilla que mueren por la misma llama suman 100 × N cada uno.
- [ ] Al destruirse un bloque, con `Math.random` fijo en 0 aparece una mejora `range` en su casilla, con 0,9 no aparece ninguna, y con una secuencia 0 y 0,9 aparece una `bomb`.
- [ ] Una mejora no la destruye la llama que acaba de romper su bloque y sí la destruye una llama posterior que llegue a su casilla.
- [ ] Recoger una mejora `range` sube el alcance en 1 (cruz de 13 casillas con alcance 3 sin obstáculos) y `bomb` sube `maxBombs` en 1, con máximo de 5 cada una; recoger una mejora al máximo no cambia el valor y suma 50.
- [ ] `BOMBAS a/m` muestra las bombas libres sobre el máximo y `ALCANCE r` el alcance actual; ambos se actualizan al recoger una mejora.
- [ ] Al matar al último enemigo con el jugador vivo, la puntuación sube `100 × nivel + 5 × floor(timeLeft)`, el HUD pasa a Nivel 2 y se genera un tablero nuevo con jugador en `(1, 1)`, sin bombas, llamas ni mejoras en el suelo y `timeLeft = 140`.
- [ ] El alcance y el máximo de bombas se conservan al cambiar de nivel.
- [ ] El tiempo del nivel es `max(90, 150 − 10 × (n − 1))` s: 150 en el nivel 1, 140 en el 2 y 90 desde el 7; agotarlo abre el modal con la puntuación actual.
- [ ] Destruir todos los bloques ya no termina la partida ni suma bonificación.
- [ ] Si el jugador muere en el mismo fotograma que el último enemigo, no hay bonificación ni cambio de nivel y se abre el modal.
- [ ] Los bloques destruidos siguen sumando `10 × N`, con `N` las bombas de la cadena, como en la SPEC 13.
- [ ] `onGameOver` se llama una sola vez y `onLivesChange(0)` sigue siendo constante.
- [ ] PAUSA congela los enemigos y el tiempo; REANUDAR continúa sin que un enemigo dé varios pasos de golpe.
- [ ] JUGAR DE NUEVO deja puntuación 0, nivel 1, `timeLeft = 150`, `maxBombs = 2`, `range = 2`, el jugador en `(1, 1)`, 2 enemigos y un tablero nuevo.
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras se juega.
- [ ] Con el modal abierto, ESPACIO no cambia la puntuación y teclear el nombre no mueve al jugador ni pone bombas.
- [ ] GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "bombardero"` y `user_id: null`; tres clics seguidos insertan una sola.
- [ ] Salir de `/jugar/bombardero` y volver no duplica el bucle: los frames por segundo no aumentan tras tres remontajes.
- [ ] `app/games/bombardero/engine.ts` no contiene `document.` y solo usa `window.` para registrar y quitar `keydown`, `keyup` y `blur`.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

- **Sí:** decidido por game-jam a partir del tema "Bombardero"; el usuario no fue consultado. Todas las decisiones de esta spec son propuestas para revisar.
- **Sí:** enemigos que solo vagan, sin perseguir al jugador ni huir de las bombas. Es la IA mínima que añade presión sin salirse de las 500 líneas, y se mantiene verificable con aleatorio fijo.
- **No:** enemigos que persiguen o esquivan. Exigen búsqueda de caminos y otra spec.
- **Sí:** superar el nivel es matar a todos los enemigos, no limpiar el tablero ni llegar a una puerta. Obliga a usar las bombas contra algo móvil y evita que los bloques sean el único objetivo, así que sustituye la condición de la SPEC 13.
- **No:** puerta de salida oculta bajo un bloque. Añade estado y un criterio de descubrimiento a cambio de poco juego.
- **Sí:** los enemigos pueden compartir casilla entre sí. Evita bloqueos entre ellos y no cambia ningún criterio de las bombas.
- **Sí:** enemigos que aparecen a 8 o más casillas del inicio, con un bloque quitado si hace falta. El jugador siempre tiene la zona segura y varios segundos antes del primer contacto.
- **Sí:** el matar enemigos con una cadena multiplica por `N`. El tema premia encadenar y los enemigos son el mejor motivo para hacerlo.
- **Sí:** las mejoras viven dentro de los bloques con probabilidad 0,25 y dos tipos (`range`, `bomb`) con máximo de 5. Cubre la segunda mecánica sin multiplicar los tipos ni los criterios; con 5 bombas y alcance 5 las cadenas llenan el tablero, y por eso el tope.
- **No:** más mejoras (velocidad, escudo, control remoto). Son otras specs.
- **Sí:** una mejora que ya está al máximo se recoge igual y suma 50. Evita casillas con objetos que no se pueden coger.
- **Sí:** las mejoras se conservan entre niveles. Premia a quien llega lejos y compensa los enemigos más rápidos y el tiempo más corto.
- **Sí:** la mejora aparece al terminar la cadena y no la destruye la llama que rompió su bloque. Con un orden de llamadas a `Math.random` fijado el resultado es reproducible.
- **Sí:** el tiempo por nivel baja de 150 a 90 s en pasos de 10. Con 8 enemigos y 90 s la presión es máxima y mantiene las partidas entre 1 y 5 minutos.
- **Sí:** bonificación de nivel `100 × nivel + 5 × floor(timeLeft)`. Mantiene los 5 puntos por segundo de la SPEC 13 y premia el nivel superado.
- **Sí:** `chain` en cada llama. Permite puntuar un enemigo que entra en una llama viva con el `N` de la cadena que la creó, sin estado extra.
- **Sí:** `hud.nivel` pasa a `true` y se notifica con `onLevelChange` solo al cambiar.
- **Sí:** la muerte sigue siendo inmediata; las vidas son de la SPEC 15, que cambiará esa regla.
- **Sí:** la constante `MAX_BOMBS` de la SPEC 13 pasa a ser una variable `maxBombs` y `RANGE` pasa a `range`; sus valores iniciales (2 y 2) no cambian.

## Riesgos

| Riesgo                                                                                | Mitigación                                                                                                            |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Strict Mode monta el efecto dos veces y duplica el bucle                              | `destroy()` cancela el frame y quita `keydown`, `keyup` y `blur`; criterio de frames por segundo                      |
| Envíos repetidos al guardar                                                           | `ref` que bloquea al instante; criterio de tres clics seguidos                                                        |
| Un enemigo queda encerrado entre bloques y el nivel no se puede superar sin romperlos | El jugador puede romper cualquier bloque con bombas y, si no, el tiempo acaba la partida; criterio del enemigo quieto |
| Un enemigo aparece sobre el jugador o muy cerca al empezar                            | Aparece a 8 o más casillas Manhattan de `(1, 1)`; criterio de distancia mínima                                        |
| Las llamadas a `Math.random` para enemigos cambian la secuencia de la SPEC 13         | Los bloques se generan primero con las mismas 144 llamadas; los enemigos usan las siguientes                          |
| Con alcance 5 y 5 bombas el jugador se mata sin remedio                               | El máximo es 5, la mecha de 2 s deja salir y el tiempo no se detiene; se ajusta en la SPEC 15 si hace falta           |
| Quedan enemigos sin que el jugador pueda alcanzarlos (zona rodeada de pilares)        | Todas las casillas libres están conectadas y los bloques son destructibles                                            |
| Dos enemigos matados en la misma llama no suman ambos                                 | Criterio explícito; la prueba de comportamiento cuenta la puntuación                                                  |
| Un enemigo atraviesa una bomba recién puesta                                          | Se calcula "libre" con la lista de bombas del fotograma; criterio de enemigo y bomba                                  |

## Qué **no** está en esta spec

- Vidas, pantalla de espera, partículas, sacudida y avisos visuales (SPEC 15).
- Enemigos que persiguen o esquivan bombas.
- Bombas de control remoto, empujar bombas y otras mejoras.
- Puerta de salida.
- Sonido, assets, controles táctiles, ratón y teclas WASD.
- Cambios en Supabase, en la portada y en los otros juegos.

Cada uno, si llega, va en su propia spec.
