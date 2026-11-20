---
name: skins-serpentina
description: Estado de los skins de serpentina (clasico/neon/retro x claro/oscuro), decisiones de paleta y pendientes
metadata:
  type: project
---

Aplicado 2026-11-17. Archivos: `app/games/serpentina/{engine,skins,sprites}.ts`, `app/components/serpentina-game.tsx`, y `serpentina` añadido a `JUEGOS_CON_SKINS`. Motor `(canvas, events, {skin, modo})` con `setSkin`.

Paletas: mismas bases que [[skins-asteroides]]; neon-oscuro conserva los colores originales (#0a0a18, #2ecc71, #7dffb0). Contrastes medidos: texto >= 6.0, cuerpo >= 3.29 (retro claro), neon claro cuerpo 3.47.
Decisión: en retro la fruta se dibuja como manzana de píxel de un color (`drawFruitPixel` en sprites.ts) porque el spritesheet a todo color rompe la paleta limitada; en clasico/neon se usa el spritesheet tal cual (no se mide su contraste, es un asset a color).

Pendientes: captura visual Playwright no hecha (sin MCP de navegador); revisar a ojo que las frutas del spritesheet destaquen sobre fondos claros.
