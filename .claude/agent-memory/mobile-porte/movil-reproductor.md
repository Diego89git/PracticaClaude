---
name: movil-reproductor
description: Estado de la vista móvil del reproductor /jugar/[id] (4 juegos reales), decisiones y pendientes; revisado 2026-11-17
metadata:
  type: project
---

Estado: revisado y corregido el 2026-11-17 en emulación (no probado en móvil real).

Estado previo: la spec 16 ya estaba implementada (mando, aviso de giro, rejilla apaisada). Solo se corrigió lo que fallaba en 360×640.

Corregido en `app/globals.css` (bloques `max-width: 720px`, portrait y landscape del final del archivo):

- `.hud-actions` se salía del marco del HUD a 360 px: ahora fila de 3 botones flex a ancho completo.
- Zonas del mando con gap 8 px (con 12 px ◀▶ de 72 px envolvían a 2 filas a 360).
- Selector de skin en una sola fila (etiqueta SKIN oculta), gap en línea del HUD sobrescrito con `!important`.
- `.crt-bottom` oculto en ≤720 px (envolvía a 2 líneas y empujaba el mando).
- Portrait táctil: botones del HUD min-height 56 px y pie de página oculto con `html[data-mando]`.
- Apaisado: offset del canvas 150→134 px (canvas 320×240 → 341×256).

**Why:** a 360×640 el mando de ASTEROIDES quedaba bajo el pliegue.
**How to apply:** si se retoca, medir en 4 viewports; para forzar `pointer: coarse` sin dispositivo, reescribir `mediaText` de las reglas CSS por JS o usar iframes del tamaño deseado.

Trampa del entorno: el dev server (Turbopack) a veces sirve el CSS viejo tras varias ediciones seguidas; `touch app/globals.css` y recargar.

Pendientes (fuera de alcance o no resueltos):

- Botones PAUSA/FIN/REGRESAR en apaisado miden 33 px (< 56): no hay altura libre en 390 px.
- Botones del selector de skin miden ~34 px.
- 360×640 ASTEROIDES: sigue 56 px de scroll vertical (el mando cabe, el aviso de giro no).
- Escritorio 1280×800: el canvas (1004×753) supera la altura del viewport; es comportamiento previo, no tocado.
- Falta prueba en móvil real (toques, multitoque, orientación).

## Actualización 2026-11-18: FROGGER (`ranaria`, sin `controles`)

- `game-player.tsx` marca `<html data-reproductor>` en todos los juegos y `.crt-screen` lleva `data-juego={id}`.
- CSS táctil: navbar y pie ocultos con `html[data-reproductor]` (antes solo con `data-mando`); sin eso un juego sin mando desbordaba el ancho (navbar 36 px a 360) y hacía scroll vertical apaisado.
- `ranaria`: `.crt-screen` toma aspect-ratio 640/560 en ≤720 px y apaisado táctil, con radio 4 px (la curva del CRT recortaba el HUD del canvas).
- Pendiente: ranaria sin mando táctil (decisión del usuario); navbar global desborda a 360–390 con puntero fino en todas las pantallas (no tocado).
- Build no ejecutado (dev server activo).
