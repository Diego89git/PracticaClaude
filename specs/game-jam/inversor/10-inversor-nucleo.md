# SPEC 10 — Game jam «Gravedad invertida»: INVERSOR, núcleo jugable

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-11-17
> **Objetivo:** Añadir INVERSOR, un corredor de gravedad invertida creado desde cero, al catálogo de Arcade Vault, jugable en `/jugar/inversor` y con su leaderboard real en Supabase.

## Por qué existe esta spec

INVERSOR nace del tema de game jam **«Gravedad invertida»** y es la primera de las tres specs del juego (SPEC 10 núcleo, SPEC 11 progresión, SPEC 12 pulido). El tema es la mecánica: un cubo corre solo por un túnel entre un suelo y un techo, no salta, y el jugador solo decide hacia dónde cae. Esta spec entrega lo mínimo para jugar de principio a fin y entrar en el ranking: ficha, portada, motor con la mecánica central, puntuación por distancia y fin al chocar.

No se porta nada: `references/started-games/` no tiene un juego así, como en SERPENTINA (SPEC 09) las reglas se definen aquí, con números. A diferencia de las SPEC 07 a 09, no reemplaza a ningún placeholder: es un juego nuevo con id propio, portada propia y su ficha **solo en Supabase**, como ASTEROIDES, así que el Home no cambia. Sigue la receta de `.claude/skills/add-game/references/pattern.md` y usa el registro de juegos que creó la SPEC 07.

## Alcance

**Dentro:**

- Fila `inversor` en la tabla `games` de Supabase, con su migración en `supabase/migrations/`.
- Portada `.cover-inversor` en `app/globals.css`, dibujada con el propio juego (cubo, suelo, techo y pinchos).
- Motor en `app/games/inversor/engine.ts`: lógica nueva descrita en el modelo de datos, con el contrato de `pattern.md` (canvas por parámetro, listeners con limpieza, callbacks hacia el HUD).
- Componente cliente `app/components/inversor-game.tsx` que monta el motor en un `<canvas>` de 800×600 dentro del marco CRT.
- Entrada de `inversor` en el registro de juegos (`app/games/catalog.ts` y `app/games/components.tsx`): HUD solo con Puntuación, sin Vidas ni Nivel.
- PAUSA, FIN, JUGAR DE NUEVO y GUARDAR PUNTUACIÓN con el juego real; puntuación guardada en `scores`.
- Mecánica: cubo de 32×32 con gravedad hacia el suelo o el techo, inversión de la gravedad por teclado, pinchos de una o dos casillas que avanzan hacia el cubo, puntuación por distancia recorrida y fin de partida al chocar con un pincho.
- Control solo con teclado: ↑ gravedad hacia el techo, ↓ gravedad hacia el suelo, ESPACIO alterna. Las flechas y ESPACIO no hacen scroll de la página.

**Fuera de alcance (specs futuras):**

- Niveles, aumento de velocidad, cristales y obstáculos nuevos: SPEC 11.
- Vidas, pantalla de espera, estela, partículas y sacudida: SPEC 12.
- Sonido, imágenes y cualquier asset: el juego se dibuja con formas del canvas.
- Controles táctiles, ratón o teclas WASD.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cambios en los otros juegos, reales o placeholder.

## Modelo de datos

Fila de `games` (migración `supabase/migrations/20261117100000_game_inversor.sql`):

```sql
insert into public.games (id, title, short, long, cat, cover, color) values (
  'inversor',
  'INVERSOR',
  'Cambia de techo a suelo antes de que un pincho te alcance.',
  'Un cubo de neón corre sin freno por un túnel sin salida. No salta: invierte la gravedad y cae hacia el techo o hacia el suelo para esquivar pinchos que llegan de frente. Cada metro recorrido suma puntos. ¿Cuánto aguantas?',
  'ARCADE',
  'cover-inversor',
  'yellow'
);
```

Entrada del registro (`app/games/catalog.ts`):

```ts
inversor: { hud: { vidas: false, nivel: false } },
```

Motor: `createInversor(canvas: HTMLCanvasElement, events: GameEvents): GameEngine`, con el contrato de `.claude/skills/add-game/references/pattern.md` sección 2. Constantes del juego:

```ts
const W = 800;
const H = 600;
const SURFACE_TOP = 40; // el techo ocupa y = 0..40
const SURFACE_BOTTOM = 560; // el suelo ocupa y = 560..600
const PLAYER_X = 160; // x fijo del cubo
const PLAYER_SIZE = 32;
const GRAVITY = 4000; // px/s², hacia el suelo (+) o el techo (−)
const MAX_VY = 1400; // px/s
const SPEED = 320; // px/s, velocidad del mundo, constante en esta spec
const CELL = 40; // casilla de un pincho
const SPIKE_HIT = 32; // lado de la hitbox de un pincho
const FIRST_SPAWN_PX = 600; // distancia recorrida hasta el primer obstáculo
const GAP_MIN_PX = 350;
const GAP_MAX_PX = 600;
const PX_PER_POINT = 10; // puntuación = floor(distancia / 10)
```

Estado del motor (variables de cierre dentro de `createInversor`):

```ts
interface Spike {
  x: number; // borde izquierdo de la casilla
  top: boolean; // true = colgado del techo, false = en el suelo
}
let y: number; // borde superior del cubo
let vy: number;
let g: 1 | -1; // 1 = cae hacia el suelo, -1 = hacia el techo
let spikes: Spike[];
let distance: number; // px recorridos desde el inicio
let nextSpawn: number; // distancia a la que aparece el siguiente grupo
let over: boolean;
```

Reglas:

- **Inicio:** el cubo está posado en el suelo: `y = SURFACE_BOTTOM − PLAYER_SIZE = 528`, `vy = 0`, `g = 1`. No hay pantalla de espera: el mundo avanza desde el primer fotograma.
- **Mundo:** avanza a `SPEED`. En cada fotograma `distance += SPEED × dt` y cada pincho se mueve `SPEED × dt` hacia la izquierda; se elimina cuando `x + CELL < 0`.
- **Física:** en cada fotograma `vy += g × GRAVITY × dt`, `vy` se limita a ±`MAX_VY` y `y += vy × dt`. Si `y + PLAYER_SIZE ≥ SURFACE_BOTTOM` y `vy ≥ 0`, el cubo se posa: `y = SURFACE_BOTTOM − PLAYER_SIZE`, `vy = 0`. Si `y ≤ SURFACE_TOP` y `vy ≤ 0`, se posa en el techo: `y = SURFACE_TOP`, `vy = 0`.
- **Entrada:** ↑ fija `g = −1`, ↓ fija `g = 1`, ESPACIO cambia el signo de `g`. Se permite en el aire, sin enfriamiento. Un `keydown` con `repeat: true` se ignora: mantener la tecla no invierte la gravedad una y otra vez. La velocidad `vy` se conserva al invertir.
- **Obstáculos:** cuando `distance ≥ nextSpawn` aparece un grupo con su borde izquierdo en `x = W + 20 = 820`, y `nextSpawn += GAP_MIN_PX + r × (GAP_MAX_PX − GAP_MIN_PX)`. Al empezar, `nextSpawn = FIRST_SPAWN_PX`. Cada aparición consume tres llamadas a `Math.random`, **en este orden**: `r` del hueco, la superficie (`< 0,5` suelo, si no techo) y el tamaño (`< 0,5` un pincho, si no dos pinchos en casillas contiguas, en `x` y `x + 40`).
- **Hitbox:** el cubo es un cuadrado de 32×32 en `(PLAYER_X, y)`. Un pincho dibuja un triángulo de 40×40 con la base en la superficie y su hitbox es un cuadrado de 32×32 centrado en la casilla (`x + 4 … x + 36`) y pegado a la superficie (`y = 528…560` en el suelo, `40…72` en el techo). Hay choque si los rectángulos se solapan con área positiva.
- **Puntuación:** `floor(distance / PX_PER_POINT)`: 32 puntos por segundo a 320 px/s.
- **Fin:** el choque con un pincho termina la partida. Se notifica la puntuación, `onGameOver(score)` se llama una sola vez y la lógica no avanza más; sigue dibujando.
- **Callbacks:** `onScoreChange` solo cuando el valor cambia, `onLivesChange(0)` y `onLevelChange(1)` una vez al inicio y tras cada `restart()`.

Dibujo (valores iniciales, se ajustan viendo la captura sin cambiar el comportamiento): fondo `#0a0a18`; suelo y techo `#1a1a35` con un filo de 2 px `#ffe14d`; líneas verticales de referencia `#12122a` cada 80 px, desplazadas con `distance` para dar sensación de movimiento; cubo `#ffe14d` con un borde interior `#0a0a18` de 4 px; pinchos `#ff4fd8`. Sin HUD ni «GAME OVER»: los pone la plataforma.

Convenciones: canvas de 800×600 px (4:3, llena el marco CRT); tiempos en segundos; `dt` limitado a 50 ms; coordenadas con origen arriba a la izquierda.

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas") y la sección 6 de `.claude/skills/add-game/references/porting.md` (modo «desde cero»), y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components y Cache Components, según exige `AGENTS.md`. Usar `/frontend-design` para la portada.

1. **Ficha.** Crear la migración con la fila `inversor` y aplicarla con `apply_migration` **tras pedir confirmación al usuario**. No se añade a `app/data.ts`. Verificar: `list_tables` y una consulta muestran la fila; `/biblioteca` muestra 10 tarjetas y la de INVERSOR muestra `best` 0; `/juegos/inversor` carga con el estado vacío del ranking; `/jugar/inversor` muestra el placeholder.
2. **Portada.** Añadir `.cover-inversor` a `app/globals.css` junto a las otras `.cover-*`, con un SVG en `::after` (viewBox 400×300) que dibuje el cubo, el suelo, el techo y un pincho, siguiendo la idea de la portada de ASTEROIDES. Verificar: captura de la tarjeta en `/biblioteca` y en `/juegos/inversor`, distinta de las demás portadas.
3. **Motor.** Crear `app/games/inversor/engine.ts` desde `.claude/skills/add-game/assets/engine.ts.tpl` con las reglas del modelo de datos: estado de cierre, `keydown` en `window` que ejecuta la acción de cada evento (sin `keyup`), bucle con `dt` limitado, física, aparición de pinchos, colisión, puntuación y `onGameOver(score)` una sola vez. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, `node .claude/skills/add-game/scripts/engine-smoke.mjs app/games/inversor/engine.ts createInversor` y una prueba de comportamiento escrita fuera del repo con `Math.random` fijo (sección 8 de `pattern.md`).
4. **Componente.** Crear `app/components/inversor-game.tsx` desde `.claude/skills/add-game/assets/game-component.tsx.tpl` con el canvas de 800×600.
5. **Registro.** Añadir `inversor` a `catalog.ts` y `components.tsx`. Verificar en el navegador: `/jugar/inversor` muestra el canvas con el cubo, el suelo y el techo, el HUD muestra solo Puntuación, PAUSA congela y FIN abre el modal.
6. **Cierre.** `npm run lint`, `npm run build` sin trazas de error, `get_advisors` de seguridad sin avisos, `node .claude/skills/add-game/scripts/rls-check.mjs inversor` y una partida completa hasta verla en `/juegos/inversor` y en la pestaña de INVERSOR de `/salon`. Borrar todas las filas de prueba de `scores`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] La tabla `games` contiene la fila `inversor` con `cover-inversor` y color `yellow`; `supabase/migrations/` contiene su migración.
- [ ] `/biblioteca` muestra 10 tarjetas y la de INVERSOR muestra `best` 0 y una portada distinta de las demás.
- [ ] El Home (`/`) sigue mostrando exactamente las mismas 6 mini tarjetas.
- [ ] `/juegos/inversor` muestra título, descripción larga y, sin puntuaciones, "Sé el primero en entrar al salón de la fama".
- [ ] `/jugar/inversor` muestra el juego real en un canvas de 800×600 dentro del marco CRT, sin el placeholder; los demás juegos siguen como antes.
- [ ] El canvas no dibuja puntuación, nivel ni "GAME OVER"; el HUD de la plataforma muestra Puntuación y no muestra Vidas ni Nivel.
- [ ] Al empezar, el cubo de 32×32 está posado en el suelo en `(160, 528)` y no hay ningún pincho en pantalla.
- [ ] Con `dt = 1/60` y sin pulsar nada, tras 60 fotogramas la puntuación es 32 (±1).
- [ ] ↑ hace caer el cubo hacia el techo y se posa en `y = 40`; ↓ lo hace caer hacia el suelo y se posa en `y = 528`; ESPACIO alterna entre ambos.
- [ ] La inversión funciona también con el cubo en el aire y conserva `vy`.
- [ ] Un `keydown` con `repeat: true` no invierte la gravedad.
- [ ] El cubo nunca sale de `y = 40…560` y `vy` nunca supera 1400 px/s en valor absoluto.
- [ ] Con `Math.random` fijo en 0, el primer pincho aparece cuando la distancia llega a 600 px, es un pincho simple en el suelo con `x = 820`, y el siguiente aparece 350 px de distancia después.
- [ ] Con `Math.random` fijo en 0,9, el primer grupo son dos pinchos contiguos (`x` y `x + 40`) colgados del techo y el hueco hasta el siguiente es de 575 px.
- [ ] Un pincho que sale por la izquierda (`x + 40 < 0`) se elimina de la lista.
- [ ] Chocar con un pincho (solape con área positiva entre el cubo y su hitbox de 32×32) abre el modal "FIN DEL JUEGO" con la puntuación final, una sola vez.
- [ ] Rozar un pincho sin solapar (cubo en el techo con un pincho del suelo, o al revés) no termina la partida.
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras se juega.
- [ ] PAUSA congela el juego y muestra "EN PAUSA"; REANUDAR continúa donde estaba, sin salto de distancia ni de física.
- [ ] FIN abre el mismo modal con la puntuación actual.
- [ ] Con el modal abierto, ESPACIO no cambia la puntuación y teclear el nombre no mueve el cubo.
- [ ] El nombre se pre-rellena desde `localStorage["av_player_name"]`; GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "inversor"` y `user_id: null`.
- [ ] El botón se deshabilita durante el envío: tres clics seguidos insertan una sola fila.
- [ ] Si el insert falla, el modal muestra un error, no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] La puntuación guardada aparece en `/juegos/inversor` y en la pestaña de INVERSOR de `/salon` al recargar.
- [ ] JUGAR DE NUEVO deja puntuación 0, el cubo posado en el suelo, ningún pincho en pantalla y `distance` en 0.
- [ ] Salir de `/jugar/inversor` y volver no duplica el bucle: los frames por segundo no aumentan tras tres remontajes.
- [ ] El canvas se ve completo sin scroll horizontal a 1440 px y a 768 px de ancho.
- [ ] `app/games/inversor/engine.ts` no contiene `document.` y solo usa `window.` para registrar y quitar `keydown`.
- [ ] Con la clave publishable, el `INSERT` válido en `scores` pasa, los inválidos se rechazan y `UPDATE`/`DELETE` no modifican filas.
- [ ] `/juegos/no-existe` y `/jugar/no-existe` muestran la pantalla 404.
- [ ] Con una clave de Supabase inválida, `/biblioteca` sigue respondiendo 200 y `/jugar/inversor` carga.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

- **Sí:** decidido por game-jam a partir del tema «Gravedad invertida»; el usuario no fue consultado. Todas las decisiones de esta spec son propuestas para revisar.
- **Sí:** el tema es la mecánica: el cubo no salta, solo invierte hacia dónde cae. Un juego donde la gravedad solo decorase no cumpliría el tema.
- **No:** un salto convencional además de la inversión. Son dos acciones y diluye el tema.
- **Sí:** id `inversor`, ARCADE y color `yellow`. Ningún juego real usa `yellow` (ASTEROIDES y BLOQUE BUSTER son cyan, CAÍDA magenta, SERPENTINA green), así que reparte los colores.
- **Sí:** la ficha vive solo en Supabase y no se añade a `app/data.ts`, como ASTEROIDES: el Home lee `GAMES.slice(0, 6)` y no cambia.
- **Sí:** ↑ fija la gravedad hacia el techo, ↓ hacia el suelo y ESPACIO alterna. Dos formas de jugar (dirigida o alterna) con las mismas teclas de la plataforma.
- **Sí:** se ignoran los `keydown` repetidos. Mantener una tecla no debe parpadear la gravedad.
- **Sí:** la inversión se permite en el aire. Reaccionar tarde a un pincho sigue siendo posible y el juego premia el ritmo, no la espera.
- **Sí:** puntuación = distancia ÷ 10, sin multiplicadores. Mayor es mejor, ilimitada y verificable con una multiplicación; los bonus llegan en la SPEC 11.
- **Sí:** el mundo avanza desde el primer fotograma, con el primer pincho a 600 px (unos 3,8 s antes de poder chocar). La pantalla de espera es de la SPEC 12.
- **Sí:** hitbox rectangular de 32×32 por pincho y de 32×32 para el cubo. Colisión triangular exacta sería más fiel al dibujo y más difícil de verificar.
- **Sí:** el orden de las tres llamadas a `Math.random` por aparición queda fijado en la spec. Permite probar el motor con aleatorio fijo, como en las SPEC 07 y 09.
- **Sí:** velocidad constante de 320 px/s en esta spec. La progresión es de la SPEC 11.
- **Sí:** sin assets ni sonido. Es una game jam: alcance pequeño y terminable.
- **Sí:** `dt` limitado a 50 ms, como en el patrón. A 320 px/s un fotograma mueve como máximo 16 px, menos que la hitbox de 32 px, así que no hay túnel entre fotogramas.

## Riesgos

| Riesgo                                                                                   | Mitigación                                                                                                      |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Strict Mode monta el efecto dos veces y duplica el bucle                                 | `destroy()` cancela el frame y quita el listener; criterio de frames por segundo tras tres remontajes           |
| Envíos repetidos al guardar                                                              | `ref` que bloquea al instante; criterio de tres clics seguidos                                                  |
| Un grupo de pinchos imposible de esquivar por la secuencia aleatoria                     | Hueco mínimo de 350 px (1,09 s a 320 px/s) frente a unos 0,5 s de cruce entre superficies; se mide en la prueba |
| Mantener ESPACIO inclina la gravedad cada fotograma                                      | Se ignora `repeat: true`; criterio explícito                                                                    |
| El cubo se queda pegado a una superficie tras invertir porque `vy` aún apunta hacia ella | La posada exige `vy ≥ 0` en el suelo y `vy ≤ 0` en el techo; criterio de posada tras invertir                   |
| La inversión en el aire cambia `vy` de golpe y el cubo atraviesa la superficie opuesta   | La física limita `y` a `40…560` en cada fotograma, con `MAX_VY` de 1400 px/s y `dt` ≤ 50 ms (70 px como máximo) |
| El texto de la portada se confunde con la de otro juego en la tarjeta                    | Se comprueba la captura de la tarjeta y se ajusta el SVG sin tocar el resto                                     |
| Si Supabase falla, `inversor` no aparece en la Biblioteca porque no tiene ficha local    | Es el comportamiento de ASTEROIDES; criterio de degradación con clave inválida para el resto del catálogo       |

## Qué **no** está en esta spec

- Niveles, aumento de velocidad, cristales y obstáculos nuevos (SPEC 11).
- Vidas, pantalla de espera, estela, partículas y sacudida (SPEC 12).
- Sonido, assets, controles táctiles, ratón y teclas WASD.
- Ranking por tiempo o donde menos puntos es mejor, y validación de puntuaciones en servidor.
- Cambios en los otros juegos, reales o placeholder.

Cada uno, si llega, va en su propia spec.
