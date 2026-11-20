---
name: perf-serpentina
description: Revisión de rendimiento de SERPENTINA (Snake): cifras Node antes/después, hallazgos y pendientes
metadata:
  type: project
---

Revisión 2026-11-18 (solo Node + código; navegador lo midió la sesión principal).

- Antes: 85 ctx/fotograma (moveTo/lineTo x33 de la rejilla estática), p95 ~0.008 ms, hash traza 5675e86f...d7913. Neón oscuro: igual + 3 shadowBlur/fotograma.
- Corregido en engine.ts: fondo + rejilla en un OffscreenCanvas (regenerado en setSkin, respaldo sin OffscreenCanvas). Después: 17 ctx/fotograma, p95 ~0.003-0.005 ms, hash idéntico. shadowBlur sin cambios (3 en neón, ya por lote).
- No tocado: spawnFruit (O(celdas x longitud), solo al comer; el orden de Math.random es jugabilidad), choque propio (O(n) por paso, no por fotograma), roundRect por segmento (necesario).
- Todo lo demás dentro de presupuesto (bucle 1, listeners 0, heap +0.03 MB tras 50 restart).
- Falta: medir en navegador tras el cambio y en móvil real.
