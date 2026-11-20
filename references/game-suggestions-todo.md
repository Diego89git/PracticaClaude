# Sugerencias de juegos (game-planner)

Lista viva mantenida por el agente `game-planner`. `- [ ]` pendiente · `- [x]` implementado.

## Pendientes

- [ ] `invasores` — INVASORES · SHOOTER · green · medio — placeholder, score ilimitado por oleadas, bajo riesgo **(recomendado)** (sugerido 2026-11-17)
- [ ] `gloton` — GLOTÓN · ARCADE · yellow · alto — color nuevo y mayor demanda, pero laberinto + IA de fantasmas (sugerido 2026-11-17)
- [ ] `ranaria` — RANARIA · ARCADE · green · medio — tráfico y troncos, puntaje menos ilimitado (sugerido 2026-11-17)
- [ ] `duelo-pixel` — DUELO PIXEL · VERSUS · cyan · medio — categoría nueva, requiere IA y redefinir score (sugerido 2026-11-17)
- [ ] `carrera-neon` — CARRERA NEÓN · CARRERAS · orange · bajo — categoría y color nuevos, score por distancia ilimitado, sin assets (sugerido 2026-11-17)
- [ ] `salto-neon` — SALTO NEÓN · ENDLESS · yellow · bajo — runner vertical tipo Doodle Jump; fusiona `saltarin` y `salto-neon`; si `gloton` va antes, cambiar de color (sugerido 2026-11-17)
- [ ] `dos-mil` — 2048 NEÓN · PUZZLE · yellow · bajo — rejilla 4x4 sin física ni IA, score por fusiones (sugerido 2026-11-17)
- [ ] `torre-stack` — TORRE STACK · HABILIDAD · green · bajo — timing/stack, score ilimitado por altura (sugerido 2026-11-17)
- [ ] `tiro-al-blanco` — TIRO AL BLANCO · HABILIDAD · yellow · bajo — casi sin riesgo técnico, cuenta atrás de 60 s (sugerido 2026-11-17)
- [ ] `comando-misil` — COMANDO MISIL · SHOOTER · red · medio — apuntado y defensa de ciudades, mecánica distinta a lo existente (sugerido 2026-11-17)
- [ ] `neon-match` — NEÓN MATCH · PUZZLE · cyan · medio — match-3 con cascadas, requiere garantizar movimientos válidos (sugerido 2026-11-17)
- [ ] `ciclos` — CICLOS (Tron) · ARCADE · magenta · medio — se parece a SERPENTINA salvo que sea contra IA (sugerido 2026-11-17)
- [ ] `eco-simon` — ECO (Simon) · MEMORIA · magenta · bajo — categoría nueva, score limitado y audio (sugerido 2026-11-17)
- [ ] `topos` — TOPOS (whack-a-mole) · CASUAL · magenta · bajo — poca profundidad, cuadrícula 3x3 (sugerido 2026-11-17)
- [ ] `aleteo` — ALETEO (Flappy) · ENDLESS · cyan · muy bajo — clon evidente, relleno barato (sugerido 2026-11-17)
- [ ] `arena-gemela` — ARENA GEMELA (twin-stick) · SHOOTER · orange · medio — solapa con ASTEROIDES e INVASORES (sugerido 2026-11-17)
- [ ] `columnas-neon` — COLUMNAS (Columns/Dr. Mario) · PUZZLE · green · bajo-medio — muy parecido a CAÍDA (sugerido 2026-11-17)
- [ ] `galaxia` — GALAXIA (Galaga) · SHOOTER · magenta · alto — se pisa con `invasores` (sugerido 2026-11-17)
- [ ] `bombardero` — BOMBARDERO (Bomberman) · ARCADE · orange · alto — cuadrícula, explosiones en cadena, IA; el más pesado (sugerido 2026-11-17)
- [ ] `burbujas` — BUBBLE SHOOTER · PUZZLE · por definir · medio-alto — ángulos y rebotes; sin puntuar por el agente (sugerido 2026-11-17)

Notas:
- Los ids nuevos (todos salvo `invasores`, `gloton`, `ranaria` y `duelo-pixel`) no tienen ficha en `app/data.ts`; haría falta añadirla.
- Los colores son propuestas sin contrastar con `app/globals.css` ni `catalog.ts`. `yellow` lo piden varios, así que hay que repartirlos.

## Descartados

- [ ] `rocas` — ROCAS · SHOOTER · yellow — duplica ASTEROIDES (descartado 2026-11-17)
- [ ] `defensor` — DEFENSOR (Defender) · SHOOTER · purple · alto — scroll horizontal, radar y muchos enemigos; baja viabilidad (descartado 2026-11-17)
- [ ] `minigolf` — MINIGOLF NEÓN · DEPORTES · cyan · alto — física de rebote y score acotado, poco útil para el leaderboard (descartado 2026-11-17)
- [ ] `buscaminas-neon` — CAMPO MINADO · LÓGICA · orange/yellow · medio — se juega con ratón y el score es pobre (descartado 2026-11-17)
