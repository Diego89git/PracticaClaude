---
name: perf-asteroides
description: Revisión de rendimiento de ASTEROIDES (2026-11-18): dentro de presupuesto en Node, sin cambios de código
metadata:
  type: project
---

Medición Node (engine-perf, 3000 fotogramas), sin tocar código:

| Métrica                  | Clásico                                | Neón oscuro     |
| ------------------------ | -------------------------------------- | --------------- |
| Bucles rAF               | 1                                      | 1               |
| Llamadas ctx/fotograma   | 164.3 (máx 314)                        | 164.3 (máx 314) |
| shadowBlur ≠ 0/fotograma | 0                                      | 13.29 (máx 36)  |
| font asignada            | 0.23 (máx 1)                           | 0.23            |
| Heap/1000 fotogramas     | 0.122 MB                               | 0.122 MB        |
| Tras 50 restart()        | 1 keydown, 1 keyup, 1 bucle, +0.021 MB | igual           |
| destroy()                | 0 listeners, 0 frames                  | igual           |

Hash de traza (antes = después): 1b202689f8d228c6d8370d4a89bddaa3022db73c74c5ad3e37a6f7db67aa9d88

Decisión: todo dentro de presupuesto; no se optimizó. Pendiente (no aplicado, beneficio incierto y riesgo visual):

- Glow por entidad (`glow()` en engine.ts:12, llamado desde cada `draw`): 13 asignaciones de shadowBlur por fotograma en neón. Agrupar por color cambiaría el orden de dibujo visible.
- `.forEach/.filter` por fotograma sobre entidades (engine.ts:527-565): asignaciones menores, heap estable.

Navegador (medido por la sesión principal, emulación): neón 1.88 ms/fotograma (9.83 ms con CPU 4x) frente a clásico 1.12 (5.06). Falta prueba en móvil real.
