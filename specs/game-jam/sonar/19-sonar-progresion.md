# SPEC 19 — Game jam «Eco en la oscuridad»: SONAR, progresión y profundidad

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06, SPEC 07, SPEC 16, SPEC 18
> **Fecha:** 2026-11-18
> **Objetivo:** Hacer SONAR rejugable con un nivel cada 5 perlas que añade minas, acorta el eco y el aire que da cada perla, minas a la deriva que dejan obsoleto el mapa memorizado y un multiplicador por recoger perlas en silencio.

## Por qué existe esta spec

La SPEC 18 dejó SONAR jugable de principio a fin: un submarino ciego, un ping, 3 perlas, 5 minas fijas y 45 s de aire. Con minas quietas, el jugador memoriza el mapa en el primer ping y las partidas se parecen todas: la única presión es el aire, que 6 s por perla basta para sostener indefinidamente. Esta spec añade lo que lo hace rejugable sin cambiar el tema ni la entrada: niveles que endurecen el mar, minas que se desplazan (el mapa que recuerdas caduca) y un premio por no hacer ruido.

No toca Supabase, la portada ni `components.tsx`: solo el motor `app/games/sonar/engine.ts` y la línea de `sonar` en `app/games/catalog.ts`, que pasa a mostrar Nivel. Sigue la receta de `.claude/skills/add-game/references/pattern.md`.

## Alcance

**Dentro:**

- Nivel `1 + floor(perlas / 5)`, con `onLevelChange` y `hud.nivel: true` en `catalog.ts`.
- Una mina nueva en cada subida de nivel hasta 11 minas.
- Minas a la deriva (50 px/s) desde el nivel 3, en número creciente.
- Duración del eco y aire por perla que disminuyen con el nivel.
- Multiplicador ×2 por recoger una perla sin haber emitido ningún ping desde la anterior.
- Mecánicas de la SPEC 18 sin cambios salvo las constantes que esta spec nombra.

**Fuera de alcance (specs futuras):**

- Vidas, pantalla de espera, estela, partículas, sacudida y avisos visuales: SPEC 20.
- Nuevos objetos (cofres, corrientes, faros) y enemigos.
- Sonido, assets, controles distintos y teclas WASD.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cambios en Supabase, en la portada y en los otros juegos.

## Modelo de datos

Esta spec no introduce estructuras en la base de datos: la ficha de la SPEC 18 no cambia.

Entrada del registro (`app/games/catalog.ts`), la única línea que cambia: `hud.nivel` pasa a `true` y `controles` se conserva igual.

```ts
sonar: { hud: { vidas: false, nivel: true }, controles: [/* sin cambios */] },
```

Constantes nuevas y funciones del nivel (las de la SPEC 18 se conservan, salvo `REVEAL_S` y `O2_PER_PEARL`, que pasan a ser funciones del nivel con el mismo valor en el nivel 1):

```ts
const LEVEL_PEARLS = 5; // perlas por nivel
const MAX_MINES = 11;
const DRIFT_SPEED = 50; // px/s
const MAX_DRIFTERS = 4;
const SILENCE_MULT = 2;
const level = (pearls: number) => 1 + Math.floor(pearls / LEVEL_PEARLS);
const mineCount = (lv: number) => Math.min(5 + (lv - 1), MAX_MINES);
const drifters = (lv: number) =>
  Math.min(Math.floor((lv - 1) / 2), MAX_DRIFTERS);
const revealS = (lv: number) => Math.max(1.0, 2.0 - 0.1 * (lv - 1));
const o2PerPearl = (lv: number) => Math.max(3, 6 - 0.5 * (lv - 1));
```

Estado nuevo:

```ts
interface Mine extends Thing {
  dir: 1 | -1; // sentido de la deriva
}
let lv: number; // nivel actual
let pingsSinceLast: number; // pings emitidos desde la última perla (o desde el inicio)
```

`mines` pasa a ser `Mine[]` (con `dir = 1` al crearse).

Tabla de niveles (de las fórmulas):

| Nivel | Perlas acumuladas | Minas | A la deriva | Eco (s) | Aire por perla (s) |
| ----- | ----------------- | ----- | ----------- | ------- | ------------------ |
| 1     | 0–4               | 5     | 0           | 2,0     | 6,0                |
| 2     | 5–9               | 6     | 0           | 1,9     | 5,5                |
| 3     | 10–14             | 7     | 1           | 1,8     | 5,0                |
| 5     | 20–24             | 9     | 2           | 1,6     | 4,0                |
| 7     | 30–34             | 11    | 3           | 1,4     | 3,0                |
| 9     | 40–44             | 11    | 4           | 1,2     | 3,0                |
| 11+   | 50+               | 11    | 4           | 1,0     | 3,0                |

Reglas nuevas o modificadas:

- **Nivel:** se recalcula tras recoger una perla. Si sube, se notifica con `onLevelChange(lv)` (solo cuando cambia) y se añade una mina si `mines.length < mineCount(lv)`. `onLevelChange(1)` se llama una vez al empezar y tras `restart()`.
- **Mina nueva:** se coloca con la regla de celdas libres de la SPEC 18 (una llamada a `Math.random`), excluyendo las celdas de las minas actuales (por su posición presente, no la inicial), las de las perlas y las 9 celdas a distancia de Chebyshev menor que 2 respecto de la celda actual del submarino. Nace invisible y con `dir = 1`.
- **Deriva:** las primeras `drifters(lv)` minas del arreglo `mines` (en orden de creación) se mueven a `50 × dt` px por fotograma. Las de índice par lo hacen en horizontal y las de índice impar en vertical, empezando hacia `+x` o `+y` (`dir = 1`). Al alcanzar el borde (`x` fuera de `[14, 786]` o `y` fuera de `[14, 586]`) se limita la posición y se invierte `dir`. Las minas a la deriva se mueven aunque no sean visibles; su `reveal` no se toca. Las minas fijas y las de deriva se tratan igual en colisión (distancia ≤ 26).
- **Celdas de las minas:** al colocar perlas y minas nuevas, la celda de una mina es la de su posición actual `(floor(x / 100), floor(y / 100))`, no su centro inicial.
- **Eco por nivel:** al revelar un objeto, `reveal = revealS(lv)` con el nivel del momento del cruce. Los `reveal` que ya corrían no cambian. El desvanecimiento de 0,5 s se conserva: con `revealS = 1,0` el objeto se ve a opacidad plena 0,5 s y se desvanece otros 0,5 s.
- **Aire por perla:** al recoger una perla, `o2` sube `o2PerPearl(lv)` con el nivel **anterior** a la recogida (el que había al cruzar la perla), con tope de 45.
- **Silencio:** `pingsSinceLast` empieza en 0, sube 1 con cada ping emitido y vuelve a 0 al recoger una perla. Si al recoger una perla `pingsSinceLast = 0`, sus puntos se multiplican por 2: 100 → 200 (visible) y 150 → 300 (a ciegas). Si no, valen 100 o 150 como en la SPEC 18. Con dos perlas en un mismo fotograma la primera consume el silencio y la segunda ya no lo tiene.
- **Orden de un fotograma (`update(dt)`):** (1) bajar `o2`, `pingCd` y los `reveal`; (2) mover el submarino; (3) mover las minas a la deriva; (4) avanzar el anillo y revelar; (5) mina; (6) perlas, nivel y mina nueva; (7) aire agotado. Todo lo demás de la SPEC 18 se conserva.
- **Fin y notificaciones:** igual que en la SPEC 18, con `onLevelChange` notificado antes de `onGameOver`.

Dibujo: igual que en la SPEC 18. `PERLAS n` se conserva en `(780, 30)`. Las minas a la deriva se dibujan en su posición actual, visibles o no según su `reveal`.

Convenciones: las de la SPEC 18.

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas") y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components, según exige `AGENTS.md`.

1. **Nivel y mina nueva.** Añadir `level`, `mineCount`, `lv`, `onLevelChange` y la mina nueva en cada subida; mover `catalog.ts` a `hud.nivel: true`. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, el smoke del motor y, en el navegador, que el HUD muestra Nivel 1 y que el motor mantiene 5 minas en el nivel 1.
2. **Funciones por nivel.** Sustituir `REVEAL_S` y `O2_PER_PEARL` por `revealS(lv)` y `o2PerPearl(lv)`. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y una prueba de comportamiento escrita fuera del repo (sección 8 de `pattern.md`) que compruebe la tabla de niveles para los niveles 1, 2, 3, 5, 7, 9 y 11.
3. **Silencio.** Añadir `pingsSinceLast` y el multiplicador. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y la prueba con `Math.random` fijo en 0 de la SPEC 18 (nadar a la perla de `(550, 50)` sin pingar): ahora suma 300, y con un ping previo suma 150.
4. **Deriva.** Añadir `dir`, `DRIFT_SPEED`, `drifters(lv)` y el rebote. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y la prueba de comportamiento: con el nivel 3 forzado, la mina 0 recorre 50 px por segundo hacia `+x`, rebota en `x = 786` y vuelve; la mina 1 no se mueve.
5. **Cierre.** `npm run lint`, `npm run build` sin trazas de error y, en el navegador, una partida que llegue al nivel 2 comprobando HUD, guardado y que el resto de juegos no cambian. Borrar las filas de prueba de `scores`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] El HUD de `/jugar/sonar` muestra Puntuación y Nivel y sigue sin mostrar Vidas.
- [ ] El nivel es `1 + floor(perlas / 5)`: la perla número 5 lleva al nivel 2, la 10 al 3 y la 50 al 11; `onLevelChange` se llama solo cuando cambia, y `onLevelChange(1)` al empezar y tras JUGAR DE NUEVO.
- [ ] Cada subida de nivel añade una mina invisible en una celda libre, hasta un máximo de 11 (nivel 7); en el nivel 7 y siguientes no se añaden más.
- [ ] La mina nueva nunca nace en una celda con mina, con perla ni a menos de 2 celdas (Chebyshev) del submarino.
- [ ] En el nivel 3 se mueve 1 mina; en el 5, 2; en el 7, 3; desde el 9, 4; en los niveles 1 y 2 ninguna.
- [ ] Una mina a la deriva se desplaza a 50 px/s (±1 fotograma), en horizontal si su índice es par y en vertical si es impar, rebota en los bordes y se mueve aunque esté invisible.
- [ ] Una mina a la deriva que toca al submarino (distancia ≤ 26) termina la partida igual que una fija.
- [ ] Los objetos revelados duran `max(1,0, 2,0 − 0,1 × (nivel − 1))` s: 2,0 en el nivel 1, 1,8 en el 3, 1,0 desde el 11 (±1 fotograma).
- [ ] Recoger una perla repone `max(3, 6 − 0,5 × (nivel − 1))` s de aire con tope de 45: 6 en el nivel 1, 5 en el 3, 3 desde el 7.
- [ ] Una perla recogida sin haber emitido ningún ping desde la anterior (o desde el inicio) suma el doble: 200 si era visible y 300 si no.
- [ ] Un ping emitido (aunque no revele nada) corta el silencio: la siguiente perla suma 100 o 150, y la que viene después, si no hay más pings, vuelve a sumar el doble.
- [ ] Con dos perlas recogidas en un mismo fotograma, solo la primera recibe el multiplicador.
- [ ] Las perlas nuevas y las minas nuevas respetan que la celda de una mina a la deriva es la de su posición actual.
- [ ] `onScoreChange`, `onLevelChange` y `onGameOver` respetan las trampas del patrón: solo se llaman al cambiar el valor, y `onGameOver` una sola vez y después de la última notificación.
- [ ] PAUSA congela también las minas a la deriva; REANUDAR continúa sin salto de posición.
- [ ] JUGAR DE NUEVO deja nivel 1, 5 minas fijas, `PERLAS 0` y `pingsSinceLast = 0`.
- [ ] Las flechas y ESPACIO no hacen scroll; salir y volver tres veces no duplica el bucle.
- [ ] `app/games/sonar/engine.ts` no contiene `document.`.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

- **Sí:** decidido por game-jam a partir del tema "Eco en la oscuridad"; el usuario no fue consultado. Todas las decisiones de esta spec son propuestas para revisar.
- **Sí:** un nivel cada 5 perlas. El ritmo de una perla cada 4–8 s da un nivel cada 20–40 s, suficiente para sentir el avance en una partida de 1 a 3 minutos.
- **Sí:** las minas a la deriva hacen caducar el mapa. Es el tema aplicado a la dificultad: lo que viste hace 2 s puede ya no estar donde crees, y el eco más corto del nivel avanzado obliga a pingar más seguido.
- **No:** minas que persiguen al submarino. Exige IA y deja de ser un juego de memoria.
- **Sí:** las minas a la deriva son las primeras del arreglo y alternan eje horizontal y vertical. Es determinista y no consume `Math.random`, así que la prueba con aleatorio fijo no cambia.
- **Sí:** el silencio multiplica por 2. Es el contrapeso del ping: pingar es gratis en la SPEC 18, y aquí cada ping cuesta el bonus de la siguiente perla. El jugador decide entre seguridad y puntos.
- **No:** que el ping gaste aire. Mezcla dos recursos y vuelve opaco el equilibrio.
- **Sí:** el multiplicador del silencio actúa sobre los 100/150 puntos: la perla ciega y silenciosa vale 300, el triple de la visible normal. El tope práctico lo marca el riesgo de nadar sin ver.
- **Sí:** el aire que da una perla baja a un mínimo de 3 s y el eco a un mínimo de 1,0 s. Con 3 s por perla y ≥ 1,25 s de nado hasta la siguiente, las partidas largas se acaban solas, y el mínimo evita un eco imposible de aprovechar.
- **Sí:** el aire por perla usa el nivel anterior a la recogida (el de la perla recogida), no el nuevo. Evita que recoger la perla 5 cambie su propio premio y simplifica la prueba.
- **Sí:** el máximo de 11 minas en 39 celdas deja siempre pasillos de al menos una celda. Con 4 minas a la deriva y 7 fijas, el mar sigue siendo recorrible.
- **No:** niveles con tablero nuevo o pantalla de transición. El mar es el mismo; evita parar el ritmo.
- **Sí:** esta spec cambia `REVEAL_S` y `O2_PER_PEARL` de constantes a funciones del nivel; en el nivel 1 valen lo mismo que en la SPEC 18, así que las pruebas de la SPEC 18 siguen siendo válidas con el nivel 1, salvo la de las perlas que ahora suman el doble sin ping (se ajusta en el paso 3).

## Riesgos

| Riesgo                                                         | Mitigación                                                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Una mina a la deriva aparece encima del submarino              | Las minas nuevas excluyen las celdas a menos de 2 del submarino; las de deriva se mueven 50 px/s y se ven al pingar |
| Una mina a la deriva atraviesa una perla y la deja "protegida" | Es parte del juego; la perla sigue pudiendo recogerse acercándose por otro lado                                     |
| El multiplicador por silencio se explota                       | Las perlas nuevas solo nacen a 200 px o más; sin ping, la perla visible vale 200 y exige haberla visto antes        |
| Partidas demasiado largas en niveles bajos                     | El aire por perla baja hasta 3 s y el eco hasta 1,0 s; el nivel 7 ya cuesta más aire que lo que da                  |
| Un cambio de constantes rompe las pruebas de la SPEC 18        | El nivel 1 conserva los valores de la SPEC 18; la única prueba que cambia está indicada en el paso 3                |
| Los listeners se duplican al remontar                          | Sin cambios en `destroy()`; criterio de bucle tras tres remontajes                                                  |

## Qué **no** está en esta spec

- Vidas, pantalla de espera, estela, partículas, sacudida y avisos visuales (SPEC 20).
- Objetos nuevos y enemigos.
- Sonido, assets, teclas WASD y ratón.
- Ranking por tiempo o donde menos puntos es mejor, y validación de puntuaciones en servidor.
- Cambios en Supabase, en la portada y en los otros juegos.

Cada uno, si llega, va en su propia spec.
