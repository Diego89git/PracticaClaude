# SPEC 22 — Game jam «Invasores»: ENJAMBRE, progresión y profundidad

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06, SPEC 07, SPEC 16, SPEC 21
> **Fecha:** 2026-11-18
> **Objetivo:** Convertir ENJAMBRE en su variante «Reflejo», con un escudo que devuelve los disparos del enjambre como balas perforantes que encadenan puntos, drones blindados que solo caen con ellas y oleadas numeradas que aceleran la formación y su fuego.

## Por qué existe esta spec

La SPEC 21 dejó ENJAMBRE jugable de principio a fin en su variante «Clásica»: un cañón, una bala, 32 drones que bajan y oleadas infinitas e iguales. Tiene dos límites. Todas las oleadas son idénticas, así que la partida no progresa; y el jugador solo tiene una respuesta a los disparos del enjambre, apartarse. Esta spec convierte el juego en la variante **«Reflejo»**, que se juega de otra forma: los disparos del enjambre dejan de ser solo una amenaza y pasan a ser la mejor munición. Con un escudo de 0,25 s el cañón devuelve el disparo hacia arriba como una bala perforante que atraviesa columnas enteras y multiplica los puntos de cada dron que cruza. Desde la oleada 2 aparecen drones blindados que la bala normal no rompe: solo caen con un reflejo, así que hay que buscar el fuego enemigo en lugar de huir de él. Y cada oleada sube de nivel: la formación empieza más abajo, marcha más rápido y dispara más.

No toca Supabase, la portada ni `components.tsx`: solo el motor `app/games/enjambre/engine.ts` y la línea de `enjambre` en `app/games/catalog.ts`, que pasa a mostrar Nivel y añade el botón del escudo al mando táctil. Sigue la receta de `.claude/skills/add-game/references/pattern.md`.

## Alcance

**Dentro:**

- Escudo con ↑: activo 0,25 s, enfriamiento de 0,8 s desde que se levanta; mientras está activo el cañón no dispara.
- Reflejo: un disparo enemigo que toca el escudo activo vuelve hacia arriba a 480 px/s como bala reflejada.
- Bala reflejada perforante: destruye todos los drones que cruza y el k-ésimo dron que destruye vale sus puntos × `min(k, 4)`.
- Drones blindados en la fila 0 desde el nivel 2: la bala normal no los rompe; la reflejada sí, y valen el doble.
- Nivel = número de oleada, con `onLevelChange` y `hud.nivel: true` en `catalog.ts`; `OLEADA n` deja de dibujarse en el canvas.
- Dificultad por nivel: formación más baja al empezar, marcha más rápida, disparo más frecuente y más disparos a la vez.
- Bonificación de 50 × nivel al limpiar una oleada.
- Botón redondo `◆ ESCUDO` en el mando táctil.
- Mecánicas de la SPEC 21 sin cambios salvo las constantes que esta spec nombra.

**Fuera de alcance (specs futuras):**

- Vidas, pantalla de espera, la Reina del enjambre, estrellas, partículas, sacudida y avisos visuales: SPEC 23.
- Búnkeres o barreras destructibles.
- Drones que bajan en picado o se separan de la formación.
- Skins y `setSkin`.
- Sonido, assets, teclas WASD y ratón.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cambios en Supabase, en la portada, en `components.tsx` y en los otros juegos.

## Modelo de datos

Esta spec no introduce estructuras en la base de datos: la ficha de la SPEC 21 no cambia.

Entrada del registro (`app/games/catalog.ts`), la única línea que cambia: `hud.nivel` pasa a `true` y se añade el botón del escudo; los tres botones de la SPEC 21 se conservan igual.

```ts
enjambre: {
  hud: { vidas: false, nivel: true },
  controles: [
    /* ◀ y ▶ (mantener) y DISPARO (pulso), sin cambios */
    { code: "ArrowUp", etiqueta: "◆ ESCUDO", aria: "Levantar el escudo", modo: "pulso", zona: "derecha" },
  ],
},
```

`ArrowUp` con una etiqueta de más de un carácter cae en los botones redondos, no en la cruceta (regla de la SPEC 17).

Constantes nuevas y funciones del nivel (las de la SPEC 21 se conservan; `ORIGIN_Y`, `FIRE_S`, `MAX_SHOTS` y el tiempo de paso pasan a depender del nivel, con el mismo valor que en la SPEC 21 en el nivel 1):

```ts
// Escudo
const SHIELD_W = 60;
const SHIELD_H = 10;
const SHIELD_TOP = 524; // ocupa y de 524 a 534, por encima del cañón (542)
const SHIELD_S = 0.25; // tiempo activo
const SHIELD_CD_S = 0.8; // enfriamiento desde que se levanta (incluye los 0,25 s activos)
// Bala reflejada
const REFLECT_SPEED = 480; // px/s hacia arriba
const REFLECT_W = 4;
const REFLECT_H = 12;
const MAX_CHAIN = 4; // el multiplicador de la cadena no pasa de ×4
// Blindados
const ARMOR_ORDER = [0, 7, 1, 6, 2, 5, 3, 4]; // columnas de la fila 0 que se blindan, de fuera hacia dentro
const ARMOR_MULT = 2;
// Oleadas
const WAVE_BONUS = 50; // × nivel al limpiar la oleada
const speedMul = (lv: number) => Math.max(0.5, 1 - 0.07 * (lv - 1));
const originY = (lv: number) => 100 + 10 * Math.min(lv - 1, 5);
const fireS = (lv: number) => Math.max(0.45, 1.0 - 0.08 * (lv - 1));
const maxShots = (lv: number) => Math.min(3 + Math.floor((lv - 1) / 2), 6);
const armored = (lv: number) => Math.min(lv - 1, 8);
// stepS(vivos, lv) = (0,05 + 0,55 × (vivos − 1) / 31) × speedMul(lv)
```

Estado nuevo:

```ts
interface Drone {
  col: number;
  row: number;
  alive: boolean;
  armor: boolean; // blindado: solo lo destruye una bala reflejada
}
interface Reflected {
  x: number; // centro horizontal
  y: number; // borde superior
  chain: number; // drones destruidos por esta bala
}
let lv: number; // nivel actual = número de oleada
let shieldT: number; // segundos de escudo activo que quedan (0 = bajado)
let shieldCd: number; // segundos hasta poder levantarlo otra vez
let wantShield: boolean; // ↑ pulsado desde el último update
let reflected: Reflected[]; // balas reflejadas en vuelo
```

`wave` de la SPEC 21 se sustituye por `lv`. `Drone` gana el campo `armor`.

Tabla de niveles (de las fórmulas):

| Nivel | Paso con 32 drones (s) | Paso con 1 dron (s) | Fila 0 al empezar (`y`) | Disparo cada (s) | Disparos a la vez | Blindados |
| ----- | ---------------------- | ------------------- | ----------------------- | ---------------- | ----------------- | --------- |
| 1     | 0,600                  | 0,050               | 100                     | 1,00             | 3                 | 0         |
| 2     | 0,558                  | 0,047               | 110                     | 0,92             | 3                 | 1         |
| 3     | 0,516                  | 0,043               | 120                     | 0,84             | 4                 | 2         |
| 5     | 0,432                  | 0,036               | 140                     | 0,68             | 5                 | 4         |
| 7     | 0,348                  | 0,029               | 150                     | 0,52             | 6                 | 6         |
| 9+    | 0,300                  | 0,025               | 150                     | 0,45             | 6                 | 8         |

Reglas nuevas o modificadas:

- **Escudo:** ↑ (un `keydown` con `repeat: false`) pone `wantShield = true`. En el `update` siguiente, si `shieldCd ≤ 0`, el escudo se levanta: `shieldT = 0,25` y `shieldCd = 0,8`. Si el enfriamiento no ha acabado, la pulsación se pierde. `wantShield` vuelve a `false` en cada `update`. El escudo es el rectángulo `cx ± 30` × `y` de 524 a 534 y sigue al cañón, que se puede mover con normalidad.
- **Sin disparar con el escudo:** mientras `shieldT > 0`, ESPACIO no dispara (la pulsación se pierde, como con una bala ya en pantalla).
- **Reflejo:** con el escudo activo, un disparo enemigo cuyo rectángulo barrido toca el rectángulo del escudo se retira de `shots` y nace una bala reflejada con el mismo centro `x`, borde superior `y = 512` y `chain = 0`. El reflejo se comprueba **antes** que el impacto en el cañón: un disparo reflejado no puede alcanzar al cañón en el mismo fotograma. Un mismo levantamiento del escudo puede reflejar varios disparos.
- **Bala reflejada:** sube `480 × dt` px por fotograma y se retira cuando `y + 12 < 0`. En cada fotograma, todos los drones vivos que toca su rectángulo barrido (`x ± 2`, desde el `y` nuevo hasta el `y` anterior `+ 12`) mueren, procesados de fila mayor a menor; con cada uno `chain` sube 1 y suma `ROW_SCORE[row] × min(chain, 4) × (armor ? 2 : 1)`. La bala no se detiene. Las balas reflejadas no cuentan para el límite de una bala del jugador ni chocan con los disparos enemigos ni con otras balas.
- **Cadena de una columna completa:** una bala reflejada que cruza una columna con sus 4 drones suma `10 × 1 + 10 × 2 + 20 × 3 + 30 × 4 = 210`; si el de la fila 0 está blindado, `10 + 20 + 60 + 30 × 2 × 4 = 330`.
- **Blindados:** al crear una oleada, los drones de la fila 0 en las primeras `armored(lv)` columnas de `ARMOR_ORDER` tienen `armor = true`. No consumen `Math.random`. Una bala normal que toca un dron blindado se retira sin dañarlo ni sumar puntos. Los blindados marchan y disparan como los demás (disparan si son el dron vivo más bajo de su columna).
- **Nivel:** `lv = 1` al empezar y tras `restart()`, con `onLevelChange(1)`. Al empezar la oleada siguiente tras la pausa de 1,0 s, `lv` sube 1 y se notifica con `onLevelChange(lv)` (solo cuando cambia). La oleada nueva usa las funciones del nuevo nivel.
- **Formación por nivel:** el centro de la fila 0 al empezar la oleada es `originY(lv)`, así que el centro de un dron es `(190 + 60 × col + fx, originY(lv) + 44 × row + fy)`. El paso es `stepS(vivos, lv)`. El límite de invasión (`y = 530`) no cambia: con la formación más baja hay menos bajadas antes de la invasión (15 en el nivel 1, 13 en el nivel 5, 12 desde el nivel 6).
- **Disparo por nivel:** al disparar, `fireCd = fireS(lv)`; el primer disparo de cada oleada sigue a los 2,0 s. Si hay `maxShots(lv)` disparos en pantalla, el disparo se pierde.
- **Bonificación de oleada:** al destruir el último dron se suman `50 × lv` puntos del nivel que se acaba de limpiar (50 en el nivel 1, 100 en el 2). Una oleada 1 completa con balas normales suma 560 + 50 = 610.
- **Velocidad máxima:** en el nivel 9 con 1 dron el paso es de 0,025 s, menos que un fotograma de 50 ms: el bucle `while` de la SPEC 21 da dos pasos en ese fotograma, comprobando los bordes en cada uno.
- **Orden de un fotograma (`update(dt)`):** (1) bajar `wavePause` (y empezar la oleada siguiente con su nivel), `fireCd`, `shieldT` y `shieldCd`; (2) mover el cañón; (3) escudo; (4) disparo del jugador; (5) mover la bala, los disparos y las balas reflejadas; (6) impacto de la bala normal (con blindados) y de las balas reflejadas, bonificación y oleada limpia; (7) reflejo en el escudo; (8) disparo enemigo contra el cañón; (9) pasos de la formación; (10) invasión; (11) disparo del enjambre. Todo lo demás de la SPEC 21 se conserva.
- **Entrada:** como en la SPEC 21, con `ArrowUp` añadida a las teclas que se leen. `pause()`, `resume()`, `restart()` y `blur` ponen también `wantShield = false`. `restart()` deja `shieldT = shieldCd = 0` y sin balas reflejadas.
- **Fin y notificaciones:** igual que en la SPEC 21, con `onLevelChange` notificado antes de `onGameOver`.

Dibujo: lo de la SPEC 21, salvo `OLEADA n`, que ya no se dibuja (lo muestra el Nivel del HUD). El escudo activo es un arco de 60 px de ancho y 10 px de alto sobre el cañón, `#fff6b0` con opacidad `0,4 + 0,6 × shieldT / 0,25`. La bala reflejada es un rectángulo de 4×12 `#ffd84d` con dos trazos de estela de 2 px por debajo. Un dron blindado se dibuja como los de la fila 0 con un contorno de 2 px `#ffe9a0` y una placa horizontal de 16×3 px `#ffe9a0` sobre el ojo.

Convenciones: las de la SPEC 21.

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas") y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components, según exige `AGENTS.md`.

1. **Nivel y dificultad.** Sustituir `wave` por `lv`, añadir `onLevelChange`, las funciones `speedMul`, `originY`, `fireS` y `maxShots`, la bonificación de oleada, quitar `OLEADA n` del dibujo y pasar `catalog.ts` a `hud.nivel: true`. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, el smoke del motor, que las tres pruebas de comportamiento de la SPEC 21 siguen dando lo mismo (ocurren en el nivel 1 y ninguna limpia una oleada, así que la bonificación no les afecta) y una prueba escrita fuera del repo (sección 8 de `pattern.md`) que compruebe la tabla de niveles para los niveles 1, 2, 3, 5, 7 y 9.
2. **Escudo y reflejo.** Añadir `ArrowUp`, `shieldT`, `shieldCd`, `wantShield`, el bloqueo del disparo con el escudo, el reflejo y las balas reflejadas con su cadena; añadir el botón `◆ ESCUDO` a `controles` en `catalog.ts`. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y la prueba de comportamiento con `Math.random` fijo en 0: con el cañón en `x = 220` (0,5625 s a la izquierda) y ↑ a los 3,0 s, el primer disparo del enjambre se refleja entre 3,117 s y 3,208 s, la bala reflejada sube en `x = 220` a 480 px/s y la partida sigue; con ↑ a los 2,5 s y otra vez a los 3,0 s, el segundo ↑ se ignora por el enfriamiento y la partida termina a los 3,19 s ±1 fotograma.
3. **Blindados.** Añadir `armor`, `ARMOR_ORDER`, `armored(lv)`, la absorción de la bala normal y el ×2 de la bala reflejada. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y la prueba de comportamiento: en el nivel 2 el único blindado es el dron de la columna 0, fila 0; en el nivel 5 lo son los de las columnas 0, 7, 1 y 6; una bala normal contra un blindado desaparece sin sumar.
4. **Cierre.** `npm run lint`, `npm run build` sin trazas de error y, en el navegador, una partida que llegue al nivel 2 comprobando el HUD, el escudo (teclado y mando táctil con `(pointer: coarse)`), el guardado y que el resto de juegos no cambian. Borrar las filas de prueba de `scores`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] El HUD de `/jugar/enjambre` muestra Puntuación y Nivel y sigue sin mostrar Vidas; el canvas ya no dibuja `OLEADA n`.
- [ ] El nivel es el número de oleada: empieza en 1, sube a 2 al empezar la segunda oleada tras la pausa de 1,0 s; `onLevelChange` se llama solo cuando cambia, y `onLevelChange(1)` al empezar y tras JUGAR DE NUEVO.
- [ ] ↑ levanta el escudo 0,25 s (±1 fotograma); otro ↑ antes de 0,8 s desde el anterior no hace nada; mantener ↑ (`repeat: true`) no lo vuelve a levantar.
- [ ] Con el escudo levantado, ESPACIO no dispara.
- [ ] Un disparo enemigo que toca el escudo levantado no termina la partida y vuelve hacia arriba como bala reflejada a 480 px/s en la misma `x`.
- [ ] Con `Math.random` fijo en 0, el cañón en `x = 220` y ↑ a los 3,0 s, el primer disparo del enjambre se refleja y la partida no termina; con ↑ a los 2,5 s y a los 3,0 s, el segundo se ignora y la partida termina a los 3,19 s ±1 fotograma.
- [ ] Una bala reflejada no se detiene al destruir un dron: el k-ésimo dron que destruye suma sus puntos × `min(k, 4)`; una columna completa del nivel 1 suma 210.
- [ ] Una bala reflejada no cuenta como la bala del jugador: con una reflejada en vuelo y el escudo bajado, ESPACIO dispara una bala normal.
- [ ] Desde el nivel 2 hay `min(nivel − 1, 8)` drones blindados en la fila 0, en las columnas 0, 7, 1, 6, 2, 5, 3 y 4 por ese orden; en el nivel 1 no hay ninguno.
- [ ] Una bala normal que toca un dron blindado desaparece sin destruirlo ni sumar puntos; una bala reflejada lo destruye y suma 60 × el multiplicador de la cadena.
- [ ] Limpiar una oleada suma `50 × nivel`: una oleada 1 completa con balas normales suma 610.
- [ ] La fila 0 empieza en `y = 100 + 10 × min(nivel − 1, 5)`: 100 en el nivel 1, 140 en el 5 y 150 desde el 6.
- [ ] El paso de la formación dura `(0,05 + 0,55 × (vivos − 1) / 31) × max(0,5, 1 − 0,07 × (nivel − 1))` s: 0,600 s con 32 drones en el nivel 1 y 0,300 s en el nivel 9.
- [ ] El enjambre dispara cada `max(0,45, 1,0 − 0,08 × (nivel − 1))` s y tiene como máximo `min(3 + floor((nivel − 1) / 2), 6)` disparos en pantalla: 1,00 s y 3 en el nivel 1, 0,68 s y 5 en el 5, 0,45 s y 6 desde el 9.
- [ ] Con un paso más corto que el fotograma (nivel 9, 1 dron) la formación da varios pasos en un fotograma sin salirse de `[10, 790]`.
- [ ] Con `(pointer: coarse)` el mando muestra la cruceta ◀ ▶ y dos botones redondos, DISPARO y ◆ ESCUDO; ◆ ESCUDO levanta el escudo una vez por toque.
- [ ] `onScoreChange`, `onLevelChange` y `onGameOver` respetan las trampas del patrón: solo se llaman al cambiar el valor, y `onGameOver` una sola vez y después de la última notificación.
- [ ] PAUSA congela también el escudo, su enfriamiento y las balas reflejadas; REANUDAR continúa sin saltos; una pulsación de ↑ hecha antes de pausar no levanta el escudo al reanudar.
- [ ] Con el modal abierto, ↑ no levanta el escudo y teclear el nombre no mueve el cañón.
- [ ] JUGAR DE NUEVO deja nivel 1, puntuación 0, el escudo bajado y sin enfriamiento, sin balas reflejadas y la formación del nivel 1 sin blindados.
- [ ] Las flechas y ESPACIO no hacen scroll; salir y volver tres veces no duplica el bucle.
- [ ] `app/games/enjambre/engine.ts` no contiene `document.`.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

- **Sí:** decidido por game-jam a partir del tema "Invasores"; el usuario no fue consultado. Todas las decisiones de esta spec son propuestas para revisar.
- **Sí:** la variante «Reflejo» es el giro del juego: el fuego del invasor se convierte en tu munición. Cambia la decisión central de la variante «Clásica» (apartarse) por otra (ponerse debajo del disparo en el momento justo), y es lo que separa a ENJAMBRE de un shooter de formación cualquiera.
- **Sí:** escudo de 0,25 s con 0,8 s de enfriamiento y sin disparar mientras está activo. Es un parry: hay que acertar el momento, no se puede mantener levantado y tiene un coste (no disparar).
- **No:** un escudo que se mantiene pulsado o que dura hasta absorber un disparo. Sería una defensa gratis y quitaría el riesgo del tema.
- **Sí:** ↑ para el escudo, que libera ESPACIO para el disparo y es un gesto natural («arriba» devuelve hacia arriba). En el mando táctil va como botón redondo `◆ ESCUDO` en `pulso`.
- **Sí:** la bala reflejada perfora y multiplica por la cadena hasta ×4. Premia reflejar bajo una columna llena: el mismo disparo vale 210 en lugar de 10.
- **Sí:** blindados solo en la fila 0, colocados de fuera hacia dentro y sin `Math.random`. Obligan a usar el reflejo para limpiar la oleada y no alteran la prueba con aleatorio fijo de la SPEC 21.
- **Sí:** un blindado que no se destruye deja la oleada sin terminar y la formación sigue bajando hasta la invasión. Es la presión del tema: no se puede ignorar al blindado.
- **No:** blindados que aguantan varios golpes de bala normal. Haría el reflejo opcional.
- **Sí:** nivel = oleada, con la dificultad en cuatro fórmulas con tope (velocidad ×0,5, fila inicial en 150, disparo cada 0,45 s, 6 disparos). Los topes, alcanzados en el nivel 9, evitan oleadas imposibles; el resto de la dificultad la ponen los blindados.
- **Sí:** bonificación de 50 × nivel al limpiar una oleada. Premia avanzar frente a farmear puntos en una oleada vieja.
- **Sí:** el reflejo se comprueba antes que el impacto en el cañón. Así un reflejo justo a tiempo nunca mata, y la regla es verificable.
- **No:** que la bala normal choque con los disparos enemigos. El escudo ya da una respuesta activa al fuego.
- **Sí:** las funciones del nivel valen en el nivel 1 lo mismo que las constantes de la SPEC 21, así que sus pruebas siguen siendo válidas.
- **Sí:** se añade un botón a `controles` en la misma línea de `catalog.ts` que cambia el HUD; no se toca `components.tsx`.

## Riesgos

| Riesgo                                                                          | Mitigación                                                                                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| El escudo hace el juego trivial                                                 | 0,25 s activo y 0,8 s de enfriamiento, sin disparar; con 6 disparos a la vez (nivel 7+) no se pueden reflejar todos |
| La cadena se explota con balas reflejadas en serie bajo la misma columna        | El multiplicador se reinicia en cada bala y tiene tope ×4; la columna se vacía con la primera                       |
| Un disparo atraviesa el escudo en un fotograma largo                            | Rectángulo barrido del disparo (12 px por fotograma a 240 px/s, escudo de 10 px de alto); criterio explícito        |
| La formación se sale del canvas con varios pasos por fotograma en niveles altos | El bucle `while` comprueba los bordes en cada paso; criterio del nivel 9 con 1 dron                                 |
| Los blindados dejan la oleada imposible si el enjambre deja de disparar         | Los blindados disparan cuando son el dron más bajo de su columna; siempre hay al menos un tirador vivo              |
| Un cambio de constantes rompe las pruebas de la SPEC 21                         | El nivel 1 conserva los valores de la SPEC 21; el paso 1 del plan repite sus tres pruebas                           |
| Los listeners se duplican al remontar                                           | Sin cambios en `destroy()`; criterio de bucle tras tres remontajes                                                  |

## Qué **no** está en esta spec

- Vidas, pantalla de espera, la Reina del enjambre, estrellas, partículas, sacudida y avisos visuales (SPEC 23).
- Búnkeres, picados y drones que se separan de la formación.
- Skins y `setSkin`.
- Sonido, assets, teclas WASD y ratón.
- Ranking por tiempo o donde menos puntos es mejor, y validación de puntuaciones en servidor.
- Cambios en Supabase, en la portada, en `components.tsx` y en los otros juegos.

Cada uno, si llega, va en su propia spec.
