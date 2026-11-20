# SPEC 06 — ASTEROIDES y su leaderboard en Supabase

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 03, SPEC 05
> **Fecha:** 2026-11-05
> **Objetivo:** Guardar el juego ASTEROIDES en una tabla `games` de Supabase y sus puntuaciones en una tabla `scores`, y mostrar el leaderboard real en el detalle del juego y en el Salón de la Fama, manteniendo los otros 8 juegos como datos locales.

## Por qué existe esta spec

SPEC 03 dejó Supabase conectado sin tablas y SPEC 05 añadió ASTEROIDES, el primer juego real. Hasta ahora sus puntuaciones se guardan solo en `localStorage` (`av_scores`) y el ranking es ficticio (`seededScores`). Esta spec crea el esquema, lo protege con RLS y conecta la interfaz.

El catálogo queda **híbrido**: ASTEROIDES viene de Supabase y los otros 8 juegos siguen en `app/data.ts` con sus puntuaciones ficticias, porque aún no son jugables. Así no se pierde nada del Home, la Biblioteca ni el Salón.

Esta spec corrige una versión anterior que apuntaba a archivos y rutas que no existen en el proyecto (`app/data/games.ts`, `/games`, `/hall-of-fame`, `app/games/asteroids/play/page.tsx`), usaba el id `asteroids` y borraba los otros 8 juegos de la interfaz.

## Alcance

**Dentro:**

- Migración SQL versionada en `supabase/migrations/` que crea las tablas `games` y `scores`, activa RLS con políticas mínimas y siembra la fila `asteroides`.
- Aplicar la migración al proyecto Supabase con el MCP (`apply_migration`), con confirmación previa del usuario.
- Tipos generados de la base en `lib/supabase/database.types.ts`, usados como genérico en `lib/supabase/client.ts` y `lib/supabase/server.ts`.
- Capa de lectura en `lib/supabase/queries.ts` (servidor): catálogo combinado, juego por id y top de puntuaciones.
- `/biblioteca`, `/juegos/[id]`, `/jugar/[id]` y `/salon` resuelven ASTEROIDES desde Supabase y los otros 8 juegos desde `app/data.ts`.
- Leaderboard real de ASTEROIDES: top 10 en `/juegos/asteroides` y top 12 en la pestaña de ASTEROIDES de `/salon`, con estado vacío "Sé el primero en entrar al salón de la fama".
- `best` y `plays` de ASTEROIDES calculados desde `scores` (máximo y número de puntuaciones guardadas).
- Guardar la puntuación de ASTEROIDES en Supabase al pulsar GUARDAR PUNTUACIÓN, con el nombre pre-rellenado desde `localStorage["av_player_name"]`.
- Eliminar la entrada `asteroides` de `GAMES` en `app/data.ts`.

**Fuera de alcance (specs futuras):**

- Migrar a Supabase los 8 juegos placeholder o sus puntuaciones.
- Supabase Auth: `user_id` se guarda siempre como `null` y no lleva FK.
- Panel de administración: `games` es de solo lectura desde la app.
- Columnas `best` y `plays` en `games` o su actualización automática.
- Realtime: los rankings se ven al cargar la página o al cambiar de pestaña.
- Paginación: top 10 y top 12 fijos.
- Validación de puntuaciones en servidor o Edge Functions contra trampas.
- Datos reales en el Home ("Actividad en vivo", "Top de hoy"): siguen ficticios.
- Quitar `av_scores` de `localStorage` o la sesión simulada (`av_user`).

## Modelo de datos

Migración `supabase/migrations/<timestamp>_games_and_scores.sql`:

```sql
create table public.games (
  id         text primary key,
  title      text not null,
  short      text not null,
  long       text not null,
  cat        text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS')),
  cover      text not null,
  color      text not null check (color in ('cyan','magenta','yellow','green')),
  created_at timestamptz not null default now()
);

create table public.scores (
  id          uuid primary key default gen_random_uuid(),
  game_id     text not null references public.games (id),
  player_name text not null check (char_length(player_name) between 1 and 10),
  score       integer not null check (score >= 0),
  user_id     uuid,
  created_at  timestamptz not null default now()
);

create index scores_game_score_idx on public.scores (game_id, score desc);

alter table public.games  enable row level security;
alter table public.scores enable row level security;

create policy "games_select_public"  on public.games  for select using (true);
create policy "scores_select_public" on public.scores for select using (true);
create policy "scores_insert_public" on public.scores for insert
  with check (user_id is null);
-- Sin políticas de UPDATE ni DELETE: quedan denegados.

insert into public.games (id, title, short, long, cat, cover, color) values (
  'asteroides', 'ASTEROIDES', 'Pulveriza rocas en gravedad cero.',
  'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Supera niveles y acumula puntos antes de que los asteroides te alcancen.',
  'SHOOTER', 'cover-asteroides', 'cyan'
);
```

Las comprobaciones de `check` y la FK de `game_id` impiden nombres vacíos o largos, puntuaciones negativas y juegos inexistentes. La política de INSERT exige `user_id is null` mientras no exista Auth.

Funciones de `lib/supabase/queries.ts` (servidor, tipos de `app/data.ts` y `database.types.ts`):

```ts
getCatalogo(): Promise<Juego[]>            // GAMES locales + juegos de Supabase; el de Supabase gana si coincide el id
getJuego(id: string): Promise<Juego | undefined>
getTopScores(gameId: string, limit: number): Promise<Puntuacion[]>
```

Un juego de Supabase se convierte a `Juego` con `best = MAX(score)` y `plays = String(COUNT(*))` (0 si no hay puntuaciones). Si Supabase falla, las funciones devuelven solo los juegos locales y registran el error.

Persistencia en el navegador (se añade a SPEC 01):

```ts
// localStorage
"av_player_name"; // string: último nombre usado en el leaderboard, distinto de av_user
```

## Plan de implementación

Antes de empezar, leer en `node_modules/next/dist/docs/` las guías de Cache Components (acceso a datos dinámicos dentro de `<Suspense>`) y de `generateStaticParams`, según exige `AGENTS.md`. Consultar la documentación de RLS de Supabase (por ejemplo con el MCP `search_docs`).

1. **Esquema.** Crear `supabase/migrations/<timestamp>_games_and_scores.sql` con el SQL del modelo de datos. Pedir confirmación al usuario antes de aplicarla con `apply_migration`, porque escribe en la base real. Verificar con `list_tables` (dos tablas con RLS activo), una consulta a `games` (fila `asteroides`) y `get_advisors` de seguridad sin avisos de RLS.
2. **Tipos.** Generar los tipos con `generate_typescript_types` en `lib/supabase/database.types.ts` y añadir `<Database>` como genérico en `createBrowserClient` y `createServerClient`. Verificar con `npx tsc --noEmit`; `/api/supabase-health` sigue respondiendo 200.
3. **Capa de lectura.** Crear `lib/supabase/queries.ts` con `getCatalogo`, `getJuego` y `getTopScores`. Verificar con `npx tsc --noEmit` y `npx eslint lib`. La interfaz aún no cambia.
4. **Biblioteca.** `app/biblioteca/page.tsx` obtiene `getCatalogo()` dentro de `<Suspense>` y pasa `games` como prop a `Library`, que deja de importar `GAMES`. Verificar: `/biblioteca` muestra 9 tarjetas y la de ASTEROIDES sale de Supabase.
5. **Detalle.** `app/juegos/[id]/page.tsx` resuelve el juego con `getJuego`. Para ASTEROIDES muestra `getTopScores(id, 10)` con estado vacío; para los demás sigue con `seededScores`. Un id inexistente llama a `notFound()`. Verificar: `/juegos/asteroides` y `/juegos/caida` cargan, `/juegos/no-existe` da 404.
6. **Reproductor.** `app/jugar/[id]/page.tsx` resuelve el juego con `getJuego`. Verificar: `/jugar/asteroides` sigue jugándose y `/jugar/no-existe` da 404.
7. **Salón de la Fama.** `app/salon/page.tsx` obtiene el catálogo y lo pasa por prop a `HallOfFame`, que deja de importar `GAMES`. En la pestaña de ASTEROIDES lee el top 12 con el cliente de navegador (`lib/supabase/client.ts`) y muestra el estado vacío si no hay filas; las demás pestañas siguen con `seededScores`. Verificar: `/salon` muestra las 9 pestañas y cambiar de pestaña actualiza los datos.
8. **Guardar puntuación.** En `app/components/game-player.tsx`, para ASTEROIDES: al abrir el modal, pre-rellenar el nombre desde `av_player_name`; al pulsar GUARDAR PUNTUACIÓN, guardar el nombre en `av_player_name`, insertar `{ game_id, player_name, score, user_id: null }` en `scores` con el cliente de navegador y mostrar "PUNTUACIÓN GUARDADA" solo si el insert tuvo éxito. Mientras se envía el botón queda deshabilitado; si falla, se muestra un error y se permite reintentar. `saveScore` de `localStorage` se sigue llamando como hasta ahora. Verificar: tras una partida, la puntuación aparece en `/juegos/asteroides` y en `/salon`.
9. **Limpieza.** Borrar la entrada `asteroides` de `GAMES` en `app/data.ts`. Verificar que Biblioteca, detalle, reproductor y Salón siguen mostrando ASTEROIDES.
10. **Cierre.** Ejecutar `npm run lint` y `npm run build`, y jugar una partida completa hasta verla en el ranking.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] Existen las tablas `games` y `scores` en `public`, ambas con RLS activo.
- [ ] La tabla `games` tiene una sola fila, `asteroides`, con `cover-asteroides` y color `cyan`.
- [ ] `supabase/migrations/` contiene la migración y `lib/supabase/database.types.ts` los tipos generados.
- [ ] `createClient` de cliente y de servidor usan el genérico `Database`.
- [ ] `get_advisors` de seguridad no reporta tablas sin RLS en `public`.
- [ ] Con la clave publishable, `INSERT` en `scores` con datos válidos tiene éxito.
- [ ] Con la clave publishable, un `INSERT` con `score` negativo, nombre vacío o de más de 10 caracteres, `game_id` inexistente o `user_id` no nulo es rechazado.
- [ ] Con la clave publishable, `UPDATE` y `DELETE` sobre `scores` y `games` no modifican ninguna fila.
- [ ] `/biblioteca` muestra 9 tarjetas y SHOOTER muestra INVASORES, ROCAS y ASTEROIDES.
- [ ] El Home (`/`) sigue mostrando exactamente las mismas 6 mini tarjetas y su actividad ficticia.
- [ ] `/juegos/asteroides` muestra título, descripción larga y ranking desde Supabase; `best` y `plays` coinciden con `scores`.
- [ ] `/juegos/asteroides` sin puntuaciones muestra "Sé el primero en entrar al salón de la fama" y no filas falsas.
- [ ] `/juegos/caida` y los otros 7 juegos locales siguen mostrando su ranking ficticio.
- [ ] `/juegos/no-existe` y `/jugar/no-existe` devuelven 404.
- [ ] `/salon` muestra 9 pestañas; la de ASTEROIDES muestra el top 12 real y las demás datos ficticios.
- [ ] Cambiar a la pestaña de ASTEROIDES con la tabla vacía muestra el estado vacío.
- [ ] Al abrir el modal de fin de partida, el campo de nombre trae `av_player_name` si existe.
- [ ] GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "asteroides"` y `user_id: null`, y guarda el nombre en `av_player_name`.
- [ ] El botón se deshabilita durante el envío y tras el éxito: pulsarlo varias veces seguidas inserta una sola fila.
- [ ] Si el insert falla, el modal muestra un error, no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] La puntuación guardada aparece en `/juegos/asteroides` y en `/salon` al recargar.
- [ ] Con una clave de Supabase inválida, `/biblioteca` sigue respondiendo 200 con los 8 juegos locales.
- [ ] `app/data.ts` no contiene la entrada `asteroides`.
- [ ] Los juegos placeholder (`/jugar/rocas`) siguen mostrando el placeholder con puntuación simulada.

## Decisiones tomadas y descartadas

- **Sí:** catálogo híbrido. ASTEROIDES en Supabase y los otros 8 juegos en `app/data.ts`. Conserva Home, Biblioteca y Salón tal como están.
- **No:** dejar solo ASTEROIDES, como decía la spec anterior. Rompería el Home (6 mini tarjetas, SPEC 02) y los criterios de SPEC 01.
- **No:** migrar los 9 juegos ahora. Los 8 placeholders no son jugables y sus datos son ficticios.
- **Sí:** ranking real solo en ASTEROIDES; los placeholders conservan `seededScores`. Coherente con que solo ASTEROIDES guarda puntuaciones.
- **Sí:** RLS desde el principio, con SELECT público, INSERT público acotado y sin UPDATE ni DELETE. Sin RLS, la clave publishable permitiría borrar o falsear todas las puntuaciones.
- **No:** dejar las tablas abiertas, como decía la spec anterior, que solo hablaba de INSERT y SELECT sin ver que UPDATE y DELETE también quedarían abiertos.
- **Sí:** migración versionada en `supabase/migrations/` aplicada con el MCP. Reproducible y revisable en git.
- **Sí:** tipos generados con `generate_typescript_types`. Evita escribir `GameRow` y `ScoreRow` a mano y que se desincronicen.
- **Sí:** `best` y `plays` calculados desde `scores`, no guardados en `games`. Evita lógica de sincronización.
- **Sí:** `plays` es el número de puntuaciones guardadas. Es una aproximación: no cuenta partidas que el jugador no guardó.
- **Sí:** `user_id` nullable y sin FK. Se añade la FK cuando llegue la spec de Auth.
- **Sí:** `av_player_name` separado de `av_user`. Un jugador puede querer un nombre distinto en el leaderboard y funciona sin sesión.
- **Sí:** el juego de Supabase gana si coincide el id con uno local. Permite quitar `asteroides` de `data.ts` sin cortar la interfaz entre pasos.
- **Sí:** las lecturas de catálogo y detalle se hacen en componentes de servidor dentro de `<Suspense>`, como exige Cache Components. Las lecturas por pestaña del Salón se hacen en cliente.
- **Sí:** `saveScore` de `localStorage` se mantiene. No se rompe nada existente y la migración de `av_scores` queda para otra spec.
- **Sí:** si Supabase falla, la app sigue con los 8 juegos locales y ASTEROIDES no aparece. Es el comportamiento degradado aceptado.
- **No:** Realtime. Con un solo juego activo no aporta valor.
- **No:** validación de puntuaciones en servidor. Una puntuación enviada desde el navegador puede falsearse; se mitiga en una spec futura con Edge Functions.

## Riesgos

| Riesgo                                                                                               | Mitigación                                                                                               |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| La migración escribe en la base real y no se deshace sola                                            | Se pide confirmación antes de aplicarla; para revertir se crea una migración nueva.                      |
| Cualquiera puede insertar puntuaciones falsas desde el navegador                                     | Aceptado: las políticas limitan el formato, no la veracidad. Validación en servidor en una spec futura.  |
| Cache Components exige `<Suspense>` en lecturas dinámicas y rompe el build si falta                  | Leer las guías antes de escribir las páginas y comprobar con `npm run build`.                            |
| `/juegos/[id]` y `/jugar/[id]` usan `generateStaticParams` con `GAMES`, que ya no incluye ASTEROIDES | ASTEROIDES se resuelve en tiempo de petición; las páginas locales siguen prerrenderizadas.               |
| Si Supabase no responde, ASTEROIDES desaparece del catálogo                                          | Las funciones devuelven los juegos locales y registran el error; criterio explícito con clave inválida.  |
| `plays` no refleja las partidas jugadas, solo las guardadas                                          | Aceptado y documentado; se corrige cuando haya un contador de partidas real.                             |
| Los tipos generados quedan desactualizados al cambiar el esquema                                     | Regenerarlos en cada migración nueva.                                                                    |
| Doble envío o fallo de red al guardar la puntuación                                                  | Botón deshabilitado durante el envío, éxito mostrado solo tras confirmar el insert y reintento si falla. |

## Qué **no** está en esta spec

- Migrar los 8 juegos placeholder o sus puntuaciones a Supabase.
- Supabase Auth, FK de `user_id` o perfiles.
- Panel de administración de juegos.
- Realtime, paginación o Edge Functions.
- Validación de puntuaciones contra trampas.
- Datos reales en el Home.
- Quitar `av_scores` o la sesión simulada de `localStorage`.

Cada uno, si llega, va en su propia spec.
