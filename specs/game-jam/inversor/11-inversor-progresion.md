# SPEC 11 — Game jam «Gravedad invertida»: INVERSOR, progresión y profundidad

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06, SPEC 07, SPEC 10
> **Fecha:** 2026-11-17
> **Objetivo:** Hacer rejugable INVERSOR con niveles que aceleran el mundo, tres obstáculos nuevos y cristales coleccionables que obligan a invertir la gravedad en el aire.

## Por qué existe esta spec

La SPEC 10 dejó INVERSOR jugable de principio a fin: un cubo que invierte la gravedad entre un suelo y un techo, esquiva pinchos a velocidad constante y puntúa por distancia. Así una partida se parece siempre a la anterior. Esta spec añade lo que la hace rejugable sin cambiar el tema ni la entrada: un nivel cada 500 puntos con velocidad creciente, obstáculos más exigentes según el nivel y cristales en mitad del túnel que solo se cogen invirtiendo la gravedad en el aire.

No toca Supabase, la portada ni `components.tsx`: solo el motor `app/games/inversor/engine.ts` y la línea de `inversor` en `app/games/catalog.ts`, que pasa a mostrar Nivel en el HUD. Sigue la receta de `.claude/skills/add-game/references/pattern.md`.

## Alcance

**Dentro:**

- Niveles: `nivel = floor(puntuación / 500) + 1`, con `onLevelChange` y `hud.nivel: true` en `catalog.ts`.
- Velocidad del mundo creciente por nivel, con tope.
- Obstáculos nuevos: columna (desde el nivel 3) y pareja de pinchos en superficies opuestas (desde el nivel 5).
- Huecos entre grupos medidos en tiempo, para que el reto no dependa de la velocidad.
- Cristales: 50 puntos cada uno, en tres carriles, en mitad del hueco entre dos grupos.
- La puntuación pasa a ser distancia más bonus de cristales.
- Mecánicas de la SPEC 10 sin cambios: física, entrada, hitbox del cubo y de los pinchos, fin al chocar.

**Fuera de alcance (specs futuras):**

- Vidas, pantalla de espera, estela, partículas y sacudida: SPEC 12.
- Sonido, assets, controles táctiles o para móvil.
- Más tipos de obstáculo, obstáculos móviles, power-ups o jefes.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cambios en Supabase, en la portada y en los otros juegos.

## Modelo de datos

Esta spec no introduce estructuras en la base de datos: la ficha de la SPEC 10 no cambia.

Entrada del registro (`app/games/catalog.ts`), la única línea que cambia:

```ts
inversor: { hud: { vidas: false, nivel: true } },
```

Constantes nuevas del motor (las de la SPEC 10, salvo las que se indican, se conservan):

```ts
const BASE_SPEED = 320; // sustituye a SPEED: velocidad del nivel 1, px/s
const SPEED_PER_LEVEL = 32;
const MAX_SPEED = 640; // se alcanza en el nivel 11
const LEVEL_POINTS = 500; // puntos por nivel
const GAP_MIN_S = 1.1; // sustituye a GAP_MIN_PX
const GAP_MAX_S = 1.9; // sustituye a GAP_MAX_PX
const COLUMN_W = 40;
const COLUMN_H = 120;
const COLUMN_HIT_W = 32; // hitbox centrada, 32×120, pegada a la superficie
const PAIR_DELAY_S = 0.9; // tiempo entre los dos pinchos de una pareja
const CRYSTAL_SIZE = 24;
const CRYSTAL_SCORE = 50;
const CRYSTAL_CHANCE = 0.5;
const CRYSTAL_LANES = [56, 300, 544]; // centro y de los carriles: techo, medio y suelo
```

Estado nuevo y modificado:

```ts
type Kind = "spike1" | "spike2" | "column" | "pair";
interface Crystal {
  x: number; // borde izquierdo
  cy: number; // centro vertical, uno de CRYSTAL_LANES
}
let crystals: Crystal[];
let bonus: number; // puntos por cristales
let level: number; // 1, 2, 3...
let speed: number; // px/s del nivel actual
```

Reglas:

- **Puntuación:** `floor(distance / 10) + bonus`. `bonus` suma 50 por cristal.
- **Nivel:** `floor(puntuación / 500) + 1`. Cada vez que cambia se notifica con `onLevelChange` y `speed` se actualiza al instante.
- **Velocidad:** `speed = min(640, 320 + (nivel − 1) × 32)`: 320 en el nivel 1, 352 en el 2 y 640 desde el 11. El mundo, los obstáculos y los cristales se mueven a `speed`.
- **Huecos:** al programar el siguiente grupo, `nextSpawn += speed × (1,1 + r × 0,8)`, con `speed` vigente en ese momento. En el nivel 1 equivale a 352…608 px. Sustituye a los 350…600 px de la SPEC 10. `FIRST_SPAWN_PX` sigue en 600.
- **Tipos disponibles por nivel:** niveles 1 y 2: `spike1`, `spike2`; niveles 3 y 4: además `column`; desde el nivel 5: además `pair`. El tipo es `disponibles[floor(r × disponibles.length)]`, con `r` de la tercera llamada a `Math.random`. Con dos disponibles, `r < 0,5` da `spike1`, igual que en la SPEC 10.
- **Columna:** rectángulo de 40×120 pegado a la superficie elegida. Hitbox de 32×120 centrada (`x + 4 … x + 36`): `y = 440…560` en el suelo y `40…160` en el techo.
- **Pareja:** un `spike1` en la superficie elegida en `x` y otro en la **opuesta** en `x + round(speed × 0,9)`. Además de `nextSpawn`, la pareja suma ese espaciado, para que el hueco hasta el siguiente grupo cuente desde el segundo pincho.
- **Llamadas a `Math.random` por aparición**, en este orden: (1) hueco, (2) superficie (`< 0,5` suelo), (3) tipo, (4) cristal (`< 0,5` hay cristal) y, solo si hay cristal, (5) carril `CRYSTAL_LANES[floor(r × 3)]`.
- **Cristal:** rombo de 24×24 con su borde izquierdo en `x_aparición + espaciado_pareja + hueco_px / 2`, es decir, en mitad del tramo libre que sigue al último pincho del grupo; `espaciado_pareja` es 0 salvo en una pareja. Los carriles de techo y suelo coinciden con la altura del cubo posado; el central solo se alcanza en el aire.
- **Recoger:** hay recogida si el rectángulo del cristal solapa con el del cubo (32×32 en `(160, y)`) con área positiva. El cristal desaparece, suma 50 y se notifica la puntuación. Un cristal que sale por la izquierda (`x + 24 < 0`) se elimina sin puntos.
- **Callbacks:** `onLevelChange(1)` al inicio y tras `restart()`; el resto, como en la SPEC 10. `onLivesChange(0)` sigue siendo constante.

Dibujo (valores iniciales, se ajustan viendo la captura): columnas `#ff4fd8` con un filo `#ffb0f0` en la cara que mira al cubo; cristales `#4de8ff` con un brillo interior `#c8f6ff`.

Convenciones: las de la SPEC 10 (canvas 800×600, tiempos en segundos, `dt` ≤ 50 ms).

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas"), la sección 6 de `.claude/skills/add-game/references/porting.md` y la SPEC 10, y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components, según exige `AGENTS.md`.

1. **Niveles y velocidad.** En `engine.ts`, sustituir `SPEED` por `speed` calculado por nivel, componer la puntuación (`distance` más `bonus`, que aún vale 0), llamar a `onLevelChange` y poner `nivel: true` en `inversor` dentro de `catalog.ts`. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, el smoke del motor, y en el navegador el HUD muestra Nivel y la puntuación sigue subiendo.
2. **Huecos y obstáculos nuevos.** Pasar los huecos a tiempo, añadir `column` y `pair`, y ampliar las llamadas a `Math.random` a las tres primeras del orden definido (el resto llega en el paso 3). Verificar: `npx tsc --noEmit`, `npx eslint app/games` y la prueba de comportamiento con `Math.random` fijo y entrada simulada.
3. **Cristales.** Añadir `crystals`, `bonus`, su aparición (llamadas 4 y 5), recogida, dibujo y limpieza en `restart()`. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y, en el navegador, recoger un cristal central invirtiendo en el aire suma 50.
4. **Cierre.** `npm run lint`, `npm run build` sin trazas de error y una partida hasta el nivel 3 como mínimo, guardada y visible en `/juegos/inversor` y en la pestaña de INVERSOR de `/salon`. Borrar todas las filas de prueba de `scores`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `catalog.ts` declara `inversor: { hud: { vidas: false, nivel: true } }` y el HUD de la plataforma muestra Puntuación y Nivel, sin Vidas.
- [ ] No hay cambios en `supabase/migrations/`, en `app/globals.css` ni en `app/games/components.tsx`.
- [ ] El nivel es `floor(puntuación / 500) + 1`: con 499 puntos es 1, con 500 es 2 y con 1000 es 3.
- [ ] La velocidad es 320 px/s en el nivel 1, 352 en el 2, 384 en el 3, 640 en el 11 y sigue en 640 en el 12.
- [ ] `onLevelChange` se llama una vez al empezar y otra vez cada vez que cambia el nivel, nunca dos veces con el mismo valor.
- [ ] Con `Math.random` fijo en 0 y nivel 1, el primer grupo es un `spike1` en el suelo y el siguiente se programa 352 px de distancia después.
- [ ] Con `Math.random` fijo en 0,99, el nivel 1 genera `spike2`, el nivel 3 genera `column` y el nivel 5 genera `pair`; con 0,99 en el nivel 11 el hueco programado, sin contar el espaciado de la pareja, es (1,1 + 0,99 × 0,8) s × 640 px/s = 1,892 s × 640 px/s = 1 211 px (±1).
- [ ] La columna tiene una hitbox de 32×120: en el suelo ocupa `y = 440…560` y en el techo `y = 40…160`.
- [ ] Chocar con la columna termina la partida; el cubo posado en la superficie opuesta no choca con ella.
- [ ] La pareja aparece con un pincho en la superficie elegida y otro en la opuesta, separados `round(speed × 0,9)` px (403 px en el nivel 5, 576 px en el nivel 11), y el hueco hasta el siguiente grupo cuenta desde el segundo pincho.
- [ ] Un cubo que invierte en cuanto pasa el primer pincho de una pareja llega a la superficie opuesta antes de que lo alcance el segundo, a 448 px/s (nivel 5) y a 640 px/s (tiempo de cruce de unos 0,52 s medido en la prueba, menor que los 0,76 s y 0,80 s disponibles).
- [ ] Con `Math.random` fijo en 0, la primera aparición coloca un cristal en el carril del techo (`cy = 56`) en la mitad del tramo libre (`x = 820 + 352 / 2 = 996`).
- [ ] Con `Math.random` fijo en 0,9 hay cristal en la aparición solo si la cuarta llamada es menor que 0,5: con 0,9 no hay cristal y no se consume la quinta llamada.
- [ ] Recoger un cristal suma exactamente 50 puntos, lo hace desaparecer y se refleja en el HUD en el mismo fotograma.
- [ ] El cristal del carril central solo se recoge con el cubo en el aire; el del techo y el del suelo, con el cubo posado en esa superficie.
- [ ] Un cristal que sale por la izquierda no suma puntos y se elimina de la lista.
- [ ] Los 50 puntos de un cristal pueden subir el nivel: con 480 puntos de distancia más un cristal, el nivel pasa a 2 y `speed` a 352.
- [ ] PAUSA congela el juego, incluidos cristales y obstáculos; REANUDAR continúa donde estaba, sin salto de distancia.
- [ ] FIN y el choque abren el modal "FIN DEL JUEGO" con la puntuación final, que incluye el bonus de cristales.
- [ ] GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "inversor"` y la puntuación final; tres clics seguidos insertan una sola fila.
- [ ] JUGAR DE NUEVO deja puntuación 0, nivel 1, velocidad 320 px/s, `bonus` en 0, sin cristales ni obstáculos en pantalla.
- [ ] Salir de `/jugar/inversor` y volver no duplica el bucle: los frames por segundo no aumentan tras tres remontajes.
- [ ] El canvas se ve completo sin scroll horizontal a 1440 px y a 768 px de ancho.
- [ ] `app/games/inversor/engine.ts` no contiene `document.` y solo usa `window.` para registrar y quitar `keydown`.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

- **Sí:** decidido por game-jam a partir del tema «Gravedad invertida»; el usuario no fue consultado. Todas las decisiones de esta spec son propuestas para revisar.
- **Sí:** el nivel se calcula sobre la puntuación total (distancia más cristales), no solo sobre la distancia. Los cristales premian el riesgo también con progresión y el HUD enseña un solo número que explica el nivel.
- **No:** nivel por tiempo o por distancia. La puntuación ya es el número que el jugador ve en el HUD.
- **Sí:** +32 px/s por nivel con tope de 640 px/s en el nivel 11. A 640 px/s un fotograma de 50 ms mueve 32 px, la mitad de los 64 px que suman el cubo y la hitbox de un pincho, así que no se atraviesa un pincho entre dos fotogramas.
- **No:** aceleración continua sin tope. Rompería el límite de `dt` y haría las partidas imposibles pasado el nivel 11.
- **Sí:** huecos en segundos (1,1 a 1,9 s) en lugar de píxeles. Con velocidad creciente, el tiempo para reaccionar y para cruzar de superficie (unos 0,52 s) se mantiene. **Cambia la SPEC 10:** el hueco mínimo del nivel 1 pasa de 350 a 352 px.
- **Sí:** la columna y la pareja se desbloquean por nivel (3 y 5). Los primeros niveles se parecen al juego de la SPEC 10 y el jugador aprende una cosa cada vez.
- **Sí:** la pareja separa sus pinchos `0,9 × speed` px y suma ese espaciado al hueco. Con 0,75 s el margen sobre el tiempo de cruce a 448 px/s (el nivel 5, el más lento con parejas) era de 0,09 s; con 0,9 s es de 0,24 s.
- **Sí:** el cristal central solo se coge en el aire. Es el único motivo para invertir sin necesidad de esquivar, y es la mecánica del tema aplicada a un bonus.
- **Sí:** 50 puntos por cristal, equivalentes a 500 px de distancia. Compensa el desvío de arriesgar sin dominar la puntuación.
- **Sí:** el cristal aparece en mitad del tramo libre, a ≥ 176 px de cualquier pincho en el nivel 1. No se superpone con un obstáculo y no exige coger el cristal para sobrevivir.
- **Sí:** el orden de las cinco llamadas a `Math.random` queda fijado en la spec y las tres primeras son las de la SPEC 10, para que su prueba con aleatorio fijo siga valiendo.
- **No:** vidas, pantalla de espera y efectos. Son de la SPEC 12.

## Riesgos

| Riesgo                                                                             | Mitigación                                                                                              |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Strict Mode monta el efecto dos veces y duplica el bucle                           | `destroy()` cancela el frame y quita el listener; criterio de frames por segundo tras tres remontajes   |
| Una combinación de columna y pareja imposible de esquivar                          | Hueco mínimo de 1,1 s tras cualquier grupo y espaciado de pareja de 0,9 s; se mide en la prueba         |
| El cristal central empuja al jugador a invertir justo antes de un pincho           | Aparece a la mitad del tramo libre (≥ 0,55 s de cualquier grupo); criterio de posición                  |
| Cambiar la velocidad al instante hace saltar la distancia o los obstáculos         | Solo cambia `speed`; las posiciones ya calculadas no se tocan; criterio de nivel con bonus              |
| El bonus de un cristal sube dos niveles de golpe                                   | Un cristal suma 50 y un nivel cuesta 500: no puede saltar dos niveles; criterio de nivel 499/500        |
| Las cinco llamadas a `Math.random` rompen la prueba de la SPEC 10                  | Las tres primeras conservan su orden y significado; los criterios de esta spec fijan los nuevos valores |
| A 640 px/s el texto de nivel en el HUD y el mundo no se corresponden tras REANUDAR | `resume()` pone `lastTime = null`; el nivel y la velocidad vuelven a calcularse desde la puntuación     |

## Qué **no** está en esta spec

- Vidas, pantalla de espera, estela, partículas y sacudida (SPEC 12).
- Sonido, assets, controles táctiles y ratón.
- Más tipos de obstáculo, obstáculos móviles, power-ups y jefes.
- Ranking por tiempo o donde menos puntos es mejor, y validación de puntuaciones en servidor.
- Cambios en Supabase, en la portada y en los otros juegos.

Cada uno, si llega, va en su propia spec.
