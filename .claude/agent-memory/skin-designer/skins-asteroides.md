---
name: skins-asteroides
description: Estado de los skins de asteroides (clasico/neon/retro x claro/oscuro) y decisiones de infraestructura compartida
metadata:
  type: project
---

Aplicado 2026-11-17. Motor: `app/games/asteroides/{engine,skins}.ts`; el motor acepta `(canvas, events, {skin, modo})` y expone `setSkin`.
Paletas: clasico (gris-azulado #1b2230 / claro #f4f6fa), neon (negro con glow 10 / lavanda #e6e1f5 glow 4), retro (Game Boy #9bbc0f/#0f380f y ámbar #ffb000 sobre #0a0700). Todos los contrastes medidos: texto >= 4.5, objetos >= 3 (mínimo retro-claro asteroide 3.29).

**Infra compartida creada:** `app/games/skins.ts` (SkinId, Modo, SKINS, JUEGOS_CON_SKINS), `GameProps/GameEngine` opcionales en `types.ts`, bloque SKINS al final de `globals.css`, `app/components/skin-selector.tsx` (hook `useSkin(activo)` con useSyncExternalStore + `SkinSelector`), montado en `game-player.tsx`.

**Why:** el selector solo marca `<html data-skin/data-theme>` mientras el reproductor de un juego con skins está montado; así el resto del sitio conserva el neón original (no se cambia el default global a clásico).
**How to apply:** para otro juego, reutilizar todo, añadir su id a `JUEGOS_CON_SKINS`, crear `skins.ts`, pasar `skin/modo` y `setSkin`. Evitar `Object.hasOwn` en `app/games/skins.ts` (engine-smoke compila con lib es2020).

Pendientes: captura visual con Playwright no hecha (MCP no disponible para el agente); neon-oscuro `--ink-faint` (#4a4f70) mide 2.4:1, es el token original, no se tocó.
