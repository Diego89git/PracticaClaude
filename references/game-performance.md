# Rendimiento de los juegos (game-performance-booster)

Registro de los juegos con motor real cuyo rendimiento ya se revisó. Lo mantiene el agente `game-performance-booster` (un juego a la vez, solo el que se indique por id). Herramienta de Node: `.claude/skills/add-game/scripts/engine-perf.mjs`.

## Presupuestos

- **Node:** 1 bucle de `requestAnimationFrame` por fotograma; tras 50 `restart()` 1 listener por tipo y heap ≤ +2 MB; `destroy()` deja 0 listeners y 0 frames; heap ≤ +1 MB cada 1000 fotogramas; `save`/`restore` equilibrados; `font` ≤ 3 por fotograma; sin `getImageData` en el bucle.
- **Navegador (`/jugar/<id>`):** ≥ 58 FPS en escritorio y ≥ 50 con CPU 4×; 0 tareas largas (> 50 ms); heap ≤ +2 MB tras 5 JUGAR DE NUEVO; el HUD de React solo cambia cuando cambia un valor.
- Se mide con el skin por defecto y con `neon` oscuro. La traza de `engine-perf.mjs --trace` debe ser idéntica antes y después (misma jugabilidad).

> **Entorno de medición:** en este servidor el navegador de Playwright no pasa de ~32 FPS ni con `about:blank` (refresco de la sesión remota), así que el presupuesto de FPS no se puede comprobar aquí. Se usa el **tiempo de CPU del hilo principal por fotograma** (CDP `Performance.getMetrics`, `TaskDuration` / fotogramas, en modo desarrollo); un fotograma a 60 Hz tiene 16,7 ms. Ruido entre ejecuciones: ±10–15 %.

## Revisión del 2026-11-18 (cinco instancias en paralelo)

Navegador: ms de CPU por fotograma, antes → después. Todas las combinaciones dieron 0 tareas largas, ~32 FPS (techo del entorno), HUD sin mutaciones de más y sin errores.

| Juego (id) | ctx/fotograma (Node) | Por defecto | CPU 4× | Neón oscuro, CPU 4× | Heap tras 5 reinicios | Traza | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ranaria` | 1210 → 682 | 2,71 → 1,82 | 7,19 → 7,47 | 14,06 → 12,94 | +0,19 → +0,16 MB | idéntica | Optimizado (fondo en OffscreenCanvas, HUD cacheado, menos paths) |
| `asteroides` | 164 → 164 | 1,12 → 1,11 | 5,06 → 5,16 | 9,83 → 9,00 | +0,32 → +0,36 MB | idéntica | Sin cambios (dentro de presupuesto) |
| `caida` | 182 → 69 | 1,38 → 1,41 | 7,11 → 6,59 | — (sin skins) | +0,13 → +0,13 MB | idéntica | Optimizado (fondo y cuadrícula en OffscreenCanvas) |
| `bloque-buster` | 61 → 61 | 2,05 → 1,77 | 7,39 → 7,50 | — (sin skins) | +0,13 → +0,16 MB | idéntica | Optimizado (sin strings ni arrays por fotograma) |
| `serpentina` | 85 → 17 | 1,08 → 1,08 | 4,19 → 4,34 | 6,31 → 7,10 | +0,23 → +0,32 MB | idéntica | Optimizado en Node; en navegador sin mejora medible |

Pendientes anotados (no aplicados): glow por entidad en neón de `ranaria` (31 `shadowBlur` por fotograma) y `asteroides` (13); 60 `drawImage` escalados en `bloque-buster`. Detalle en `.claude/agent-memory/game-performance-booster/perf-<id>.md`.

## Pendientes

Juegos con motor real aún sin revisar: ninguno.
