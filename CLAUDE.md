# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arcade Vault: a platform to play games online and compete for the highest score (README is in Spanish; UI copy and specs are in Spanish). The app has a retro-neon UI (Home, Biblioteca, Detalle, Reproductor, Salón de la Fama, Auth), five playable games with real engines and Supabase-backed leaderboards, and placeholders for the rest. The README says the project follows Spec Driven Design (`/spec` and `/spec-impl`) using the skills from `Klerith/fernando-skills` (`npx skills@latest add Klerith/fernando-skills`).

## Commands

- `npm run dev` — dev server
- `npm run build` / `npm start` — production build / serve
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`)
- `npm run format` — Prettier over the whole repo (config in `.prettierrc.json`, ignores in `.prettierignore`)
- No test runner is configured yet. Engines are verified with `.claude/skills/add-game/scripts/engine-smoke.mjs` and RLS with `rls-check.mjs` (see the `add-game` skill). Engine performance is measured with `node --expose-gc .claude/skills/add-game/scripts/engine-perf.mjs app/games/<id>/engine.ts create<Id> [--trace] [--opts '{"skin":"neon","modo":"oscuro"}']` (rAF loops, canvas calls per frame, glow, heap, leaks after `restart()`/`destroy()`; `--trace` prints a gameplay hash that must not change when optimizing).

A project hook (`.claude/settings.json` → `.claude/hooks/format-and-lint.mjs`) runs Prettier on every file Claude writes/edits (PostToolUse `Write|Edit`), plus `eslint --fix` for JS/TS files. Unfixable ESLint errors come back to Claude (exit 2) so they get corrected.

## Next.js version caveat

This is Next.js 16.4.2 with React 19.3, which differs from older Next.js APIs. `AGENTS.md` requires reading the relevant guide in `node_modules/next/dist/docs/` (`01-app`, `02-pages`, `03-architecture`, `04-community`) before writing Next.js code, and heeding deprecation notices. `next dev` rewrites the AGENTS.md block, so don't strip it.

## Workflow: Spec Driven Design

Every feature starts as a spec in `specs/NN-nombre.md` (status line `Aprobado`, `Depende de`, `Objetivo`), written with `/spec` and implemented with `/spec-impl`. Read the existing specs for format and context before writing a new one. Current specs:

- 01 MVP de pantallas visuales · 02 pestaña Home · 03 integración Supabase
- 04/05 juego ASTEROIDES · 06 tablas `games`/`scores` + leaderboard real
- 07 CAÍDA (Tetris) · 08 BLOQUE BUSTER (Arkanoid) · 09 SERPENTINA (Snake)
- 16 controles táctiles / móvil · 17 apariencia neon del gamepad

Game-jam specs live apart, one folder per game with its own numbering: `specs/game-jam/<id>/` — `inversor` (10–12), `bombardero` (13–15), `frogger` (01, game id `ranaria`), `sonar` (18–20), `enjambre` (21–23).

Branches are named after the spec (e.g. `spec-09-juego-serpentina`, `spec-01-frogger-core`); `specs/.spec-config.yml` (`AutoCreateBranch: true`) lets `/spec-impl` create them. The repo has no commits yet; everything is untracked.

## Skills

- Usa siempre `/frontend-design` para hacer interfaces de usuario.
- `/add-game` (`.claude/skills/add-game/`): add, port or create a game with its Supabase row, cover and leaderboard. It **produces a spec, not code**. Recipe in `references/pattern.md`, `porting.md`, `spec-template.md`, plus `assets/*.tpl` and verification `scripts/`. If the repo and `pattern.md` disagree, the repo wins; flag the stale recipe.
- `/spec-imp-game <NN-spec>` (`.claude/skills/spec-imp-game/`, manual only): runs `/spec-impl` on a game spec, then `skin-designer` and `mobile-porte` (`reproductor`) one after the other.
- `/spec` and `/spec-impl` come from `Klerith/fernando-skills` (user-level, `~/.claude/skills/`).

## Agents

Project subagents in `.claude/agents/`. Each works on **one item at a time, only the one named** (asks if none is given) and has persistent memory in `.claude/agent-memory/<agent>/`. Read the definition file for details.

| Agent                      | What it does                                                                                                                                                                                   | Definition                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `game-planner`             | Recommends which game to add next; hands off to `/add-game`. Never writes code or specs. Keeps `references/game-suggestions-todo.md` (tell it when a suggestion gets a spec or ships).         | `.claude/agents/game-planner.md`             |
| `skin-designer`            | Applies skins (`clasico`/`neon`/`retro` × light/dark) to one game. Registry: `references/game-with-themes.md`.                                                                                 | `.claude/agents/skin-designer.md`            |
| `mobile-porte`             | Fixes the mobile view of one screen (`home`, `biblioteca`, `detalle`, `reproductor`, `salon`, `auth`) following SPEC 16. Never touches engines or Supabase.                                    | `.claude/agents/mobile-porte.md`             |
| `game-jam`                 | Turns a jam theme into 2–3 `Borrador` specs in `specs/game-jam/<id>/` (specs only). Also runs Mon–Fri 2:00 via scheduled task `ArcadeVault-GameJam` (`.claude/scripts/game-jam-nocturno.ps1`). | `.claude/agents/game-jam.md`                 |
| `game-performance-booster` | Measures and optimizes one game's performance without changing gameplay (`--trace` hash must match). Registry: `references/game-performance.md`. On demand only.                               | `.claude/agents/game-performance-booster.md` |

## MCP

`.mcp.json` registers the Supabase MCP server (project ref `negkbokeejfirkvprzhc`), enabled in `.claude/settings.local.json`. Use it for read-only inspection (`list_tables`, `execute_sql` selects), advisors and migrations. The Playwright MCP is also used to verify UI in the browser.

## Architecture notes

- App Router only (`app/`). Path alias `@/*` maps to the repo root.
- `next.config.ts` enables `cacheComponents` and `partialPrefetching`, plus `experimental.agentFeedback`. With Cache Components, dynamic/uncached data access has specific rules: pages that read Supabase wrap the async part in `<Suspense>` (see `app/jugar/[id]/page.tsx`, `app/salon/page.tsx`). Check the docs before fetching data in components.
- Tailwind CSS v4 is wired through Turbopack: the `*.css` rule in `next.config.ts` uses the `@tailwindcss/turbopack` loader, and styles start from `@import "tailwindcss"` in `app/globals.css`. There is no `tailwind.config` or PostCSS config. The neon theme (CSS variables, `.pixel`, `.mono`, `neon-*`, `fade-in`, `blink`) lives in `app/globals.css`, ported from `references/templates/`.
- Layouts use the globally generated `LayoutProps<"/">` / `PageProps<"/route/[id]">` types instead of hand-written props types. Fonts are Press Start 2P, JetBrains Mono and Courier Prime via `next/font/google`.
- TypeScript is `strict`.

### Routes (`app/`)

`/` Home (`components/home/`), `/biblioteca`, `/juegos/[id]` (detalle), `/jugar/[id]` (reproductor), `/salon` (Hall of Fame), `/auth`, plus `not-found.tsx` and `api/supabase-health` (temporary connection check from SPEC 03). `references/templates/` holds the original HTML/JSX design prototype the UI was ported from.

### Games

- Only the games listed in `app/games/catalog.ts` (`JUEGOS_REALES`) have a real engine: `asteroides`, `caida` (Tetris), `bloque-buster` (Arkanoid), `serpentina` (Snake) and `ranaria` (Frogger, no touch gamepad yet). `references/implemented-games.md` is the human-readable list. The placeholders in `app/data.ts` (`gloton`, `invasores`, `rocas`, `duelo-pixel`) use a fake player.
- Contract in `app/games/types.ts`: `GameEvents` (`onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`), `GameEngine` (`pause`, `resume`, `restart`, `destroy`) and `GameProps` (events + `paused`, `over`, `runId`).
- Each game = framework-free engine `app/games/<id>/engine.ts` (+ `sprites.ts`, `levels.ts` when needed) + canvas component `app/components/<id>-game.tsx`. Assets go in `public/games/<id>/`.
- Adding a game registers **one line each** in `catalog.ts` (with its `hud: { vidas, nivel }` flags) and `components.tsx` (`COMPONENTES`, lazy via `next/dynamic`). Do not touch `game-player.tsx`, `hall-of-fame.tsx` or the pages. `catalog.ts` is pure data (no `"use client"`) so Server Components can import it.
- Touch controls (SPEC 16): `JuegoReal.controles?: BotonTactil[]` in `catalog.ts` declares the on-screen gamepad of a game. Each button is `{ code, etiqueta, aria, modo, zona }`, where `code` is the `KeyboardEvent.code` the engine already reads. `app/components/touch-controls.tsx` turns touches into synthetic `keydown`/`keyup` on `window`, so engines do not change. `modo`: `mantener` (keydown on touch, keyup on release; the engine reads key state per frame), `repetir` (keydown, then 220 ms wait and every 90 ms; for engines that act on each `keydown`), `pulso` (one keydown+keyup per touch; for engines that queue one action per `keydown`). `zona` is `izquierda`/`derecha`. Without `controles` there is no gamepad (keyboard only). `game-player.tsx` renders it under the CRT, enabled only while `!paused && !over`; CSS shows it only with `(pointer: coarse)` and hides the navbar on that screen. Do not make an engine check `e.isTrusted`: it would reject these events. Look (SPEC 17, neon gamepad MK-II, fixed regardless of skin/theme): `touch-controls.tsx` splits the buttons into a **D-pad** (`code` is an `Arrow*` key **and** `etiqueta` is a single character, e.g. `◀`) on the left and **round action buttons** (any other, e.g. `▲ IMPULSO`, `DISPARO`) on the right; `zona` no longer decides placement. A game whose action button is a one-character arrow label would land in the D-pad. Buttons also light up with the physical key of the same `code` (`data-tecla`).
- `game-player.tsx` owns the HUD, pause, game-over modal and score saving; real games save to Supabase (player name remembered in `localStorage` key `av_player_name`), placeholders save through the session provider.

### Supabase

- Integrated through `@supabase/supabase-js` + `@supabase/ssr`. Clients in `lib/supabase/`: `client.ts` (browser), `server.ts` (server, one client per request), `database.types.ts` (generated types), `scores.ts` (`leerTopScores`, shared by server and browser), `queries.ts` (server reads: `getCatalogo`, `getJuego`, ...).
- Env vars in `.env.local` (templates: `.env.example`, `env.template`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (and `SUPABASE_DB_PASSWORD` in `.env.example`). Only the publishable key is used; security relies on RLS.
- Schema (migrations in `supabase/migrations/`, one per game after the base): `games` (id, title, short, long, cat, cover, color) and `scores` (game_id → games, player_name 1–10 chars, score ≥ 0, `user_id`). RLS: public SELECT on both; INSERT on `scores` only anonymous (`user_id is null`); no UPDATE/DELETE.
- The catalog is hybrid: `queries.ts` merges local `GAMES` (`app/data.ts`) with the `games` table, and **the Supabase row wins** on id collision; if Supabase fails it logs and falls back to local data. Games stay in `app/data.ts` too because the Home reads `GAMES.slice(0, 6)`. `best` and `plays` come from `scores`. Ranking order: score desc, then `created_at` asc.
- Auth is Supabase Auth (SPEC 24): email + password (email confirmation required) and Google/GitHub OAuth. The player name lives in `user_metadata.username` (trim + uppercase, 1–10 chars, not unique); OAuth users pick it at `/auth/nombre`. Email links use `token_hash` → `app/auth/confirm/route.ts` (`verifyOtp`); OAuth returns to `app/auth/callback/route.ts` (`exchangeCodeForSession`). Password reset: `/auth/recuperar` → email → `/auth/nueva-contrasena`. `/cuenta` (`account-panel.tsx`) shows email/provider, renames, changes the password (email accounts) and signs out. Shared messages and validation in `lib/auth.ts`. Dashboard config (providers, redirect URLs, email templates) is manual; see the spec.
- `proxy.ts` (root) refreshes the session on every request (`auth.getUser()`), redirects `/cuenta` and `/auth/nombre` without session to `/auth?next=…`, sends users without `username` to `/auth/nombre`, and `/auth` with a full session to `/cuenta`. Its `matcher` skips `_next/*`, `games/` and images.
- `app/components/session-provider.tsx` reads the real user (`Usuario { id, name, email, provider }`, `cargando`, `signOut`, `refrescar`); there is no `login` nor `av_user` any more. `av_scores`/`saveScore` stay in `localStorage` for the placeholders.
- Scores with a session: `game-player.tsx` prefills the modal with the username (editable) and inserts `user_id = auth.uid()`, allowed by policy `scores_insert_authenticated`; the anonymous policy (`user_id is null`) stays. Renaming in `/cuenta` calls the `security definer` RPC `renombrar_scores(anterior, nuevo)`, which only updates the caller's rows with the old name (there is still no UPDATE/DELETE policy). The advisor warning 0029 for that function is expected.
