---
name: perf-ranaria
description: Revisión de rendimiento de ranaria (FROGGER) con engine-perf: fondo en OffscreenCanvas, 1210 a 682 llamadas al contexto, traza idéntica.
metadata:
  type: project
---

Juego `ranaria`, revisado con Node (sin navegador, ejecución en paralelo). Hash de traza antes = después: 99be63811b9ec6ac1f9a47a118d51c07e14221a97168049b908b1deeceec3899.

| Métrica (Node)                                  | Antes          | Después                              |
| ----------------------------------------------- | -------------- | ------------------------------------ |
| Llamadas al contexto/fotograma (defecto y neón) | 1210           | 682                                  |
| shadowBlur ≠ 0/fotograma (neón)                 | 31             | 31 (por entidad con glow; no tocado) |
| measureText/fotograma                           | 2              | 0                                    |
| lineTo / moveTo                                 | 316 / 250      | ~124 / 244                           |
| Heap/1000 fot., 50 restart                      | 0.12 / 0.07 MB | 0.125 / 0.066 MB                     |

Corregido (engine.ts): fondo estático (orilla, río con ondas, zonas, carretera) en OffscreenCanvas, regenerado en `setSkin`; ranas de las bocas se dibujan encima recortadas a la fila 0 (equivale al orden original, el río las tapaba); escamas de tortuga en un solo path; trazos de tronco en un solo stroke; constantes `SCALES`/`LEGS` a módulo; texto y ancho del HUD cacheados por valor.

Pendiente: 31 asignaciones de shadowBlur en neón (glow por entidad, igual color por lote solo daría ahorro mínimo y arriesga el orden de dibujo); falta medir en navegador y en móvil real.
