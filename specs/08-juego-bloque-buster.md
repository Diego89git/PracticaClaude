# SPEC 08 — Tercer juego real: BLOQUE BUSTER (Arkanoid)

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06, SPEC 07
> **Fecha:** 2026-11-05
> **Objetivo:** Convertir el placeholder BLOQUE BUSTER en un juego real portando a TypeScript el Arkanoid de `references/started-games/04-arkanoid/`, jugable en `/jugar/bloque-buster` y con su leaderboard real en Supabase.

## Por qué existe esta spec

ASTEROIDES (SPEC 05 y 06) y CAÍDA (SPEC 07) fijaron el patrón: motor sin React, componente de canvas, reproductor de la plataforma, registro de juegos y leaderboard en Supabase. BLOQUE BUSTER es el tercero y el primero con assets (un _spritesheet_ y dos sonidos) y con niveles definidos como datos.

El catálogo ya tiene un placeholder `bloque-buster` (ARCADE, portada `cover-bricks`, color cyan) cuyo texto describe un Arkanoid. Igual que hizo SPEC 07 con `caida`, el juego real **toma ese id**: la fila de Supabase sustituye al placeholder en la Biblioteca, el detalle y el reproductor, y el Home no cambia. Como el registro ya existe, esta spec no lo crea: añade una línea en `catalog.ts` y otra en `components.tsx`. Sigue la receta de `.claude/skills/add-game/references/pattern.md`.

## Alcance

**Dentro:**

- Fila `bloque-buster` en la tabla `games` de Supabase, con su migración en `supabase/migrations/`. Reutiliza la portada `cover-bricks` y el texto actuales del placeholder.
- Motor en `app/games/bloque-buster/engine.ts`: el código de `references/started-games/04-arkanoid/game.js` portado a TypeScript, con las adaptaciones obligadas (canvas por parámetro, listeners con limpieza, callbacks hacia el HUD, sin DOM).
- Datos de niveles en `app/games/bloque-buster/levels.ts` (el `levels.js` original, idéntico) y helpers del _spritesheet_ en `app/games/bloque-buster/sprites.ts` (el `assets/spritesheet.js` original, sin su carga por DOM).
- Assets copiados a `public/games/bloque-buster/`: `spritesheet-breakout.png`, `ball-bounce.mp3` y `break-sound.mp3`, referenciados con rutas absolutas.
- Componente cliente `app/components/bloque-buster-game.tsx` que monta el motor en un `<canvas>` de 800×600 dentro del marco CRT.
- Entrada de `bloque-buster` en el registro de juegos (`app/games/catalog.ts` y `app/games/components.tsx`): HUD con Puntuación, Vidas y Nivel.
- PAUSA, FIN, JUGAR DE NUEVO y GUARDAR PUNTUACIÓN con el juego real; puntuación guardada en `scores`.
- Mecánicas del original sin cambios: paleta, pelota que rebota en paredes, techo y paleta, bloques de 10 puntos, 3 vidas, 5 niveles con velocidad creciente, animación de explosión de bloques y sonidos de rebote y rotura.
- Control solo con teclado: ← → mueven la paleta. Las flechas y ESPACIO no hacen scroll de la página.
- Victoria tratada como fin de partida: al limpiar el nivel 5 se llama a `onGameOver(score)`.

**Fuera de alcance (specs futuras):**

- Control con ratón: `mousemove` para mover la paleta y `click` en el canvas.
- El selector «Saltar al nivel» de la pantalla de pausa del original (era una herramienta de desarrollo y dependía del ratón).
- La tecla P y Esc de pausa del original: la pausa es el botón PAUSA de la plataforma.
- Distinguir la victoria de la derrota en el reproductor (mensaje o modal distinto).
- Controles táctiles o para móvil.
- Cambios de balance (velocidades, puntos, tamaño de paleta o pelota), power-ups, bloques con varios golpes o ángulo de rebote según el punto de la paleta.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cambios en los otros juegos, reales o placeholder.

## Modelo de datos

Fila de `games` (migración `supabase/migrations/20261105180000_game_bloque_buster.sql`), con el texto que ya tiene el placeholder en `app/data.ts`:

```sql
insert into public.games (id, title, short, long, cat, cover, color) values (
  'bloque-buster',
  'BLOQUE BUSTER',
  'Rebota la pelota y destruye muros de neón.',
  'Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?',
  'ARCADE',
  'cover-bricks',
  'cyan'
);
```

Entrada del registro (`app/games/catalog.ts`):

```ts
"bloque-buster": { hud: { vidas: true, nivel: true } },
```

Motor: `createBloqueBuster(canvas: HTMLCanvasElement, events: GameEvents): GameEngine`, con el contrato de `.claude/skills/add-game/references/pattern.md` sección 2. Constantes del original que se conservan:

```ts
const W = 800;
const H = 600;
const PADDLE_SPEED = 400; // px/s
const BLOCK_COLS = 10;
const BLOCK_ROWS = 6;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2; // 80
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const BLOCK_SCORE = 10;
const INITIAL_LIVES = 3;
// paleta: w 81, h 14, y 560, centrada al empezar; pelota: 16×16
// LEVELS (levels.ts): 5 niveles, velocidades 1.00, 1.10, 1.21, 1.33, 1.46
// EXPLOSION_DURATION = 150 ms, 4 fotogramas por color
```

Reglas del original que el motor conserva: la pelota sale de la paleta al cargar un nivel y al perder una vida, y se mueve desde el primer fotograma (no hay lanzamiento con clic); `vx = BASE_BALL_VX × speed`, `vy = BASE_BALL_VY × speed`; la paleta no se recoloca al cambiar de nivel; en cada fotograma solo se rompe un bloque y el rebote vertical invierte `vy`; el rebote en la paleta fija `vy = −|vy|` y no cambia `vx`; la pelota se pierde al pasar `y > 600`.

Assets en `public/games/bloque-buster/` y rutas absolutas: `/games/bloque-buster/spritesheet-breakout.png`, `/games/bloque-buster/ball-bounce.mp3`, `/games/bloque-buster/break-sound.mp3`. La imagen se carga con `new Image()` en el motor y el bucle no dibuja sprites hasta que `onload` dispara; si falla, se registra con `console.error` como en el original.

Convenciones: canvas de 800×600 px (4:3, llena el marco CRT); tiempos en segundos salvo `EXPLOSION_DURATION` en ms; `dt` limitado a 50 ms.

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas") y la sección 5 de `.claude/skills/add-game/references/porting.md` (notas de `04-arkanoid`), y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components y Cache Components, según exige `AGENTS.md`. No se crea portada, así que no hace falta `/frontend-design`.

1. **Ficha.** Crear la migración con la fila `bloque-buster` y aplicarla con `apply_migration` **tras pedir confirmación al usuario**. Se conserva la entrada local en `app/data.ts`. Verificar: `list_tables` y una consulta muestran la fila; `/biblioteca` sigue con 9 tarjetas y la de BLOQUE BUSTER muestra `best` 0; `/juegos/bloque-buster` carga; `/jugar/bloque-buster` aún muestra el placeholder.
2. **Assets y datos de niveles.** Copiar los tres archivos a `public/games/bloque-buster/` y crear `app/games/bloque-buster/levels.ts` (`LEVELS`, idéntico a `levels.js`, con tipos) y `sprites.ts` (`SPRITES`, `EXPLOSION_FRAMES`, `EXPLOSION_DURATION` y `drawSprite`/`drawFrame` que reciben la imagen). Verificar: `npx tsc --noEmit` y `npx eslint app/games`; los 5 niveles tienen 60, 40, 30, 39 y 39 bloques.
3. **Motor.** Crear `app/games/bloque-buster/engine.ts` desde `.claude/skills/add-game/assets/engine.ts.tpl` portando `game.js` según `references/porting.md`: estado de cierre en lugar de globales, imagen y sonidos creados dentro de `createBloqueBuster`, sin `document.` ni overlays ni HUD dibujados, sin `mousemove` ni `click`, sin tecla P ni Esc, teclas con `e.code` (`ArrowLeft`, `ArrowRight`) en `keydown`/`keyup` de `window` ignorando campos de texto, reproducción de sonido con `.cloneNode().play()` capturando el rechazo de la promesa, `onLivesChange` al perder una pelota, `onLevelChange` al cargar un nivel y `onGameOver(score)` una sola vez al perder la última vida o limpiar el nivel 5. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y `node .claude/skills/add-game/scripts/engine-smoke.mjs app/games/bloque-buster/engine.ts createBloqueBuster`.
4. **Componente.** Crear `app/components/bloque-buster-game.tsx` desde `.claude/skills/add-game/assets/game-component.tsx.tpl` con el canvas de 800×600.
5. **Registro.** Añadir `bloque-buster` a `catalog.ts` y `components.tsx`. Verificar en el navegador: `/jugar/bloque-buster` muestra el canvas con bloques, paleta y pelota, el HUD muestra Puntuación, Vidas y Nivel, PAUSA congela y FIN abre el modal.
6. **Cierre.** `npm run lint`, `npm run build` sin trazas de error, `get_advisors` de seguridad sin avisos, `node .claude/skills/add-game/scripts/rls-check.mjs bloque-buster` y una partida completa hasta verla en `/juegos/bloque-buster` y en la pestaña de BLOQUE BUSTER de `/salon`. Borrar todas las filas de prueba de `scores`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] La tabla `games` contiene la fila `bloque-buster` con `cover-bricks` y color `cyan`; `supabase/migrations/` contiene su migración.
- [ ] `/biblioteca` sigue mostrando 9 tarjetas; la de BLOQUE BUSTER muestra `best` 0 y conserva su portada.
- [ ] El Home (`/`) sigue mostrando exactamente las mismas 6 mini tarjetas, incluida BLOQUE BUSTER con su título, portada y color.
- [ ] `/juegos/bloque-buster` muestra título, descripción larga y, sin puntuaciones, "Sé el primero en entrar al salón de la fama" en lugar del ranking ficticio.
- [ ] `/jugar/bloque-buster` muestra el juego real en un canvas de 800×600 dentro del marco CRT, sin el placeholder; `/jugar/caida`, `/jugar/asteroides` y los placeholders siguen como antes.
- [ ] El canvas no dibuja "Score", "Nivel", las vidas ni "GAME OVER"; el HUD de la plataforma muestra Puntuación, Vidas y Nivel.
- [ ] `public/games/bloque-buster/` contiene los tres assets y el motor los referencia con rutas absolutas que empiezan por `/games/bloque-buster/`.
- [ ] No se dibuja ningún sprite hasta que la imagen ha cargado, y el bucle no lanza errores si el primer fotograma llega antes.
- [ ] Al empezar hay 60 bloques en 6 filas de 10 (nivel 1), la paleta de 81×14 está centrada en `y = 560` y la pelota sale de ella con `vx = 200` y `vy = −300`.
- [ ] Los niveles tienen 60, 40, 30, 39 y 39 bloques por este orden y velocidades 1.00, 1.10, 1.21, 1.33 y 1.46.
- [ ] ← mueve la paleta a la izquierda y → a la derecha a 400 px/s sin salir del canvas; el ratón no mueve la paleta.
- [ ] La pelota rebota en las paredes laterales y en el techo, y en la paleta sale siempre hacia arriba sin cambiar `vx`.
- [ ] Romper un bloque suma exactamente 10 puntos, invierte `vy`, muestra la explosión durante 150 ms y reproduce `break-sound.mp3`; el rebote en paredes y paleta reproduce `ball-bounce.mp3`.
- [ ] Solo se rompe un bloque por fotograma.
- [ ] Si la pelota pasa `y > 600` resta una vida en el HUD y vuelve a salir de la paleta con la velocidad del nivel.
- [ ] Limpiar todos los bloques de un nivel (1 a 4) sube el nivel del HUD en 1, carga el siguiente patrón y no cambia la posición de la paleta ni las vidas.
- [ ] Perder la tercera vida deja las vidas del HUD en 0 y abre el modal "FIN DEL JUEGO" con la puntuación final.
- [ ] Limpiar el nivel 5 abre el mismo modal "FIN DEL JUEGO" con la puntuación final, una sola vez.
- [ ] La tecla P y Esc no pausan el juego y la pantalla de pausa del canvas no existe.
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras se juega.
- [ ] PAUSA congela el juego (pelota, paleta y explosiones) y muestra "EN PAUSA"; REANUDAR continúa donde estaba sin salto de la pelota.
- [ ] FIN abre el mismo modal con la puntuación actual.
- [ ] Con el modal abierto, ESPACIO no cambia la puntuación y teclear el nombre no mueve la paleta.
- [ ] El nombre se pre-rellena desde `localStorage["av_player_name"]`; GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "bloque-buster"` y `user_id: null`.
- [ ] El botón se deshabilita durante el envío: tres clics seguidos insertan una sola fila.
- [ ] Si el insert falla, el modal muestra un error, no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] La puntuación guardada aparece en `/juegos/bloque-buster` y en la pestaña de BLOQUE BUSTER de `/salon` al recargar.
- [ ] JUGAR DE NUEVO deja puntuación 0, vidas 3, nivel 1 y los 60 bloques del nivel 1.
- [ ] Salir de `/jugar/bloque-buster` y volver no duplica el bucle: los frames por segundo no aumentan tras tres remontajes.
- [ ] El canvas se ve completo sin scroll horizontal a 1440 px y a 768 px de ancho.
- [ ] `app/games/bloque-buster/engine.ts` no contiene `document.` y solo usa `window.` para registrar y quitar `keydown` y `keyup`.
- [ ] Con la clave publishable, el `INSERT` válido en `scores` pasa, los inválidos se rechazan y `UPDATE`/`DELETE` no modifican filas.
- [ ] `/juegos/no-existe` y `/jugar/no-existe` muestran la pantalla 404.
- [ ] Con una clave de Supabase inválida, `/biblioteca` sigue respondiendo 200 y `/jugar/bloque-buster` carga.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

- **Sí:** el Arkanoid real reemplaza al placeholder `bloque-buster` y conserva su id, título, portada, color y texto. Respuesta del usuario. Evita dos tarjetas de bloques y no mueve nada en el Home.
- **No:** un id nuevo `arkanoid` con portada propia. Habría dos juegos de bloques en la Biblioteca.
- **Sí:** solo teclado (← →), con la misma velocidad de 400 px/s que el teclado del original. Respuesta del usuario; la plataforma es solo teclado.
- **No:** mantener el ratón sobre el canvas. Dos entradas a la vez dan una paleta que salta entre ambas.
- **No:** portar «Saltar al nivel» de la pausa. Era una herramienta de desarrollo, dependía del clic y la pausa es del botón PAUSA de la plataforma.
- **Sí:** portar los sonidos y la animación de explosión, con sus assets en `public/games/bloque-buster/`. Respuesta del usuario; son parte del juego (specs 02 y 03 del original).
- **Sí:** la victoria llama a `onGameOver(score)` y abre el mismo modal. Respuesta del usuario y regla del patrón; distinguirla exigiría tocar el reproductor.
- **Sí:** la pelota se mueve desde el primer fotograma, sin lanzamiento. Es el comportamiento del original; el clic solo servía para la pausa.
- **Sí:** se conserva la paleta de 81 px del código aunque el sprite mide 162×14: el original lo dibuja escalado a 81. Cambiarla es balance.
- **Sí:** teclas con `e.code` y listeners en `window`, como indica `references/porting.md`; el original usaba `e.key` en `document`.
- **Sí:** el HUD, la pausa, FIN y el modal los pone la plataforma. Se retiran del canvas «Score», «Nivel», las bolas de vida, el GAME OVER y el mensaje de victoria.
- **Sí:** `hud: { vidas: true, nivel: true }`. El original tiene 3 vidas y 5 niveles.
- **Sí:** la entrada local `bloque-buster` se **conserva** en `app/data.ts`, como `caida`: el Home lee `GAMES.slice(0, 6)` y sirve de respaldo si Supabase falla; en el resto la sustituye la fila de Supabase.
- **Sí:** el motor reproduce los sonidos con `cloneNode().play()` y captura el rechazo, porque los navegadores solo permiten audio tras un gesto; entrar desde la ficha con un clic lo cumple.
- **Sí:** esta spec reemplaza el criterio de la SPEC 06 según el cual los juegos locales muestran ranking ficticio, para `bloque-buster`: ahora es real.
- **Sí:** `dt` limitado a 50 ms, como en el patrón.

## Riesgos

| Riesgo                                                                                                | Mitigación                                                                                                  |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Strict Mode monta el efecto dos veces y duplica el bucle                                              | `destroy()` cancela el frame y quita los listeners; criterio de frames por segundo tras tres remontajes     |
| Envíos repetidos al guardar                                                                           | `ref` que bloquea al instante; criterio de tres clics seguidos                                              |
| La imagen tarda en cargar y el primer fotograma dibuja sin sprites                                    | El motor no dibuja sprites hasta `onload`; criterio explícito                                               |
| El navegador bloquea el audio antes de un gesto y `play()` rechaza la promesa                         | Se captura el rechazo; se prueba un sonido real tras entrar con un clic                                     |
| Un `Audio` clonado por cada rebote acumula elementos                                                  | Se conserva el comportamiento del original; son efectos cortos y el navegador los libera al terminar        |
| Destruir el motor durante una explosión o sonido en curso                                             | `destroy()` cancela el frame; no hay temporizadores propios, las explosiones avanzan con `dt`               |
| La pelota atraviesa un bloque a velocidad alta (colisión AABB sin barrido)                            | Comportamiento del original, aceptado: la velocidad máxima es 1.46 × 300 px/s con `dt` ≤ 50 ms              |
| Sin ángulo de rebote la pelota puede quedar en un bucle horizontal                                    | Comportamiento del original, aceptado; cambiarlo es balance y otra spec                                     |
| Con rutas de assets absolutas el motor no funciona si se sirve bajo un `basePath`                     | El proyecto no usa `basePath`; si se añade, habría que prefijar las rutas                                   |
| Si Supabase falla, `bloque-buster` vuelve a la ficha local con cifras ficticias y guardar no funciona | El motor se juega igual y el modal muestra el error de guardado; criterio de degradación con clave inválida |

## Qué **no** está en esta spec

- Control con ratón, selector de nivel de la pausa, tecla P o Esc.
- Distinguir la victoria de la derrota en el reproductor.
- Controles táctiles, power-ups o mecánicas nuevas.
- Cambios de balance o recoloreo.
- Ranking por tiempo o donde menos puntos es mejor, y validación de puntuaciones en servidor.
- Cambios en los otros juegos, reales o placeholder.

Cada uno, si llega, va en su propia spec.
