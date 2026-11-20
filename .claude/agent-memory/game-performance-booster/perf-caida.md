---
name: perf-caida
description: Revisión de rendimiento de CAÍDA (Tetris), cifras Node antes/después y hallazgos
metadata:
  type: project
---

Fecha: 2026-11-18. Solo Node + código (sin navegador por ejecución en paralelo).

Antes -> después (engine-perf, 3000 fotogramas):

- ctx/fotograma media: 181.6 -> 68.6 (máx 232 -> 119); fillRect 91 -> 89; se eliminan beginPath/moveTo/lineTo/stroke x28.
- ms/fotograma p95 (orientativo): 0.0217 -> 0.0112.
- font asignada: 3 -> 3 (en el límite, no tocado). shadowBlur 0. Heap 0.119 -> 0.116 MB/1000 fotogramas. Tras 50 restart: 1 keydown, 1 bucle, +0.02 MB.
- Hash traza idéntico: a53c30fb41d350dab8a263f61f3b63b91c32d6b5c406c35bbf690da35b40694a.
- Navegador antes (sesión principal): 32 FPS (techo del entorno), 1.38 ms/fotograma, 7.11 ms con CPU 4x, 0 tareas largas, heap +0.13 MB.

Corregido: engine.ts, fondo+tablero+cuadrícula pintados una vez en OffscreenCanvas (con fallback directo) y copiados con drawImage.
Pendiente/no tocado: font x3 por fotograma (dentro de presupuesto); fichas del tablero se redibujan con fillRect x2 por bloque (coste menor); sin skins.
Falta: medición «después» en navegador y prueba en móvil real.
