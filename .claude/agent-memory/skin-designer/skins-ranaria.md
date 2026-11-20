---
name: skins-ranaria
description: Estado de los skins de ranaria (FROGGER) clasico/neon/retro x claro/oscuro, decisiones de paleta y pendientes
metadata:
  type: project
---

Aplicado 2026-11-18. Archivos: `app/games/ranaria/{engine,skins}.ts`, `app/components/ranaria-game.tsx`, `ranaria` en `JUEGOS_CON_SKINS`. Motor `(canvas, events, {skin, modo})` con `setSkin`; la constante PAL se sustituyó por `pal` (paleta activa).

Decisiones: la rana lleva contorno (`frogEdge`) para separarse de cualquier fondo (agua, asfalto, tronco). La barra de tiempo (HUD interno) va sobre un carril opaco oscuro (`timeTrack`), así ya no se pierde sobre la orilla verde. Sin alfa: parabrisas y tortuga sumergida son colores sólidos. En retro (`pixel`) los círculos/elipse/roundRect pasan a rectángulos; claro retro usa solo los 4 verdes Game Boy. Neon: glow 10 oscuro, 4 claro. Contrastes medidos (script en scratchpad): HUD >= 6.0, vehículos >= 3.44, troncos >= 3.12, tortugas >= 3.29, rana (relleno o contorno) >= 3.07.

Pendientes: captura visual Playwright no hecha; `npm run build` no ejecutado; retro claro no distingue color de la barra de tiempo (verde/medio/bajo), solo su largo.
