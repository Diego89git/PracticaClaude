# SPEC 09 — Cuarto juego real: SERPENTINA (Snake)

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06, SPEC 07, SPEC 08
> **Fecha:** 2026-11-05
> **Objetivo:** Convertir el placeholder SERPENTINA en un juego real de Snake creado desde cero con las frutas de `references/source-assets/snake-assets/`, jugable en `/jugar/serpentina` y con su leaderboard real en Supabase.

## Por qué existe esta spec

ASTEROIDES (SPEC 05 y 06), CAÍDA (SPEC 07) y BLOQUE BUSTER (SPEC 08) fijaron el patrón: motor sin React, componente de canvas, reproductor de la plataforma, registro de juegos y leaderboard en Supabase. SERPENTINA es el cuarto y el primero que **no se porta**: `references/source-assets/snake-assets/` solo trae un _spritesheet_ de frutas (`fruits.png`) y su mapa de recortes (`sprites.js`), sin código de juego. Las reglas se definen aquí, con números.

El catálogo ya tiene un placeholder `serpentina` (ARCADE, portada `cover-snake`, color green) cuyo texto describe un Snake. Igual que hicieron las SPEC 07 y 08, el juego real **toma ese id**: la fila de Supabase sustituye al placeholder en la Biblioteca, el detalle y el reproductor, y el Home no cambia. Sigue la receta de `.claude/skills/add-game/references/pattern.md`.

## Alcance

**Dentro:**

- Fila `serpentina` en la tabla `games` de Supabase, con su migración en `supabase/migrations/`. Reutiliza la portada `cover-snake` y el texto actuales del placeholder.
- Motor en `app/games/serpentina/engine.ts`: lógica nueva descrita en el modelo de datos, con el contrato de `pattern.md` (canvas por parámetro, listeners con limpieza, callbacks hacia el HUD).
- Recortes de las frutas en `app/games/serpentina/sprites.ts`, tomados de `sprites.js` sin su `window.SPRITE_ATLAS`.
- Asset copiado a `public/games/serpentina/fruits.png`, referenciado con ruta absoluta.
- Componente cliente `app/components/serpentina-game.tsx` que monta el motor en un `<canvas>` de 800×600 dentro del marco CRT.
- Entrada de `serpentina` en el registro de juegos (`app/games/catalog.ts` y `app/games/components.tsx`): HUD con Puntuación y Nivel, sin Vidas.
- PAUSA, FIN, JUGAR DE NUEVO y GUARDAR PUNTUACIÓN con el juego real; puntuación guardada en `scores`.
- Mecánicas: tablero de 20×15 casillas de 40 px, serpiente que crece al comer, paredes que se atraviesan, fin al chocar con el propio cuerpo, un nivel cada 5 frutas con velocidad creciente.
- Fruta dibujada con un sprite al azar de las 22 del _spritesheet_, y serpiente dibujada con formas en el canvas.
- Inicio con la serpiente quieta y el texto «PULSA UNA FLECHA» dibujado en el canvas hasta la primera flecha.
- Control solo con teclado: ← ↑ → ↓. Las flechas y ESPACIO no hacen scroll de la página.

**Fuera de alcance (specs futuras):**

- Teclas WASD, controles táctiles o para móvil.
- Sonido.
- Obstáculos, frutas especiales, puntos por tipo de fruta o varios tipos de partida.
- Las otras dos filas de `fruits.png` (la plana y la realista): solo se usa la fila pixel-art que recorta `sprites.js`.
- Reducir el peso de `fruits.png` (585 KB) o regenerarlo.
- Distinguir la victoria de la derrota en el reproductor.
- Vidas: Snake no las tiene y el HUD no las muestra.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cambios en los otros juegos, reales o placeholder.

## Modelo de datos

Fila de `games` (migración `supabase/migrations/20261105190000_game_serpentina.sql`), con el texto que ya tiene el placeholder en `app/data.ts`:

```sql
insert into public.games (id, title, short, long, cat, cover, color) values (
  'serpentina',
  'SERPENTINA',
  'Crece sin morder tu propia cola.',
  'Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.',
  'ARCADE',
  'cover-snake',
  'green'
);
```

Entrada del registro (`app/games/catalog.ts`):

```ts
serpentina: { hud: { vidas: false, nivel: true } },
```

Motor: `createSerpentina(canvas: HTMLCanvasElement, events: GameEvents): GameEngine`, con el contrato de `.claude/skills/add-game/references/pattern.md` sección 2. Constantes del juego:

```ts
const W = 800;
const H = 600;
const CELL = 40; // casilla de 40×40 px
const COLS = 20; // W / CELL
const ROWS = 15; // H / CELL
const START_LENGTH = 3;
const FRUIT_SCORE = 10;
const FRUITS_PER_LEVEL = 5;
const BASE_STEP_MS = 150; // tiempo por casilla en el nivel 1
const STEP_MS_PER_LEVEL = 10; // cada nivel resta 10 ms
const MIN_STEP_MS = 60;
// stepMs = max(60, 150 − (nivel − 1) × 10); nivel = floor(frutas / 5) + 1
```

Estado del motor (variables de cierre dentro de `createSerpentina`):

```ts
interface Cell {
  x: number; // 0..19
  y: number; // 0..14
}
type Dir = "up" | "down" | "left" | "right";
let snake: Cell[]; // snake[0] es la cabeza
let dir: Dir; // dirección aplicada en el último paso
let queue: Dir[]; // flechas pendientes, como máximo 2
let waiting: boolean; // true hasta la primera flecha válida
let fruit: { cell: Cell; sprite: number }; // sprite: índice en FRUIT_FRAMES
let eaten: number; // frutas comidas en la partida
```

Reglas:

- **Inicio:** la serpiente mide 3 casillas, con la cabeza en `(10, 7)` y el cuerpo hacia la izquierda, mirando a la derecha. `waiting = true`: no avanza ni acumula tiempo hasta la primera flecha. En espera, ← se ignora (la serpiente se mordería al instante); ↑, ↓ y → arrancan y fijan la dirección.
- **Paso:** el tiempo acumulado (`dt`) llega a `stepMs` y la serpiente avanza una casilla. Si hay flechas en la cola, se toma la primera como nueva dirección.
- **Giros:** cada `keydown` de flecha se añade a la cola si no es igual ni opuesta a la última dirección encolada (o a `dir` si la cola está vacía) y la cola tiene menos de 2 elementos. Evita el giro de 180° y que dos pulsaciones rápidas dentro de un mismo paso se pierdan.
- **Paredes:** se atraviesan. La cabeza sale por un borde y entra por el opuesto: `x = (x + dx + COLS) % COLS`, `y = (y + dy + ROWS) % ROWS`.
- **Comer:** si la cabeza llega a la casilla de la fruta, la serpiente crece una casilla (no se quita la cola), suma 10 puntos, `eaten` sube en 1 y aparece otra fruta.
- **Fruta nueva:** en una casilla libre elegida al azar (nunca sobre la serpiente) y con un sprite elegido al azar entre los 22 de `FRUIT_FRAMES`.
- **Fin:** la cabeza entra en una casilla ocupada por el cuerpo. La casilla que deja la cola en ese mismo paso cuenta como libre salvo que la serpiente esté comiendo. También termina la partida si no queda ninguna casilla libre para la fruta (la serpiente ocupa las 300 casillas); es la victoria y se trata como fin de partida.
- **Nivel:** `floor(eaten / 5) + 1`. El paso mínimo de 60 ms se alcanza en el nivel 10.

Sprites (`app/games/serpentina/sprites.ts`): `FRUIT_FRAMES` es un array de 22 recortes `{ x, y, w, h }` con las coordenadas de `sprites.js` (todos con `y: 136` y `h: 160`, `x` desde 34 hasta 3637). **Los nombres de `sprites.js` no se usan**: no coinciden con la imagen (el recorte `banana` en `x: 34` es una fruta roja y el plátano está en `x: 186`). Cada fruta se dibuja ajustada dentro de una casilla de 40×40 con margen de 2 px, conservando su proporción y centrada.

Dibujo (valores iniciales, se ajustan viendo la captura sin cambiar el comportamiento): fondo `#0a0a18`, rejilla `#12122a`, cuerpo de la serpiente `#2ecc71`, cabeza `#7dffb0` con dos ojos negros mirando en la dirección de avance, texto de espera `#e0e0e0` en monoespaciada. Sin HUD ni «GAME OVER»: los pone la plataforma.

Asset en `public/games/serpentina/` y ruta absoluta `/games/serpentina/fruits.png`. La imagen se carga con `new Image()` en el motor; el motor ignora la entrada y no avanza hasta que `onload` dispara. Si falla, se registra con `console.error`.

Convenciones: canvas de 800×600 px (4:3, llena el marco CRT); tiempos en segundos salvo `stepMs` en ms; `dt` limitado a 50 ms; coordenadas de casilla con origen arriba a la izquierda.

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas") y la sección 6 de `.claude/skills/add-game/references/porting.md` (modo «desde cero»), y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components y Cache Components, según exige `AGENTS.md`. No se crea portada, así que no hace falta `/frontend-design`.

1. **Ficha.** Crear la migración con la fila `serpentina` y aplicarla con `apply_migration` **tras pedir confirmación al usuario**. Se conserva la entrada local en `app/data.ts`. Verificar: `list_tables` y una consulta muestran la fila; `/biblioteca` sigue con 9 tarjetas y la de SERPENTINA muestra `best` 0; `/juegos/serpentina` carga; `/jugar/serpentina` aún muestra el placeholder.
2. **Asset y sprites.** Copiar `references/source-assets/snake-assets/fruits.png` a `public/games/serpentina/fruits.png` y crear `app/games/serpentina/sprites.ts` con `FRUITS_URL`, `FRUIT_FRAMES` (22 recortes) y `drawFruit`, que recibe el contexto, la imagen, el índice y la casilla. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y que `FRUIT_FRAMES` tiene 22 elementos con `x + w ≤ 3790` y `y + h ≤ 442`.
3. **Motor.** Crear `app/games/serpentina/engine.ts` desde `.claude/skills/add-game/assets/engine.ts.tpl` con las reglas del modelo de datos: estado de cierre, `keydown` en `window` que encola la dirección (sin `keyup`), espera de la primera flecha, avance por acumulación de `dt`, `onLivesChange(0)` constante, `onLevelChange` al subir de nivel y `onGameOver(score)` una sola vez. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, `node .claude/skills/add-game/scripts/engine-smoke.mjs app/games/serpentina/engine.ts createSerpentina` y una prueba de comportamiento escrita fuera del repo, con `Math.random` fijo y un `Image` simulado que dispara `onload` de forma síncrona (el del smoke lo hace de forma asíncrona y la lógica no llega a ejecutarse).
4. **Componente.** Crear `app/components/serpentina-game.tsx` desde `.claude/skills/add-game/assets/game-component.tsx.tpl` con el canvas de 800×600.
5. **Registro.** Añadir `serpentina` a `catalog.ts` y `components.tsx`. Verificar en el navegador: `/jugar/serpentina` muestra el canvas con la serpiente, una fruta y el texto de espera, el HUD muestra Puntuación y Nivel sin Vidas, PAUSA congela y FIN abre el modal.
6. **Cierre.** `npm run lint`, `npm run build` sin trazas de error, `get_advisors` de seguridad sin avisos, `node .claude/skills/add-game/scripts/rls-check.mjs serpentina` y una partida completa hasta verla en `/juegos/serpentina` y en la pestaña de SERPENTINA de `/salon`. Borrar todas las filas de prueba de `scores`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] La tabla `games` contiene la fila `serpentina` con `cover-snake` y color `green`; `supabase/migrations/` contiene su migración.
- [ ] `/biblioteca` sigue mostrando 9 tarjetas; la de SERPENTINA muestra `best` 0 y conserva su portada.
- [ ] El Home (`/`) sigue mostrando exactamente las mismas 6 mini tarjetas.
- [ ] `/juegos/serpentina` muestra título, descripción larga y, sin puntuaciones, "Sé el primero en entrar al salón de la fama" en lugar del ranking ficticio.
- [ ] `/jugar/serpentina` muestra el juego real en un canvas de 800×600 dentro del marco CRT, sin el placeholder; los demás juegos siguen como antes.
- [ ] El canvas no dibuja puntuación, nivel ni "GAME OVER"; el HUD de la plataforma muestra Puntuación y Nivel y no muestra Vidas.
- [ ] `public/games/serpentina/fruits.png` existe y el motor lo referencia con la ruta absoluta `/games/serpentina/fruits.png`.
- [ ] `FRUIT_FRAMES` contiene 22 recortes dentro de la imagen (3790×442) y el motor no usa los nombres de `sprites.js`.
- [ ] No se dibuja ningún sprite ni se acepta entrada hasta que la imagen ha cargado, y el bucle no lanza errores si el primer fotograma llega antes.
- [ ] Al empezar hay una serpiente de 3 casillas con la cabeza en `(10, 7)` mirando a la derecha, una fruta en una casilla libre y el texto «PULSA UNA FLECHA»; la serpiente no se mueve mientras no se pulsa una flecha.
- [ ] Con la serpiente en espera, ← no hace nada y ↑, ↓ y → arrancan la partida en esa dirección; el texto desaparece.
- [ ] El tablero es de 20×15 casillas de 40 px y la serpiente avanza exactamente una casilla por paso.
- [ ] En el nivel 1 la serpiente avanza una casilla cada 150 ms; en el nivel `n` cada `max(60, 150 − (n − 1) × 10)` ms.
- [ ] Una flecha opuesta a la dirección actual se ignora; dos flechas pulsadas dentro del mismo paso se aplican en dos pasos consecutivos y una tercera se descarta.
- [ ] Al salir por un borde la serpiente entra por el opuesto y la partida no termina.
- [ ] Comer una fruta suma exactamente 10 puntos, alarga la serpiente una casilla y coloca otra fruta en una casilla libre, nunca sobre el cuerpo.
- [ ] Cada fruta nueva se dibuja con uno de los 22 sprites y se ve completa dentro de su casilla, sin deformarse.
- [ ] El nivel del HUD es `floor(frutas comidas / 5) + 1`: sube a 2 al comer la 5.ª fruta y a 3 al comer la 10.ª.
- [ ] Chocar con el propio cuerpo abre el modal "FIN DEL JUEGO" con la puntuación final, una sola vez.
- [ ] Entrar en la casilla que deja libre la cola en ese mismo paso no termina la partida.
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras se juega.
- [ ] PAUSA congela el juego y muestra "EN PAUSA"; REANUDAR continúa donde estaba, sin avanzar de golpe pasos acumulados.
- [ ] FIN abre el mismo modal con la puntuación actual.
- [ ] Con el modal abierto, ESPACIO no cambia la puntuación y teclear el nombre no mueve la serpiente.
- [ ] El nombre se pre-rellena desde `localStorage["av_player_name"]`; GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "serpentina"` y `user_id: null`.
- [ ] El botón se deshabilita durante el envío: tres clics seguidos insertan una sola fila.
- [ ] Si el insert falla, el modal muestra un error, no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] La puntuación guardada aparece en `/juegos/serpentina` y en la pestaña de SERPENTINA de `/salon` al recargar.
- [ ] JUGAR DE NUEVO deja puntuación 0, nivel 1, una serpiente de 3 casillas en espera de la primera flecha y una fruta nueva.
- [ ] Salir de `/jugar/serpentina` y volver no duplica el bucle: los frames por segundo no aumentan tras tres remontajes.
- [ ] El canvas se ve completo sin scroll horizontal a 1440 px y a 768 px de ancho.
- [ ] `app/games/serpentina/engine.ts` no contiene `document.` y solo usa `window.` para registrar y quitar `keydown`.
- [ ] Con la clave publishable, el `INSERT` válido en `scores` pasa, los inválidos se rechazan y `UPDATE`/`DELETE` no modifican filas.
- [ ] `/juegos/no-existe` y `/jugar/no-existe` muestran la pantalla 404.
- [ ] Con una clave de Supabase inválida, `/biblioteca` sigue respondiendo 200 y `/jugar/serpentina` carga.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

- **Sí:** el Snake real reemplaza al placeholder `serpentina` y conserva su id, título, portada, color y texto. Respuesta del usuario. No hay dos serpientes en la Biblioteca y el Home no cambia.
- **No:** un id nuevo `serpiente`. Habría dos tarjetas de Snake.
- **Sí:** las paredes se atraviesan; solo el propio cuerpo mata. Respuesta del usuario, y la única condición de fin queda en el cuerpo.
- **No:** morir contra las paredes (Snake clásico). El usuario eligió partidas más largas.
- **Sí:** un nivel cada 5 frutas, con el paso en `max(60, 150 − (n − 1) × 10)` ms, y HUD con Nivel. Respuesta del usuario; los números concretos los propone esta spec.
- **No:** velocidad constante sin nivel. El usuario eligió dificultad creciente.
- **Sí:** la partida empieza con la serpiente quieta y el texto «PULSA UNA FLECHA» dibujado en el canvas. Respuesta del usuario. Como el texto es lo único que el motor dibuja fuera del juego, se justifica igual que «SIGUIENTE» en CAÍDA: la plataforma no tiene pantalla de inicio.
- **No:** arrancar sola hacia la derecha. El jugador podría morir antes de reaccionar.
- **Sí:** en espera, ← se ignora. Con la serpiente mirando a la derecha y el cuerpo a la izquierda, ir a la izquierda sería morderse al instante.
- **Sí:** cola de hasta 2 flechas y rechazo del giro de 180° contra la última dirección encolada. Es la forma habitual de que dos pulsaciones rápidas no se pierdan ni den media vuelta.
- **Sí:** 10 puntos fijos por fruta, sin multiplicar por el nivel. Lo propone esta spec: el nivel ya sube la dificultad con la velocidad y el cálculo se verifica con una resta.
- **Sí:** tablero de 20×15 casillas de 40 px. Es 4:3 exacto y llena el marco CRT sin barras.
- **Sí:** la serpiente se dibuja con formas del canvas. El _spritesheet_ solo trae frutas.
- **Sí:** solo la fila pixel-art de `fruits.png` (la que recorta `sprites.js`), con sus 22 frutas elegidas al azar. Encaja con el resto del catálogo y evita mezclar tres estilos.
- **No:** usar los nombres de `sprites.js`. No coinciden con la imagen, así que los recortes se tratan como un array de índices.
- **No:** fruta distinta con puntos distintos. Es una mecánica nueva y otra spec.
- **Sí:** `onLivesChange(0)` constante y `hud.vidas: false`, como CAÍDA.
- **Sí:** el fin por tablero lleno (victoria) llama a `onGameOver(score)`, como indica el patrón. Es prácticamente inalcanzable y no se prueba en el navegador.
- **Sí:** la entrada local `serpentina` se **conserva** en `app/data.ts`, como `caida` y `bloque-buster`: el Home lee `GAMES.slice(0, 6)` y sirve de respaldo si Supabase falla.
- **Sí:** el motor espera la imagen antes de aceptar entrada, como el de BLOQUE BUSTER, para no avanzar sin ver la fruta.
- **Sí:** la prueba de comportamiento usa un `Image` síncrono. Es la lección de la SPEC 08: el smoke del skill no llega a ejecutar la lógica porque su `Image` carga de forma asíncrona.
- **Sí:** `dt` limitado a 50 ms, como en el patrón. Como `stepMs ≥ 60`, un fotograma nunca da más de un paso.

## Riesgos

| Riesgo                                                                                                  | Mitigación                                                                                                  |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Strict Mode monta el efecto dos veces y duplica el bucle                                                | `destroy()` cancela el frame y quita el listener; criterio de frames por segundo tras tres remontajes       |
| Envíos repetidos al guardar                                                                             | `ref` que bloquea al instante; criterio de tres clics seguidos                                              |
| Los nombres de `sprites.js` no coinciden con la imagen y se dibujaría una fruta distinta de la esperada | El motor usa solo índices; la spec lo declara y un criterio comprueba los 22 recortes                       |
| `fruits.png` pesa 585 KB y retrasa el primer dibujo                                                     | El motor no acepta entrada hasta que carga; reducir el peso queda fuera de alcance                          |
| La imagen de 3790×442 escalada a unos 36 px se ve borrosa o recortada                                   | Se comprueba la captura de las 22 frutas y se ajusta el margen dentro de la casilla sin cambiar las reglas  |
| Dos flechas en un mismo paso producen un giro de 180° y la partida acaba sin motivo                     | Cola de 2 flechas y rechazo de la opuesta a la última encolada; criterio explícito                          |
| Al reanudar tras una pausa se acumulan pasos y la serpiente salta                                       | `resume()` pone `lastTime = null` y limpia la cola; criterio de PAUSA                                       |
| La victoria por tablero lleno no se puede probar jugando                                                | Se revisa en el código y queda anotada como aceptada; es inalcanzable en la práctica                        |
| Si Supabase falla, `serpentina` vuelve a la ficha local con cifras ficticias y guardar no funciona      | El motor se juega igual y el modal muestra el error de guardado; criterio de degradación con clave inválida |

## Qué **no** está en esta spec

- Teclas WASD, controles táctiles y sonido.
- Obstáculos, frutas especiales o puntos distintos por fruta.
- Las filas plana y realista de `fruits.png`, y reducir su peso.
- Distinguir la victoria de la derrota en el reproductor.
- Vidas.
- Ranking por tiempo o donde menos puntos es mejor, y validación de puntuaciones en servidor.
- Cambios en los otros juegos, reales o placeholder.

Cada uno, si llega, va en su propia spec.
