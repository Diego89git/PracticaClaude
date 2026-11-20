# Patrón de integración de un juego en Arcade Vault

Receta destilada de las SPEC 05 (ASTEROIDES) y SPEC 06 (tabla `games` y leaderboard). Léela al redactar la spec de un juego nuevo y al implementarla con `/spec-impl`: cada trampa de la sección 7 costó al menos una vuelta de depuración.

**Contenido:** 1 Piezas · 2 Motor · 3 Componente · 4 Reproductor y registro · 5 Supabase · 6 Páginas · 7 Trampas · 8 Verificación

## 1. Piezas

| Pieza                      | Archivo                                         | Alcance                       |
| -------------------------- | ----------------------------------------------- | ----------------------------- |
| Motor del juego            | `app/games/<id>/engine.ts`                      | uno por juego                 |
| Componente del canvas      | `app/components/<id>-game.tsx`                  | uno por juego                 |
| Ficha en la base de datos  | `supabase/migrations/<ts>_game_<id>.sql`        | uno por juego                 |
| Portada                    | clase `.cover-<id>` en `app/globals.css`        | una por juego                 |
| Assets (sprites, sonidos)  | `public/games/<id>/`                            | solo si el juego los tiene    |
| Tipos comunes              | `app/games/types.ts`                            | compartido (ver sección 4)    |
| Catálogo de juegos reales  | `app/games/catalog.ts`                          | una entrada por juego         |
| Componente por id          | `app/games/components.tsx`                      | una línea por juego           |
| Reproductor                | `app/components/game-player.tsx`                | compartido                    |
| Lecturas de Supabase       | `lib/supabase/queries.ts`, `scores.ts`          | compartido, no se toca        |
| Páginas                    | `app/juegos/[id]`, `app/jugar/[id]`, `app/salon`, `app/biblioteca` | compartido, no se tocan |

Las tablas `games` y `scores`, sus políticas RLS y los tipos generados ya existen. **Un juego nuevo no cambia el esquema**: solo inserta una fila en `games`.

### Estado conocido (SPEC 07, 2026-11-05)

Compáralo con el repo antes de redactar la spec; si difiere, manda el repo.

- **Juegos reales:** `asteroides` (SPEC 05 y 06) y `caida` (SPEC 07, el Tetris de `references/started-games/03-tetris`). Los otros 7 juegos de `app/data.ts` son placeholders.
- **El registro existe desde la SPEC 07:** `app/games/types.ts` (`GameEvents`, `GameEngine`, `GameProps`), `app/games/catalog.ts` (`JUEGOS_REALES`, `esJuegoReal`, `juegoReal`) y `app/games/components.tsx` (`COMPONENTES`, con `next/dynamic`). Un juego nuevo añade **una línea en cada uno de los dos últimos** y no toca `game-player.tsx`, `hall-of-fame.tsx` ni las páginas. `tieneRankingReal` ya no existe.
- **Fichas:** `asteroides` vive solo en Supabase. `caida` vive en Supabase **y se conserva en `app/data.ts`**, porque el Home lee `GAMES.slice(0, 6)` y porque sirve de respaldo si Supabase falla; la fila de Supabase gana en la Biblioteca, el detalle y el reproductor. Hay dos migraciones: `..._games_and_scores.sql` y `..._game_caida.sql`.
- `lib/supabase/queries.ts` y `scores.ts` combinan `GAMES` locales con la tabla `games` y resuelven cualquier id nuevo sin cambios.

## 2. Contrato del motor (`engine.ts`)

Plantilla lista para copiar: `assets/engine.ts.tpl`.

```ts
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
  destroy: () => void; // cancela requestAnimationFrame y quita los listeners
}
export function createX(canvas: HTMLCanvasElement, events: GameEvents): GameEngine;
```

Reglas, con su motivo:

- **Sin React ni DOM global.** Recibe el canvas por parámetro y no usa `document.getElementById`. El motor se prueba en Node con un canvas simulado (`scripts/engine-smoke.mjs`) y el componente puede montarlo dos veces.
- **Estado de cierre, no de módulo.** Las variables viven dentro de `createX`. Con globales, el doble montaje de Strict Mode y volver a la página mezclan partidas.
- **`window` solo para registrar y quitar `keydown`/`keyup`.** `destroy()` los quita y cancela el frame; si no, cada visita suma un bucle más.
- **Sin HUD ni "GAME OVER" dibujados.** La plataforma ya muestra Jugador, Puntuación, Vidas y Nivel y el modal de fin. Duplicarlos se ve mal y confunde (se descartó el "doble HUD" de la primera versión de la SPEC 05). Lo propio del juego (p. ej. el temporizador de un power-up) sí puede dibujarse.
- **Callbacks solo cuando el valor cambia**, y `onGameOver(score)` una sola vez y **después** de notificar vidas, para que el modal abra con el HUD ya a 0.
- **Pausa = dejar de llamar a `update()`, seguir dibujando.** Al pausar y reanudar se limpian las teclas y `lastTime`, o un ESPACIO acumulado dispara al reanudar y el `dt` salta.
- **`dt` limitado a 50 ms.** Al volver a la pestaña no acumula segundos de movimiento.
- **Ignorar teclas cuyo destino es un campo de texto.** El modal tiene un `<input>` para el nombre; teclear no debe mover la nave.
- **Tras el game over la lógica no avanza** y ya no hay reinicio con una tecla del juego: reinicia JUGAR DE NUEVO (`restart()`), una sola vía.
- **Puntuación mayor = mejor.** El leaderboard ordena por `score` descendente; un juego donde menos es mejor necesita otra spec.

## 3. Contrato del componente (`<id>-game.tsx`)

Plantilla: `assets/game-component.tsx.tpl`. Props comunes (`GameProps`):

```ts
interface GameProps extends GameEvents {
  paused: boolean;
  over: boolean; // true = partida terminada (FIN o game over)
  runId: number; // cambia en cada JUGAR DE NUEVO
}
```

Cuatro efectos, **en este orden**: (1) refs con los últimos callbacks, (2) crear/destruir el motor al montar, (3) reiniciar cuando cambia `runId` (sin reiniciar en el primer montaje), (4) pausar o reanudar según `paused || over`. Un quinto efecto añade `preventDefault` a flechas y ESPACIO mientras la partida está activa y el foco no está en un campo de texto: sin él la página hace scroll y ESPACIO activa el botón PAUSA enfocado. Se hace en `keydown` **y** `keyup`, porque el navegador activa el botón al soltar la tecla.

Los callbacks van por `ref` para que el motor no se recree cuando el padre re-renderiza. El canvas lleva `position: absolute; inset: 0; width/height: 100%; object-fit: contain`: llena el `.crt-screen` (4:3) y, si el canvas del juego no es 4:3, se centra con barras negras en lugar de deformarse.

## 4. Reproductor y registro de juegos

`game-player.tsx` aporta el HUD, PAUSA, FIN, SALIR, el modal de fin y el guardado. Decide qué juego monta con el registro (`juegoReal(game.id)` y `COMPONENTES[game.id]`), así que un juego nuevo solo añade una línea en `catalog.ts` y otra en `components.tsx`. **El registro lo creó la SPEC 07**; si en el repo no existe `catalog.ts`, la spec del juego debe incluir su creación (paso 1 de la variante A del esqueleto). Los campos `hud.vidas` y `hud.nivel` ocultan en el HUD lo que el juego no usa.

Registro recomendado (dos archivos, porque uno debe poder importarse desde servidor y el otro no):

```ts
// app/games/types.ts — GameEvents, GameEngine, GameProps (secciones 2 y 3)

// app/games/catalog.ts — datos puros, seguro de importar desde Server Components
export interface JuegoReal {
  hud: { vidas: boolean; nivel: boolean }; // oculta los campos que el juego no usa
}
export const JUEGOS_REALES: Record<string, JuegoReal> = {
  asteroides: { hud: { vidas: true, nivel: true } },
};
export const esJuegoReal = (id: string) => id in JUEGOS_REALES;

// app/games/components.tsx — "use client": id -> componente, con carga diferida
import dynamic from "next/dynamic";
export const COMPONENTES: Record<string, ComponentType<GameProps>> = {
  asteroides: dynamic(() => import("../components/asteroides-game").then((m) => m.AsteroidesGame)),
};
```

Por qué dos archivos: un módulo `"use client"` importado desde un Server Component llega como referencia de cliente, no como función, así que `esJuegoReal(id)` solo funciona en servidor si vive en un módulo sin la directiva. `tieneRankingReal` de `data.ts` pasa a ser `esJuegoReal` (o lo reexporta).

Alta de un juego en el registro: añadir su entrada en `JUEGOS_REALES` (con su `hud`) y su componente en `COMPONENTES`, con `next/dynamic`. Nada más. (El registro se creó en la SPEC 07 migrando ASTEROIDES sin cambiar su comportamiento; si alguna vez hay que recrearlo, la variante A del esqueleto de spec lleva el paso.)

### Flujo del reproductor que no hay que romper

- **`finish()`** (lo llaman FIN y `onGameOver`): en juegos reales rellena el nombre desde `localStorage["av_player_name"]` si el jugador no ha escrito uno, y abre el modal. Se hace aquí y no al renderizar para no provocar un desajuste de hidratación en el HUD.
- **`save()`**: un `ref` (`savingRef`) bloquea envíos repetidos aunque lleguen antes de que React vuelva a renderizar (el estado `saving` no basta: tres clics en el mismo instante lo ven igual y se insertaron 3 filas). Si el nombre está vacío no envía. Guarda el nombre en `av_player_name`, inserta `{ game_id, player_name, score, user_id: null }` en `scores` con el cliente de navegador, y solo si tiene éxito llama a `saveScore` (`localStorage["av_scores"]`) y muestra "PUNTUACIÓN GUARDADA". Si falla: `savingRef = false`, aviso "No se pudo guardar la puntuación. Inténtalo de nuevo." y reintento posible.
- **JUGAR DE NUEVO** resetea puntuación, vidas, nivel, `saved`, `saveError`, `savingRef` e incrementa `runId`. Está deshabilitado mientras se envía una puntuación.
- Los botones deshabilitados usan `.btn:disabled` (ya existe en `globals.css`).

## 5. Supabase

### Ficha (migración del juego)

```sql
-- SPEC NN: ficha de <TITULO>
insert into public.games (id, title, short, long, cat, cover, color) values (
  '<id>', '<TITULO>', '<frase corta>', '<descripción larga>',
  '<ARCADE|PUZZLE|SHOOTER|VERSUS>', 'cover-<id>', '<cyan|magenta|yellow|green>'
);
```

- Archivo en `supabase/migrations/<AAAAMMDDHHMMSS>_game_<id>.sql` y se aplica con `apply_migration`. **Escribe en la base real: pide confirmación al usuario antes.** Supabase registra su propio timestamp, que puede no coincidir con el del nombre del archivo; el SQL es el mismo.
- Las comprobaciones `check` de `cat` y `color` rechazan valores fuera de las listas.
- `id` en minúsculas y con guiones, en español como el resto del catálogo (`asteroides`, no `asteroids`), y sin erratas: es parte de la URL (`/juegos/<id>`, `/jugar/<id>`).
- `best` y `plays` **no son columnas**: `queries.ts` los calcula (máximo y número de filas de `scores`). No se siembran cifras inventadas; un juego nuevo arranca en 0.
- Los tipos generados solo cambian si cambia el esquema. Un juego nuevo no lo cambia: no hay que regenerarlos.

### Portada

Clase `.cover-<id>` en `app/globals.css`, junto a las otras `.cover-*`. Se ve en una tarjeta 4:3. **Usa `/frontend-design`** (lo exige `CLAUDE.md`). La de ASTEROIDES es un SVG vectorial en `::after` (viewBox 400×300) sobre un fondo con halo; sigue esa idea: dibujar algo del propio juego, no reutilizar la portada de otro (dos tarjetas con la misma portada se confunden). Comprueba la captura de la tarjeta.

### Lectura y escritura (no se tocan)

`lib/supabase/queries.ts` (servidor: `getCatalogo`, `getJuego`, `getTopScores`) y `scores.ts` (`leerTopScores`, compartido con el navegador). La política RLS de `scores` acepta `INSERT` con `user_id is null`, `SELECT` público y deniega `UPDATE`/`DELETE`.

## 6. Páginas

`/juegos/[id]` y `/jugar/[id]` ya resuelven cualquier id con `getJuego`. El patrón que **no** hay que alterar:

```tsx
export default function Page({ params }: PageProps<"/juegos/[id]">) {
  return (
    <Suspense fallback={<Cargando />}>
      <Detalle params={params} />
    </Suspense>
  );
}
async function Detalle({ params }: { params: PageProps<"/juegos/[id]">["params"] }) {
  const { id } = await params; // dentro del Suspense
  const game = await getJuego(id);
  if (!game) notFound();
  // ...
}
```

`/biblioteca` y `/salon` obtienen el catálogo con `getCatalogo()` dentro de `<Suspense>` y lo pasan por prop. La pestaña real del Salón lee el top 12 con el cliente de navegador. Un juego nuevo aparece en todas sin editarlas.

## 7. Trampas (y por qué importan)

1. **Crear el cliente de Supabase fuera del `try/catch`** en `queries.ts`. `createClient()` llama a `cookies()`, y durante el prerender su rechazo es la señal con la que Next marca la ruta como dinámica; si se captura, se hornean datos locales en una página estática.
2. **No usar `export const instant = false` para conseguir un 404.** Solo daba 404 en desarrollo; en producción `notFound()` responde **HTTP 200** con la pantalla "JUEGO NO ENCONTRADO" y `noindex`, porque el layout (con `Nav`) ya inició el streaming. El criterio de aceptación se redacta como "muestra la pantalla 404", no como código HTTP. Un 404 real exigiría un `proxy.ts` que consulte Supabase (fuera de alcance).
3. **`await params` dentro del hijo de `<Suspense>`.** Fuera, la consola de desarrollo muestra un error de Cache Components en cada navegación.
4. **Strict Mode monta el efecto dos veces en desarrollo.** Sin `destroy()` correcto, el juego va al doble de velocidad.
5. **Probar siempre con clics sincrónicos repetidos**, no solo con un clic: el guard por estado de React no los detecta (sección 4, `save()`).
6. **Podio con menos de 3 filas** y **estado vacío** en el Salón: usar `rows[i]?.…` y "—". La fila "TU MEJOR MARCA" se calcula con datos inventados, así que no se muestra en juegos con ranking real. En listas, usar `rank` como `key` (un mismo jugador puede repetirse).
7. **Un fallo de Supabase no es un ranking vacío.** El Salón muestra un aviso distinto; en el detalle, `getTopScores` devuelve `[]` y registra el error en el servidor.
8. **El hook de Prettier reformatea el archivo tras cada `Write`/`Edit`.** Antes de un segundo `Edit` en el mismo archivo, vuelve a leerlo: el texto exacto cambia y el `old_string` deja de coincidir.
9. **El puerto 3000 puede estar ocupado por otra aplicación** (aquí redirigía a `/login`). Arranca el servidor de este proyecto con `npx next dev -p 3100` y comprueba que `/biblioteca` responde con el contenido esperado.
10. **No contar texto en el HTML con `grep`.** La plantilla de la pantalla 404 va incrustada en los datos de React de todas las páginas, así que "JUEGO NO ENCONTRADO" aparece también en las válidas. Comprueba en el navegador (`document.body.innerText`) o con `DOMParser`.
11. **En Git Bash, `/` como primer argumento se convierte en una ruta de Windows.** Cita o evita probar `/` con `curl` en un bucle de rutas.
12. **Los datos de prueba se borran siempre** (por nombre de jugador reconocible, con el MCP `execute_sql`) y se confirma que `scores` queda sin filas de prueba. Una spec que deja basura en un ranking real es peor que una sin pruebas.
13. **Cualquier escritura en la base real pide confirmación** (migraciones y `INSERT` de prueba incluidos).
14. **Ninguna clave en archivos versionados.** Se usa la publishable de `.env.local`; nunca `service_role`. Los scripts leen `.env.local` y no imprimen la clave.
15. **Un juego puede reemplazar a un placeholder con su mismo id** (así se hizo con `caida`): la fila de Supabase gana si coincide el id, y se **conserva** la entrada local en `app/data.ts` si el Home la usa (`GAMES.slice(0, 6)`) o como respaldo si Supabase cae. Hasta que el juego se da de alta en el registro, el detalle mezcla `best` y `plays` reales (0) con el ranking ficticio: es un estado intermedio esperado.
16. **`esJuegoReal` usa `Object.hasOwn`, no `in`.** Con `in`, un id como `constructor` coincide con `Object.prototype`.
17. **No todos los juegos usan la entrada de "pulsación única" de la plantilla.** Un juego que actúa en cada evento `keydown`, incluida la auto-repetición (Tetris), registra solo `keydown` y ejecuta la acción dentro del manejador; `engine-smoke.mjs` acepta un motor sin `keyup`. Tras un cambio de estado hecho en un manejador de teclado, `emitChanges()` lo notifica en el siguiente fotograma.
18. **Un archivo creado con `sed` o desde la terminal no pasa por el hook de Prettier y ESLint** (solo actúa con `Write` y `Edit`). Ejecuta `prettier --write` y `eslint` a mano sobre él.
19. **Una pieza que no puede bajar y recibe "bajar" se fija sin sumar puntos** en Tetris (es la regla del original): cinco pulsaciones de ↓ pueden dar 4. No es un fallo del motor; el criterio de puntuación debe decirlo.

## 8. Verificación

Scripts del skill (se ejecutan desde la raíz del proyecto):

- `node .claude/skills/add-game/scripts/engine-smoke.mjs app/games/<id>/engine.ts create<Id>`: compila el motor con el `tsc` del proyecto, lo ejecuta con un canvas simulado y comprueba notificaciones iniciales, pausa, reinicio y limpieza de listeners.
- `node --expose-gc .claude/skills/add-game/scripts/engine-perf.mjs app/games/<id>/engine.ts create<Id> --trace`: banco de rendimiento con canvas que cuenta llamadas, `Math.random` con semilla y entrada fija; mide bucles de `requestAnimationFrame`, llamadas al contexto, glow, fuentes, heap y fugas tras `restart()`/`destroy()`. El hash de `--trace` resume la jugabilidad y no debe cambiar al optimizar. Lo usa el agente `game-performance-booster`.
- `node .claude/skills/add-game/scripts/rls-check.mjs <id>`: con la clave publishable comprueba que el `INSERT` válido pasa, los inválidos se rechazan y `UPDATE`/`DELETE` no afectan a ninguna fila. Deja una fila `RLSTEST` que hay que borrar (`delete from public.scores where player_name = 'RLSTEST'`).

Prueba de comportamiento del motor (sin navegador): fija `Math.random` para saber qué pieza o evento sale y compila el motor con `tsc` como hace `engine-smoke.mjs`. Con eso se comprueban las reglas con números exactos (por ejemplo, en Tetris, con solo piezas I: la caída instantánea suma 36, limpiar una línea suma 100 × nivel y 19 caídas apiladas acaban la partida con 342). Con aleatorio fijo, el orden de las piezas es el de las llamadas a `Math.random`: la primera es la pieza actual y la segunda la siguiente. Escríbela fuera del repo (en el directorio temporal).

En el navegador (Playwright), con `browser_evaluate`:

- **Jugar:** disparar `KeyboardEvent` en `window` (`code: "Space"`, `"ArrowLeft"`...) en un bucle con `sleep(40)` y leer `.hud-stat` antes y después.
- **Fallo de red al guardar:** sustituir `window.fetch` por una función que rechace las URL con `/rest/v1/scores`, pulsar GUARDAR y comprobar aviso y botón reintentable; restaurar `fetch` y reintentar.
- **Un solo `INSERT`:** pulsar GUARDAR 3 veces seguidas (`b.click(); b.click(); b.click();`) y contar filas con `select … from public.scores`.
- **Pruebas de degradación:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=invalida npm run build` y `npx next start -p 3200` con la misma variable; `/biblioteca` debe responder 200 con los juegos locales. Después, parar solo ese proceso y reconstruir con la clave real.
- **Lecturas reales:** `query_logs` con `select timestamp, log_attributes['request.path'] ... from logs where source = 'edge_logs'` muestra los `GET /rest/v1/games` y `/scores`.
- Al final: `npm run lint`, `npm run build` (sin trazas de error), `get_advisors` de seguridad sin avisos y `select count(*) from public.scores` en 0 si todo era de prueba.
