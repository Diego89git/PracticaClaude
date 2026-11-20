# SPEC 18 — Game jam «Eco en la oscuridad»: SONAR, núcleo jugable

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06, SPEC 07, SPEC 16
> **Fecha:** 2026-11-18
> **Objetivo:** Añadir SONAR, un juego de submarino ciego en el que solo se ve lo que ilumina el eco de un ping, creado desde cero, al catálogo de Arcade Vault, jugable en `/jugar/sonar` y con su leaderboard real en Supabase.

## Por qué existe esta spec

SONAR nace del tema de game jam **«Eco en la oscuridad»** y es la primera de las tres specs del juego (SPEC 18 núcleo, SPEC 19 progresión, SPEC 20 pulido). El tema es la mecánica: el fondo marino está completamente a oscuras, las perlas y las minas son invisibles y el único modo de verlas es emitir un ping, un anillo de sonar que las ilumina un instante cuando lo cruza. El jugador debe recordar lo que vio, porque el eco se apaga a los 2 s y las minas matan. Esta spec entrega lo mínimo para jugar de principio a fin y entrar en el ranking: ficha, portada, motor con submarino, ping, perlas, minas, aire, puntuación y fin de partida.

No se porta nada: `references/started-games/` no tiene un juego así, y como en SERPENTINA (SPEC 09) las reglas se definen aquí, con números. No reemplaza a ningún placeholder: es un juego nuevo con id propio, portada propia y su ficha **solo en Supabase**, como ASTEROIDES, así que el Home no cambia. Sigue la receta de `.claude/skills/add-game/references/pattern.md` y usa el registro de juegos que creó la SPEC 07 y el mando táctil de la SPEC 16.

## Alcance

**Dentro:**

- Fila `sonar` en la tabla `games` de Supabase, con su migración en `supabase/migrations/`.
- Portada `.cover-sonar` en `app/globals.css`, dibujada con el propio juego (anillos de sonar, submarino, perla y mina).
- Motor en `app/games/sonar/engine.ts`: lógica nueva descrita en el modelo de datos, con el contrato de `pattern.md` (canvas por parámetro, listeners con limpieza, callbacks hacia el HUD).
- Componente cliente `app/components/sonar-game.tsx` que monta el motor en un `<canvas>` de 800×600 dentro del marco CRT.
- Entrada de `sonar` en el registro de juegos (`app/games/catalog.ts`, con su mando táctil) y en `app/games/components.tsx`: HUD solo con Puntuación, sin Vidas ni Nivel.
- PAUSA, FIN, JUGAR DE NUEVO y GUARDAR PUNTUACIÓN con el juego real; puntuación guardada en `scores`.
- Mecánica: submarino que nada libremente a 160 px/s; ping con ESPACIO que revela durante 2 s lo que cruza; 3 perlas siempre en juego (100 puntos, 150 si se recogen sin verlas); 5 minas fijas que acaban la partida; aire de 45 s que cada perla repone 6 s.
- Control solo con teclado: ← ↑ → ↓ nadan y ESPACIO emite el ping. Las flechas y ESPACIO no hacen scroll de la página.

**Fuera de alcance (specs futuras):**

- Niveles, más minas, minas que se mueven, multiplicador por silencio y dificultad creciente: SPEC 19.
- Vidas, pantalla de espera, estela, partículas, sacudida y avisos visuales: SPEC 20.
- Sonido, imágenes y cualquier asset: el juego se dibuja con formas del canvas.
- Teclas WASD y ratón.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cambios en los otros juegos, reales o placeholder.

## Modelo de datos

Fila de `games` (migración `supabase/migrations/20261118130000_game_sonar.sql`):

```sql
insert into public.games (id, title, short, long, cat, cover, color) values (
  'sonar',
  'SONAR',
  'Lanza el ping, recuerda el mapa y no pises la mina.',
  'Un submarino en un mar sin luz: perlas y minas solo existen mientras el eco las ilumina, y el eco dura apenas dos segundos. Lanza el ping, memoriza lo que ves y nada a ciegas hasta la perla; el aire se agota y una sola mina acaba la inmersión.',
  'ARCADE',
  'cover-sonar',
  'green'
);
```

Entrada del registro (`app/games/catalog.ts`), con el mando táctil de la SPEC 16:

```ts
sonar: {
  hud: { vidas: false, nivel: false },
  controles: [
    { code: "ArrowLeft", etiqueta: "◀", aria: "Nadar a la izquierda", modo: "mantener", zona: "izquierda" },
    { code: "ArrowRight", etiqueta: "▶", aria: "Nadar a la derecha", modo: "mantener", zona: "izquierda" },
    { code: "ArrowUp", etiqueta: "▲", aria: "Nadar hacia arriba", modo: "mantener", zona: "izquierda" },
    { code: "ArrowDown", etiqueta: "▼", aria: "Nadar hacia abajo", modo: "mantener", zona: "izquierda" },
    { code: "Space", etiqueta: "PING", aria: "Emitir un ping", modo: "pulso", zona: "derecha" },
  ],
},
```

Motor: `createSonar(canvas: HTMLCanvasElement, events: GameEvents): GameEngine`, con el contrato de `.claude/skills/add-game/references/pattern.md` sección 2. Constantes del juego:

```ts
const W = 800;
const H = 600;
const CELL = 100; // el mar se divide en una rejilla de 8×6 celdas de 100×100 px, solo para colocar objetos
const GCOLS = 8;
const GROWS = 6;
const START_CELL = { x: 4, y: 3 }; // celda inicial del submarino
const START = { x: 450, y: 350 }; // centro de START_CELL
const SUB_R = 12; // radio del submarino
const SUB_SPEED = 160; // px/s
const PEARL_R = 8;
const MINE_R = 14;
const PEARLS_ON_FIELD = 3;
const MINES = 5;
const PING_SPEED = 400; // px/s: el anillo crece a esta velocidad
const PING_MAX_R = 400; // el anillo desaparece al llegar a 400 px (1,0 s)
const PING_CD_S = 1.5; // enfriamiento desde que se emite
const REVEAL_S = 2.0; // un objeto cruzado por el anillo es visible 2,0 s
const FADE_S = 0.5; // y se desvanece en los últimos 0,5 s
const O2_MAX = 45; // segundos de aire
const O2_PER_PEARL = 6;
const PEARL_SCORE = 100;
const BLIND_SCORE = 150; // perla recogida sin estar visible
```

Estado del motor (variables de cierre dentro de `createSonar`):

```ts
interface Thing {
  x: number;
  y: number;
  reveal: number; // segundos de visibilidad que quedan (0 = invisible)
}
interface Ring {
  x: number; // centro fijo: donde estaba el submarino al emitir
  y: number;
  r: number; // radio actual
  prev: number; // radio del fotograma anterior
}
let sx: number; // posición del submarino
let sy: number;
let held: Set<string>; // ArrowLeft, ArrowRight, ArrowUp, ArrowDown mantenidas
let mines: Thing[];
let pearls: Thing[];
let ring: Ring | null;
let pingCd: number; // segundos hasta poder emitir otro ping
let o2: number; // segundos de aire
let score: number;
let pearlCount: number; // perlas recogidas, solo para dibujar
let over: boolean;
let paused: boolean;
```

Reglas:

- **Celdas libres:** la celda de un punto es `(floor(x / 100), floor(y / 100))`, con `x` entre 0 y 7 e `y` entre 0 y 5. Para colocar un objeto se construye la lista de celdas libres en orden de filas (`y` de 0 a 5, `x` de 0 a 7), se hace **una** llamada a `Math.random` y se elige la celda de índice `floor(r × longitud)`. El objeto queda en el centro de la celda: `(100 × x + 50, 100 × y + 50)`. Con `Math.random` fijo en 0 se elige siempre la primera celda libre.
- **Inicio:** submarino en `(450, 350)`, `o2 = 45`, puntuación 0, sin anillo y `pingCd = 0`. No hay pantalla de espera: el aire corre desde el primer fotograma.
- **Minas:** 5, colocadas una a una antes que las perlas. Celdas libres: todas salvo las 9 con distancia de Chebyshev menor que 2 respecto de `START_CELL` (`x` de 3 a 5 e `y` de 2 a 4) y las de minas ya colocadas. Quedan 39 celdas posibles. Las minas no se mueven y empiezan invisibles (`reveal = 0`). Con aleatorio fijo en 0 quedan en las celdas `(0,0)`, `(1,0)`, `(2,0)`, `(3,0)` y `(4,0)`.
- **Perlas:** 3, colocadas tras las minas con la misma regla de celdas libres, excluyendo además las celdas de las perlas ya colocadas. Empiezan invisibles. Con aleatorio fijo en 0 quedan en `(5,0)`, `(6,0)` y `(7,0)`, es decir, en los centros `(550, 50)`, `(650, 50)` y `(750, 50)`.
- **Movimiento:** con `dx = (derecha ? 1 : 0) − (izquierda ? 1 : 0)` y `dy = (abajo ? 1 : 0) − (arriba ? 1 : 0)`, si `dx` o `dy` no son 0 el submarino avanza `160 × dt` px en esa dirección, dividiendo `dx` y `dy` por `√(dx² + dy²)` para que la velocidad diagonal sea la misma. Al final se limita `sx` a `[12, 788]` y `sy` a `[12, 588]`: los bordes del canvas son el límite del mar. No hay inercia.
- **Ping:** ESPACIO (un `keydown` con `repeat: false`) emite un ping si `pingCd ≤ 0`: crea el anillo `{ x: sx, y: sy, r: 0, prev: −1 }` y pone `pingCd = 1,5`. Si el enfriamiento no ha acabado, ESPACIO no hace nada. Solo hay un anillo a la vez (el enfriamiento de 1,5 s es mayor que la vida de 1,0 s del anillo).
- **Eco:** en cada fotograma, con el anillo vivo, se hace `prev = r` y `r += 400 × dt`; todo objeto (perla o mina) cuya distancia `d` al centro del anillo cumple `prev < d ≤ r` pasa a `reveal = 2,0`. El anillo se retira cuando `r ≥ 400`, tras haber revelado en ese mismo fotograma lo que cruzó. Un objeto ya visible que vuelve a ser cruzado renueva `reveal` a 2,0.
- **Visibilidad:** un objeto es visible si `reveal > 0`. `reveal` baja con `dt` hasta 0 antes de que el anillo del mismo fotograma revele objetos nuevos. Se dibuja con opacidad `min(1, reveal / 0,5)`. Nada más en el mar se ve: no hay luz ambiente, ni zona de visión alrededor del submarino.
- **Mina:** si la distancia entre el submarino y una mina es `≤ 26` (12 + 14), la partida termina. Se evalúa antes que las perlas: si en el mismo fotograma toca una mina y una perla, no se recoge la perla.
- **Perla:** si la distancia entre el submarino y una perla es `≤ 20` (12 + 8), se recoge, sea o no visible. Suma `100` si `reveal > 0` en ese momento y `150` si no (se recogió a ciegas, de memoria). `o2` sube 6 con tope de 45. La perla se retira y se coloca otra de inmediato con la regla de celdas libres, excluyendo las celdas de todas las minas, las de las otras perlas y las 9 celdas a distancia de Chebyshev menor que 2 respecto de la celda actual del submarino. La nueva perla empieza invisible. Si en un fotograma se tocan dos perlas, ambas se recogen en el orden del arreglo.
- **Aire:** `o2` baja `1 × dt` por fotograma. Si tras recoger las perlas del fotograma `o2 ≤ 0`, la partida termina. Una perla recogida en el mismo fotograma en que `o2` habría llegado a 0 lo evita.
- **Orden de un fotograma (`update(dt)`):** (1) bajar `o2` y `pingCd` y los `reveal`; (2) mover el submarino; (3) avanzar el anillo y revelar; (4) mina; (5) perlas; (6) aire agotado. Al terminar la partida por una causa, las siguientes no se evalúan.
- **Fin:** `onScoreChange` solo cuando el valor cambia y **antes** de `onGameOver(score)`, que se llama una sola vez; la lógica no avanza más y sigue dibujando. `onLivesChange(0)` y `onLevelChange(1)` se llaman una vez al empezar y tras cada `restart()`.
- **Entrada:** `keydown` y `keyup` en `window` con `e.code`. Se ignora todo evento cuyo `e.target` sea un `INPUT`, `TEXTAREA` o `SELECT` o tenga `isContentEditable`. Con la partida terminada o en pausa las teclas no hacen nada. `pause()`, `resume()`, `restart()` y `blur` de la ventana vacían `held`.

Dibujo (valores iniciales, se ajustan viendo la captura sin cambiar el comportamiento): fondo `#02100a`; marco de 2 px `#1d4a2c` en el borde del canvas; submarino siempre visible, una elipse `#5dff8a` de 24×16 px con una torreta de 8×6 px encima, sin girar; anillo de ping `#5dff8a` con grosor de 3 px y opacidad `1 − r / 400`; perla, círculo de radio 8 `#ffe14d` con un brillo `#fff8c4` de radio 3; mina, círculo de radio 14 `#ff4f6a` con 8 púas de 6 px; todo con la opacidad de su visibilidad. Sin puntuación, nivel, vidas ni «GAME OVER»: los pone la plataforma. Lo propio del juego sí se dibuja en monoespaciada de 20 px `#e0e0e0`: `AIRE` en `(20, 30)` con una barra a su derecha de 200×12 px en `(80, 18)` rellena `#5dff8a` en proporción `o2 / 45`, y `PERLAS n` alineado a la derecha en `(780, 30)`.

Convenciones: canvas de 800×600 px (4:3, llena el marco CRT); tiempos en segundos; `dt` limitado a 50 ms; coordenadas en píxeles con origen arriba a la izquierda.

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas") y la sección 6 de `.claude/skills/add-game/references/porting.md` (modo «desde cero»), y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components y Cache Components, según exige `AGENTS.md`. Usar `/frontend-design` para la portada.

1. **Ficha.** Crear la migración con la fila `sonar` y aplicarla con `apply_migration` **tras pedir confirmación al usuario**. No se añade a `app/data.ts`. Verificar: `list_tables` y una consulta muestran la fila; `/biblioteca` muestra una tarjeta más que antes (10 con el catálogo actual: 8 placeholders de `app/data.ts`, ASTEROIDES y SONAR; una más por cada juego de game-jam ya implementado) y la de SONAR muestra `best` 0; `/juegos/sonar` carga con el estado vacío del ranking; `/jugar/sonar` muestra el placeholder.
2. **Portada.** Añadir `.cover-sonar` a `app/globals.css` junto a las otras `.cover-*`, con un SVG en `::after` (viewBox 400×300) que dibuje tres anillos concéntricos verdes que se desvanecen, un submarino en el centro, una perla amarilla y una mina rosa iluminadas en el borde de un anillo, sobre un fondo casi negro con halo verde, siguiendo la idea de la portada de ASTEROIDES. Verificar: captura de la tarjeta en `/biblioteca` y en `/juegos/sonar`, distinta de las demás portadas.
3. **Motor: mar, submarino y dibujo.** Crear `app/games/sonar/engine.ts` desde `.claude/skills/add-game/assets/engine.ts.tpl` con las constantes, la colocación en celdas libres de minas y perlas, el movimiento con `held`, el dibujo (con perlas y minas invisibles), los callbacks iniciales, `keydown`, `keyup` y `blur`. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y `node .claude/skills/add-game/scripts/engine-smoke.mjs app/games/sonar/engine.ts createSonar`.
4. **Motor: ping y eco.** Añadir ESPACIO, el anillo, el enfriamiento, el reveal y el desvanecimiento. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y una prueba de comportamiento escrita fuera del repo con `Math.random` fijo en 0 (sección 8 de `pattern.md`): un ping desde `(450, 350)` revela la mina de `(450, 50)` (distancia 300) a los 0,75 s ±1 fotograma y la perla de `(550, 50)` (distancia ≈ 316,2) a los 0,79 s ±1 fotograma, y ambas dejan de ser visibles 2,0 s después.
5. **Motor: perlas, minas, aire y fin.** Añadir recogida con puntos, reposición de perlas, aire, muerte por mina y `onGameOver(score)` una sola vez. Verificar: `npx tsc --noEmit`, `npx eslint app/games`, el smoke del motor y la prueba de comportamiento con `Math.random` fijo en 0: nadar a la derecha 0,625 s y luego hacia arriba 1,875 s recoge a ciegas la perla de `(550, 50)` y suma 150; nadar hacia arriba desde `(450, 350)` termina la partida con 0 puntos a los 1,7125 s ±1 fotograma (distancia 26 a la mina de `(450, 50)`); sin tocar nada, la partida termina a los 45 s.
6. **Componente.** Crear `app/components/sonar-game.tsx` desde `.claude/skills/add-game/assets/game-component.tsx.tpl` con el canvas de 800×600.
7. **Registro.** Añadir `sonar` a `catalog.ts` (con `controles`) y a `components.tsx`. Verificar en el navegador: `/jugar/sonar` muestra el canvas oscuro con el submarino, la barra de aire y `PERLAS 0`, el HUD muestra solo Puntuación, ESPACIO dibuja un anillo, PAUSA congela y FIN abre el modal.
8. **Cierre.** `npm run lint`, `npm run build` sin trazas de error, `get_advisors` de seguridad sin avisos, `node .claude/skills/add-game/scripts/rls-check.mjs sonar` y una partida completa hasta verla en `/juegos/sonar` y en la pestaña de SONAR de `/salon`. Borrar todas las filas de prueba de `scores` (incluida `RLSTEST`).

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] La tabla `games` contiene la fila `sonar` con `cover-sonar` y color `green`; `supabase/migrations/` contiene su migración.
- [ ] `/biblioteca` muestra una tarjeta más que antes (10 con el catálogo actual) y la de SONAR muestra `best` 0 y una portada distinta de las demás.
- [ ] El Home (`/`) sigue mostrando exactamente las mismas 6 mini tarjetas.
- [ ] `/juegos/sonar` muestra título, descripción larga y, sin puntuaciones, "Sé el primero en entrar al salón de la fama".
- [ ] `/jugar/sonar` muestra el juego real en un canvas de 800×600 dentro del marco CRT, sin el placeholder; los demás juegos siguen como antes.
- [ ] El canvas no dibuja puntuación, nivel, vidas ni "GAME OVER"; solo dibuja el mar, el submarino, `AIRE` con su barra y `PERLAS n`. El HUD de la plataforma muestra Puntuación y no muestra Vidas ni Nivel.
- [ ] Al empezar, el submarino está en `(450, 350)`, `AIRE` está al 100 % (45 s), la puntuación es 0 y no se ve ninguna perla ni mina.
- [ ] Con `Math.random` fijo en 0 hay 5 minas en los centros de las celdas `(0,0)` a `(4,0)` y 3 perlas en `(550, 50)`, `(650, 50)` y `(750, 50)`; ninguna mina nace en las 9 celdas que rodean `(4,3)`.
- [ ] El submarino nada a 160 px/s (±1 fotograma), a la misma velocidad en diagonal, se detiene al soltar las flechas y no sale del rectángulo `[12, 788] × [12, 588]`.
- [ ] ESPACIO emite un anillo de ping centrado en el submarino que crece a 400 px/s y desaparece al llegar a 400 px (1,0 s ±1 fotograma); no sigue al submarino.
- [ ] ESPACIO con el enfriamiento activo no emite un segundo ping; pasados 1,5 s ±1 fotograma sí; mantener ESPACIO (`repeat: true`) no emite más de uno.
- [ ] Una perla o mina cruzada por el anillo se hace visible, se mantiene 2,0 s (±1 fotograma), se desvanece en los últimos 0,5 s y vuelve a ser invisible; un nuevo ping que la cruza renueva los 2,0 s.
- [ ] Un objeto que el anillo no ha cruzado nunca se dibuja, aunque esté a menos de 30 px del submarino.
- [ ] Tocar una mina (distancia ≤ 26), visible o no, abre el modal "FIN DEL JUEGO" con la puntuación final, una sola vez.
- [ ] Recoger una perla visible suma 100; recogerla invisible suma 150; en ambos casos `AIRE` sube 6 s con tope de 45 y `PERLAS n` sube 1.
- [ ] Tras recoger una perla aparece otra en una celda libre: siempre hay exactamente 3 perlas en el mar y ninguna nace en una celda con mina ni a menos de 2 celdas (Chebyshev) del submarino.
- [ ] Si el submarino toca una mina y una perla en el mismo fotograma, la partida termina y la perla no se suma.
- [ ] El aire baja 1 s por segundo; al llegar a 0 se abre el modal con la puntuación actual, y una perla recogida en el fotograma en que se agotaría lo evita.
- [ ] `onScoreChange` solo se llama cuando la puntuación cambia; `onLivesChange(0)` y `onLevelChange(1)` se llaman una vez al empezar y tras JUGAR DE NUEVO; `onGameOver` se llama una sola vez, después de la última notificación de puntuación.
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras se juega.
- [ ] PAUSA congela el juego (movimiento, anillo, enfriamiento, visibilidad y aire) y muestra "EN PAUSA"; REANUDAR continúa donde estaba, sin salto de aire ni de anillo; una flecha mantenida al pausar no se queda pegada.
- [ ] En pausa y con la partida terminada, ESPACIO y las flechas no emiten pings ni mueven el submarino.
- [ ] FIN abre el mismo modal con la puntuación actual.
- [ ] Con el modal abierto, ESPACIO no cambia la puntuación y teclear el nombre no mueve el submarino ni emite pings.
- [ ] El nombre se pre-rellena desde `localStorage["av_player_name"]`; GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "sonar"` y `user_id: null`.
- [ ] El botón se deshabilita durante el envío: tres clics seguidos insertan una sola fila.
- [ ] Si el insert falla, el modal muestra un error, no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] La puntuación guardada aparece en `/juegos/sonar` y en la pestaña de SONAR de `/salon` al recargar.
- [ ] JUGAR DE NUEVO deja puntuación 0, `AIRE` al 100 %, `PERLAS 0`, el submarino en `(450, 350)`, sin anillo y un mar nuevo con objetos invisibles.
- [ ] Salir de `/jugar/sonar` y volver no duplica el bucle: los frames por segundo no aumentan tras tres remontajes.
- [ ] El canvas se ve completo sin scroll horizontal a 1440 px y a 768 px de ancho.
- [ ] Con `(pointer: coarse)` el mando muestra el D-pad ◀ ▲ ▶ ▼ y el botón PING; PING emite un ping por toque y las flechas se mantienen mientras se pulsan.
- [ ] `app/games/sonar/engine.ts` no contiene `document.` y solo usa `window.` para registrar y quitar `keydown`, `keyup` y `blur`.
- [ ] Con la clave publishable, el `INSERT` válido en `scores` pasa, los inválidos se rechazan y `UPDATE`/`DELETE` no modifican filas.
- [ ] `/juegos/no-existe` y `/jugar/no-existe` muestran la pantalla 404.
- [ ] Con una clave de Supabase inválida, `/biblioteca` sigue respondiendo 200 y `/jugar/sonar` carga.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

- **Sí:** decidido por game-jam a partir del tema "Eco en la oscuridad"; el usuario no fue consultado. Todas las decisiones de esta spec son propuestas para revisar.
- **Sí:** el tema es la mecánica: no hay luz y lo único que se ve es lo que el ping acaba de cruzar, durante 2 s. Un juego con fondo oscuro pero objetos siempre visibles no cumpliría el tema.
- **No:** un radio de visión fijo alrededor del submarino. Haría innecesario el ping, que es el centro del tema.
- **Sí:** id `sonar`, ARCADE y color `green`. Es el color con menos juegos reales (SERPENTINA) y el fósforo verde es el de un sonar. El id no choca con `catalog.ts`, `app/data.ts`, `implemented-games.md`, ni con otra carpeta de `specs/game-jam/`.
- **Sí:** la ficha vive solo en Supabase y no se añade a `app/data.ts`, como ASTEROIDES: el Home lee `GAMES.slice(0, 6)` y no cambia.
- **Sí:** objetos colocados en una rejilla de 8×6 celdas con una sola llamada a `Math.random` por objeto. Garantiza que nada nace encima del submarino ni de otro objeto, evita bucles de reintentos y hace reproducible la prueba con aleatorio fijo.
- **No:** posiciones libres en píxeles con rechazo por distancia. Con aleatorio fijo no termina o coloca objetos encima del submarino.
- **Sí:** el submarino siempre es visible. Sin ver dónde estás, el eco no se puede relacionar con el mapa.
- **Sí:** el anillo tiene centro fijo y dura 1,0 s; el enfriamiento es de 1,5 s. Así solo hay un anillo y los pings son una decisión: cada uno gasta un tercio de la vida del eco anterior.
- **No:** que el ping cueste aire. Ya limita el enfriamiento; premiar el silencio es la mecánica de la SPEC 19.
- **Sí:** la perla recogida a ciegas vale 150 y la visible 100. Premia memorizar el mapa, que es la habilidad que pide el tema.
- **Sí:** 5 minas fijas e invisibles. Con 5 de 39 celdas posibles hay siempre pasillos, y la mina mata sin vidas: el riesgo es el precio de nadar a ciegas. Las vidas son de la SPEC 20.
- **Sí:** 45 s de aire y 6 s por perla. Una partida sin perlas dura 45 s y con buen ritmo entre 1 y 3 minutos, dentro de lo que pide la plataforma.
- **Sí:** la mina se evalúa antes que las perlas y el aire después de ellas. La muerte por mina tiene prioridad y una perla de último instante salva la partida: ambas reglas son verificables.
- **Sí:** el mando táctil se declara desde el primer momento (SPEC 16), con las cuatro flechas en `mantener` (el motor lee el estado de la tecla) y PING en `pulso` (una acción por `keydown`). Las flechas llevan una sola letra y caen en el D-pad; PING es el botón redondo.
- **Sí:** sin assets ni sonido. Es una game jam: alcance pequeño y terminable. El «sonido» del sonar es solo visual.
- **Sí:** `dt` limitado a 50 ms. A 50 ms el anillo avanza 20 px por fotograma y no puede saltarse un objeto, porque la prueba `prev < d ≤ r` los cubre todos.
- **Sí:** `keyup` y `blur` vaciando `held` porque el movimiento es continuo, y se ignoran teclas con foco en un campo de texto para que teclear el nombre no mueva el submarino.

## Riesgos

| Riesgo                                                                             | Mitigación                                                                                                            |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Strict Mode monta el efecto dos veces y duplica el bucle                           | `destroy()` cancela el frame y quita `keydown`, `keyup` y `blur`; criterio de frames por segundo tras tres remontajes |
| Envíos repetidos al guardar                                                        | `ref` que bloquea al instante; criterio de tres clics seguidos                                                        |
| Una flecha se queda mantenida tras pausar, perder el foco o abrir el modal         | `pause()`, `resume()`, `restart()` y `blur` vacían `held`; criterio de PAUSA                                          |
| Un objeto se salta el anillo en un fotograma largo                                 | `dt ≤ 50 ms` (20 px por fotograma) y prueba de cruce `prev < d ≤ r`                                                   |
| El juego frustra: mueres sin haber visto la mina                                   | Es el tema; 5 minas en 39 celdas y 1,5 s de enfriamiento lo mantienen justo. La SPEC 20 añade las vidas               |
| Todas las perlas quedan lejos y el aire no alcanza                                 | Las perlas nacen a 2 celdas o más (≥ 200 px, 1,25 s de nado) y dan 6 s de aire                                        |
| Una portada con anillos y glow carga la tarjeta                                    | Se comprueba la captura y se ajusta el SVG sin tocar el resto                                                         |
| Si Supabase falla, `sonar` no aparece en la Biblioteca porque no tiene ficha local | Es el comportamiento de ASTEROIDES; criterio de degradación con clave inválida para el resto del catálogo             |

## Qué **no** está en esta spec

- Niveles, más minas, minas que se mueven y multiplicador por silencio (SPEC 19).
- Vidas, pantalla de espera, estela, partículas, sacudida y avisos visuales (SPEC 20).
- Sonido, assets, teclas WASD y ratón.
- Ranking por tiempo o donde menos puntos es mejor, y validación de puntuaciones en servidor.
- Cambios en los otros juegos, reales o placeholder.

Cada uno, si llega, va en su propia spec.
