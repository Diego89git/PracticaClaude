# SPEC 07 — Segundo juego real: CAÍDA (Tetris)

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06
> **Fecha:** 2026-11-05
> **Objetivo:** Convertir el placeholder CAÍDA en un juego real portando a TypeScript el `game.js` de `references/started-games/03-tetris/`, jugable en `/jugar/caida` y con su leaderboard real en Supabase.

## Por qué existe esta spec

ASTEROIDES (SPEC 05 y 06) fue el primer juego real y fijó el patrón: motor sin React, componente de canvas, reproductor de la plataforma y leaderboard en Supabase. CAÍDA es el segundo, y con él llega el momento que las SPEC 05 y 06 dejaron anotado: hoy `game-player.tsx` y `app/data.ts` tienen `"asteroides"` escrito a mano, así que esta spec crea el **registro de juegos** para que un juego nuevo añada una línea en lugar de tocar el reproductor.

El catálogo ya tiene un placeholder `caida` (PUZZLE, portada `cover-tetro`, magenta) cuyo texto describe un Tetris. En lugar de añadir un décimo juego, el Tetris real **toma ese id**: la fila de Supabase sustituye al placeholder en la Biblioteca, el detalle y el reproductor, y el Home no cambia. La spec sigue la receta de `.claude/skills/add-game/references/pattern.md`.

## Alcance

**Dentro:**

- Registro de juegos: `app/games/types.ts`, `app/games/catalog.ts` y `app/games/components.tsx`, con ASTEROIDES migrado a él sin cambios de comportamiento.
- Fila `caida` en la tabla `games` de Supabase, con su migración en `supabase/migrations/`. Reutiliza la portada `cover-tetro` y el texto actuales del placeholder.
- Motor en `app/games/caida/engine.ts`: el código de `references/started-games/03-tetris/game.js` portado a TypeScript, con las adaptaciones obligadas (canvas por parámetro, listeners con limpieza, callbacks hacia el HUD, sin DOM).
- Componente cliente `app/components/caida-game.tsx` que monta el motor en un `<canvas>` de 800×600 dentro del marco CRT.
- Canvas de 800×600 con el tablero de 300×600 y un panel lateral dibujado dentro: vista previa de la siguiente pieza y contador de líneas.
- Entrada de `caida` en el registro: HUD con Puntuación y Nivel, sin Vidas.
- PAUSA, FIN, JUGAR DE NUEVO y GUARDAR PUNTUACIÓN con el juego real; puntuación guardada en `scores`.
- Mecánicas del original sin cambios, salvo las 7 piezas (ver decisiones): tablero de 10×20, rotación con _wall kicks_, caída suave y caída instantánea, pieza fantasma, vista previa, puntuación por líneas, niveles cada 10 líneas que aceleran la caída.
- Control solo con teclado, con la entrada del original: ← → mover, ↓ bajar, ↑ o X girar, ESPACIO caída instantánea. Las flechas y ESPACIO no hacen scroll de la página.

**Fuera de alcance (specs futuras):**

- La pieza «tuerca» (N) del código original: se portan solo las 7 piezas estándar.
- La tecla P de pausa y el selector de tema claro/oscuro del original (con su `localStorage('tetris-theme')`): la pausa es el botón PAUSA de la plataforma y el tema es el de la plataforma.
- Controles táctiles o para móvil.
- Sonido y animaciones nuevas.
- Cambios de balance (velocidades, puntos, tamaño del tablero) o recoloreo del juego.
- Vidas: Tetris no las tiene y el HUD no las muestra.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cambios en ASTEROIDES más allá de su migración al registro, y en los otros 7 juegos placeholder.
- Datos reales en el Home ("Actividad en vivo", "Top de hoy").

## Modelo de datos

Fila de `games` (migración `supabase/migrations/<timestamp>_game_caida.sql`), con el texto que ya tiene el placeholder en `app/data.ts`:

```sql
insert into public.games (id, title, short, long, cat, cover, color) values (
  'caida',
  'CAÍDA',
  'Encaja las piezas antes de que el techo te aplaste.',
  'Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.',
  'PUZZLE',
  'cover-tetro',
  'magenta'
);
```

Registro de juegos (`app/games/types.ts`, `catalog.ts`, `components.tsx`), con el contrato de `.claude/skills/add-game/references/pattern.md` sección 4:

```ts
// types.ts
export interface GameEvents {
  onScoreChange: (score: number) => void;
  onLivesChange: (lives: number) => void;
  onLevelChange: (level: number) => void;
  onGameOver: (finalScore: number) => void;
}
export interface GameEngine {
  pause: () => void;
  resume: () => void;
  restart: () => void;
  destroy: () => void;
}
export interface GameProps extends GameEvents {
  paused: boolean;
  over: boolean;
  runId: number;
}

// catalog.ts (datos puros, seguro de importar desde Server Components)
export const JUEGOS_REALES = {
  asteroides: { hud: { vidas: true, nivel: true } },
  caida: { hud: { vidas: false, nivel: true } },
};
export const esJuegoReal = (id: string) => id in JUEGOS_REALES;
```

`components.tsx` (`"use client"`) asocia cada id con su componente mediante `next/dynamic`. `tieneRankingReal` de `app/data.ts` pasa a ser `esJuegoReal` (o lo reexporta).

Motor: `createCaida(canvas: HTMLCanvasElement, events: GameEvents): GameEngine`. Constantes del original que se conservan:

```ts
const COLS = 10;
const ROWS = 20;
const BLOCK = 30; // tablero de 300×600
const LINE_SCORES = [0, 100, 300, 500, 800]; // × nivel
// PIECES y COLORS: 7 piezas (I, O, T, S, Z, J, L) con los colores del original
// dropInterval = max(100, 1000 − (nivel − 1) × 90) ms; nivel = floor(líneas / 10) + 1
// _wall kicks_ al girar: [0, -1, 1, -2, 2]
```

Reglas de puntuación del original: caída suave (↓) +1 punto por fila; caída instantánea (ESPACIO) +2 puntos por celda recorrida; la gravedad no suma; limpiar 1, 2, 3 o 4 líneas suma 100, 300, 500 u 800 multiplicado por el nivel. La partida acaba cuando la pieza nueva colisiona al aparecer.

Disposición del canvas lógico de 800×600 (valores iniciales, se ajustan al ver la captura sin cambiar el comportamiento):

```ts
const W = 800;
const H = 600;
const BOARD_X = 150; // el tablero ocupa x = 150..450, y = 0..600
const PANEL_X = 490; // "SIGUIENTE" con vista previa de 120×120 y "LÍNEAS" con su contador
```

Colores del dibujo, tomados del tema oscuro del original: fondo del tablero `#1a1a25`, rejilla `#22222e`, fondo fuera del tablero `#0f0f17`. El original leía la rejilla de una variable CSS (`--grid-line`); aquí es una constante.

Convenciones: coordenadas con origen arriba a la izquierda; tiempos en segundos; `dt` limitado a 50 ms.

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas") y la sección 5 de `.claude/skills/add-game/references/porting.md` (notas de `03-tetris`), y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components y Cache Components, según exige `AGENTS.md`.

1. **Registro de juegos.** Crear `app/games/types.ts`, `catalog.ts` y `components.tsx`; mover a `types.ts` los eventos y props de ASTEROIDES y que su motor y su componente los usen; sustituir en `game-player.tsx` el `game.id === "asteroides"` por `esJuegoReal` y `COMPONENTES[game.id]`; ocultar Vidas y Nivel del HUD según `hud`; sustituir `tieneRankingReal` por `esJuegoReal` en `app/juegos/[id]/page.tsx` y `hall-of-fame.tsx`. Verificar: `npx tsc --noEmit`, `npx eslint app` y ASTEROIDES se juega, se pausa y se guarda exactamente igual que antes.
2. **Ficha.** Crear la migración con la fila `caida` y aplicarla con `apply_migration` **tras pedir confirmación al usuario**. No se crea portada: se reutiliza `cover-tetro`. Verificar: `list_tables` y una consulta muestran la fila; `/biblioteca` sigue con 9 tarjetas y la de CAÍDA muestra `best` 0; `/juegos/caida` carga; `/jugar/caida` aún muestra el placeholder.
3. **Motor.** Crear `app/games/caida/engine.ts` desde `.claude/skills/add-game/assets/engine.ts.tpl` portando `game.js` según `references/porting.md`: estado de cierre en lugar de globales, 7 piezas, sin DOM ni overlay ni selector de tema ni tecla P, vista previa y líneas dibujadas en el panel lateral del canvas, `keydown` en `window` que ejecuta la acción de cada evento (también los repetidos por mantener la tecla) y se quita en `destroy`, `onGameOver(score)` cuando la pieza nueva colisiona. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y `node .claude/skills/add-game/scripts/engine-smoke.mjs app/games/caida/engine.ts createCaida`.
4. **Componente.** Crear `app/components/caida-game.tsx` desde `.claude/skills/add-game/assets/game-component.tsx.tpl` con el canvas de 800×600.
5. **Registro.** Añadir `caida` a `catalog.ts` y `components.tsx`. Verificar en el navegador: `/jugar/caida` muestra el canvas con el tablero y el panel, el HUD muestra Puntuación y Nivel sin Vidas, PAUSA congela y FIN abre el modal.
6. **Cierre.** `npm run lint`, `npm run build` sin trazas de error, `get_advisors` de seguridad sin avisos, `node .claude/skills/add-game/scripts/rls-check.mjs caida` y una partida completa hasta verla en `/juegos/caida` y en la pestaña de CAÍDA de `/salon`. Borrar todas las filas de prueba de `scores`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] La tabla `games` contiene la fila `caida` con `cover-tetro` y color `magenta`; `supabase/migrations/` contiene su migración.
- [ ] `app/games/types.ts`, `catalog.ts` y `components.tsx` existen y `game-player.tsx` ya no contiene `"asteroides"` ni `"caida"` escritos a mano.
- [ ] ASTEROIDES se juega, se pausa y se guarda igual que antes del registro.
- [ ] `/biblioteca` sigue mostrando 9 tarjetas; la de CAÍDA muestra `best` 0 y PUZZLE muestra solo CAÍDA.
- [ ] El Home (`/`) sigue mostrando exactamente las mismas 6 mini tarjetas, incluida CAÍDA con su título, portada y color.
- [ ] `/juegos/caida` muestra título, descripción larga y, sin puntuaciones, "Sé el primero en entrar al salón de la fama" en lugar del ranking ficticio.
- [ ] `/jugar/caida` muestra el juego real en un canvas de 800×600 dentro del marco CRT, sin el placeholder; `/jugar/rocas` y los demás placeholders siguen con el suyo.
- [ ] El canvas dibuja un tablero de 10×20 celdas de 30 px y, a su lado, "SIGUIENTE" con la siguiente pieza y "LÍNEAS" con el contador; no dibuja puntuación, nivel ni "GAME OVER".
- [ ] El HUD de la plataforma muestra Puntuación y Nivel y no muestra Vidas.
- [ ] `PIECES` del motor contiene exactamente 7 piezas (I, O, T, S, Z, J, L) y `randomPiece` elige entre ellas; no existe la pieza N ni el color gris `#9e9e9e`.
- [ ] Cada evento `keydown` de ← o → mueve la pieza una columna si no colisiona, también los repetidos por mantener la tecla; la pieza no sale del tablero.
- [ ] ↑ y X giran la pieza 90° en sentido horario y aplican los desplazamientos `[0, -1, 1, -2, 2]` si choca contra una pared.
- [ ] ↓ baja la pieza una fila y suma 1 punto; si no puede bajar, la fija.
- [ ] ESPACIO baja la pieza hasta el fondo, suma 2 puntos por celda recorrida y la fija.
- [ ] La pieza fantasma se dibuja con opacidad 0,2 donde aterrizará la pieza actual.
- [ ] Sin tocar el teclado, la pieza baja una fila cada 1000 ms en el nivel 1 y cada `max(100, 1000 − (nivel − 1) × 90)` ms en los siguientes.
- [ ] Completar 1, 2, 3 o 4 líneas suma 100, 300, 500 u 800 multiplicado por el nivel; el contador "LÍNEAS" del canvas se actualiza.
- [ ] El nivel es `floor(líneas / 10) + 1` y el HUD lo muestra.
- [ ] Cuando la pieza nueva colisiona al aparecer, se abre el modal "FIN DEL JUEGO" con la puntuación final.
- [ ] La tecla P no pausa el juego y no hay selector de tema claro/oscuro.
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras se juega.
- [ ] PAUSA congela el juego y muestra "EN PAUSA"; REANUDAR continúa donde estaba; FIN abre el mismo modal con la puntuación actual.
- [ ] Con el modal abierto, ESPACIO no cambia la puntuación y teclear el nombre no mueve la pieza.
- [ ] El nombre se pre-rellena desde `localStorage["av_player_name"]`; GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "caida"` y `user_id: null`.
- [ ] El botón se deshabilita durante el envío: tres clics seguidos insertan una sola fila.
- [ ] Si el insert falla, el modal muestra un error, no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] La puntuación guardada aparece en `/juegos/caida` y en la pestaña de CAÍDA de `/salon` al recargar.
- [ ] JUGAR DE NUEVO deja puntuación 0, nivel 1, 0 líneas y un tablero vacío.
- [ ] Salir de `/jugar/caida` y volver no duplica el bucle: los frames por segundo no aumentan tras tres remontajes.
- [ ] El canvas se ve completo sin scroll horizontal a 1440 px y a 768 px de ancho.
- [ ] `app/games/caida/engine.ts` no contiene `document.` y solo usa `window.` para registrar y quitar el `keydown`.
- [ ] Con la clave publishable, el `INSERT` válido en `scores` pasa, los inválidos se rechazan y `UPDATE`/`DELETE` no modifican filas.
- [ ] `/juegos/no-existe` y `/jugar/no-existe` muestran la pantalla 404.
- [ ] Con una clave de Supabase inválida, `/biblioteca` sigue respondiendo 200 y `/jugar/caida` carga.
- [ ] `scores` no contiene filas de prueba al terminar.

## Decisiones tomadas y descartadas

- **Sí:** el Tetris real reemplaza al placeholder `caida` y conserva su id, título, portada, color y texto. La tarjeta no cambia de sitio, el Home no cambia y no hay dos clones de Tetris en el catálogo.
- **No:** un juego nuevo con id `tetris`. Habría dos tarjetas de Tetris en la Biblioteca.
- **Sí:** solo las 7 piezas estándar. **Es un cambio deliberado respecto al código de referencia**, que tiene 8 (añade una «tuerca» gris N de 3×3 con hueco) aunque su README promete 7.
- **No:** portar la pieza N. Cuadra con el README y con el Tetris clásico.
- **Sí:** canvas lógico de 800×600 con el tablero de 300×600 y un panel lateral dibujado. Llena el marco CRT 4:3 y conserva la vista previa y las líneas.
- **No:** canvas estrecho de 420×600 ni solo el tablero. El primero deja barras negras anchas y el segundo pierde la vista previa de la siguiente pieza, que afecta a la jugabilidad.
- **Sí:** entrada como el original, por evento `keydown` con la auto-repetición del teclado. Mover y bajar se sienten igual que en la referencia, y mantener ESPACIO sigue encadenando caídas.
- **No:** una variante donde ESPACIO y girar no se repiten. Cambia el original y no se pidió.
- **Sí:** las líneas y la vista previa se dibujan en el canvas, como el temporizador `3x` de ASTEROIDES: la plataforma no tiene campo para ellas.
- **Sí:** el HUD no muestra Vidas (`hud.vidas: false`). Tetris no las tiene y acaba cuando la pieza nueva colisiona.
- **Sí:** se eliminan la tecla P y el selector de tema. La pausa es el botón PAUSA de la plataforma y dos vías distintas se desincronizan.
- **Sí:** el registro de juegos se crea en esta spec, como anotaron las SPEC 05 y 06 para el segundo juego, con `catalog.ts` (datos puros) separado de `components.tsx` (`"use client"`) para poder importar `esJuegoReal` desde Server Components.
- **Sí:** la entrada local `caida` se **conserva** en `app/data.ts`, a diferencia de lo que se hizo con ASTEROIDES. El Home lee `GAMES.slice(0, 6)` y la necesita; en la Biblioteca, el detalle y el reproductor la sustituye la fila de Supabase porque gana si coincide el id.
- **Sí:** el texto de la ficha es el que ya tiene el placeholder; describe el juego y menciona el cambio de velocidad cada 10 líneas, que el motor respeta.
- **Sí:** esta spec reemplaza el criterio de la SPEC 06 según el cual `/juegos/caida` muestra un ranking ficticio: ahora es real.
- **Sí:** el fondo, la rejilla y los colores de las piezas son los del tema oscuro del original, como constantes. El tema claro no se porta.
- **Sí:** `dt` limitado a 50 ms, como en el patrón. La gravedad acumula tiempo igual que el original.

## Riesgos

| Riesgo                                                                                                                      | Mitigación                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Strict Mode monta el efecto dos veces y duplica el bucle                                                                    | `destroy()` cancela el frame y quita el listener; criterio de frames por segundo tras tres remontajes       |
| Envíos repetidos al guardar                                                                                                 | `ref` que bloquea al instante; criterio de tres clics seguidos                                              |
| La entrada por evento con auto-repetición depende de la configuración de repetición del sistema                             | Se prueba simulando eventos `keydown` repetidos, que es lo que hace el navegador al mantener la tecla       |
| Mantener ESPACIO encadena caídas instantáneas, también justo antes de perder                                                | Comportamiento del original, aceptado; con el modal abierto el motor ignora la entrada                      |
| Si Supabase falla, `caida` vuelve a la ficha local con cifras ficticias y guardar la puntuación no funciona                 | El motor se juega igual y el modal muestra el error de guardado; criterio de degradación con clave inválida |
| El registro toca `game-player.tsx`, `hall-of-fame.tsx` y la página de detalle, ya probados con ASTEROIDES                   | El paso 1 exige que ASTEROIDES se comporte exactamente igual antes de añadir CAÍDA                          |
| Quitar la pieza N hace que el juego difiera del de la referencia                                                            | Decisión explícita del usuario; criterio verificable de que `PIECES` tiene 7 piezas                         |
| El texto dibujado en el canvas ("SIGUIENTE", "LÍNEAS") se escala con el canvas y puede verse pequeño en pantallas estrechas | Se comprueba la captura a 768 px y se ajusta el tamaño de fuente en el motor                                |

## Qué **no** está en esta spec

- La pieza N (tuerca), la tecla P y el selector de tema del original.
- Controles táctiles, sonido o animaciones nuevas.
- Cambios de balance, de tamaño del tablero o recoloreo.
- Vidas.
- Ranking por tiempo o donde menos puntos es mejor, y validación de puntuaciones en servidor.
- Cambios en ASTEROIDES salvo su migración al registro, y en los otros 7 placeholders.
- Datos reales en el Home.

Cada uno, si llega, va en su propia spec.
