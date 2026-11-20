# Portar un juego a Arcade Vault (o crearlo desde cero)

Los juegos de `references/started-games/` son JavaScript puro, sin dependencias ni bundler: una página `index.html` con uno o varios `<script>` que usan variables globales y leen o escriben el DOM. Arcade Vault es una app Next.js en TypeScript estricto. Portar es traducir esa forma al contrato de `pattern.md` (motor sin React + componente), **sin cambiar las mecánicas**.

**Contenido:** 1 Elegir el modo · 2 Inventario · 3 Receta de portado · 4 Decisiones habituales · 5 Notas por juego · 6 Desde cero

## 1. Elegir el modo

- **Portar:** el usuario nombra un juego de `references/started-games/` (o dice "el de tetris"). Léelo antes de preguntar: su `CLAUDE.md`/`README.md`, `index.html` y los `.js`.
- **Desde cero:** no hay código previo. Redacta la spec con las mecánicas que describa el usuario y escribe el motor desde `assets/engine.ts.tpl`.
- **Mixto:** hay un juego de referencia pero el usuario quiere cambios. Porta primero lo existente y deja los cambios como pasos aparte de la spec; mezclar ambas cosas hace imposible comprobar que el portado conserva el original.

Las carpetas de `references/` traen sus propios `CLAUDE.md`, specs, `.agents/`, `.github/` y `.claude/`: son del proyecto original, no se copian ni se siguen.

## 2. Inventario (qué mirar antes de preguntar)

Apunta, para el juego de referencia:

| Qué                                   | Por qué importa                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| Número y tamaño de los `<canvas>`     | La plataforma da un canvas en un marco 4:3; otros formatos van con barras    |
| Qué escribe en el DOM (`getElementById`, `textContent`) | Cada uno es un HUD o un overlay que la plataforma ya pone  |
| Overlays de pausa/fin y botones       | Se eliminan: PAUSA, FIN y el modal son de la plataforma                      |
| Teclas, ratón, táctil                 | La plataforma solo soporta teclado hoy (ver sección 4)                       |
| Archivos extra (`levels.js`, sprites, sonidos) | Pasan a módulos y a `public/games/<id>/`                            |
| Estados (`playing`, `paused`, `gameover`, `win`) | Hay que decidir cómo mapean al contrato (sección 4)               |
| `localStorage`, temas, ajustes propios | No se portan: la plataforma tiene su sesión y su tema                       |
| Líneas de código (`wc -l`)            | Estima el tamaño del paso del motor; si pasa de unas 600 líneas, divídelo   |

## 3. Receta de portado

1. **Crear `app/games/<id>/engine.ts`** desde `assets/engine.ts.tpl` y mover la lógica dentro de `createX(canvas, events)`.
2. **Globales → estado de cierre.** Cada `let`/`const` de nivel superior que cambie durante la partida pasa a vivir dentro de la función. Las constantes y las clases (`Bullet`, `Asteroid`...) pueden quedarse a nivel de módulo si no guardan estado de partida y reciben el `ctx` por parámetro.
3. **Quitar `document.getElementById`.** El canvas llega por parámetro. Cualquier otro elemento del DOM (HUD, overlay, botones) desaparece; su información sale por los callbacks o la muestra la plataforma.
4. **HUD → callbacks.** La puntuación va a `onScoreChange`, las vidas a `onLivesChange`, el nivel a `onLevelChange`. Datos propios que la plataforma no tiene (líneas de Tetris, por ejemplo) se pueden dibujar en el canvas o descartar: decídelo en la spec.
5. **Pérdida de partida → `onGameOver(score)`** exactamente una vez, tras notificar los demás cambios. Quita el reinicio propio (botón o tecla): reinicia `restart()`.
6. **Entrada → `keydown`/`keyup` en `window`** (no en `document`) con `e.code`, ignorando campos de texto y con limpieza en `destroy()`. Si el original usa `e.key`, pasa a `e.code` para no depender de la distribución del teclado.
7. **Tecla de pausa propia (P, Esc):** elimínala. La pausa es el botón PAUSA de la plataforma y dos vías distintas se desincronizan.
8. **Dibujo:** deja el original tal cual salvo lo que lea del DOM o de CSS (p. ej. `getComputedStyle(document.body).getPropertyValue('--grid-line')`): sustitúyelo por una constante.
9. **Tipos mínimos.** Anota lo que TypeScript exija; no reescribas la lógica. Prettier reformateará el archivo, así que compara por comportamiento, no por diff literal.
10. **Probar el motor** con `scripts/engine-smoke.mjs` antes de montarlo en la página.
11. **Componente** desde `assets/game-component.tsx.tpl`; ajusta `width`/`height` del `<canvas>` y las constantes `W`/`H` del motor al tamaño original.

## 4. Decisiones habituales (llévalas a las preguntas de la spec)

- **Canvas que no es 4:3** (800×600 sí lo es). Se mantiene el tamaño lógico del original y `object-fit: contain` lo centra con barras. Alternativa: ampliar el canvas lógico a 4:3 y dibujar paneles laterales dentro (útil si el juego tenía una barra lateral).
- **Varios canvases** (vista previa de la siguiente pieza): dibujarlos todos en el canvas principal, ampliando su tamaño lógico. El componente solo gestiona un canvas.
- **Campos del HUD que el juego no tiene** (sin vidas, sin niveles): el registro tiene `hud: { vidas, nivel }`; ponlos a `false` para ocultarlos. Un juego sin vidas pierde cuando se cumple su condición de fin: llama a `onGameOver` sin pasar por las vidas.
- **Estado de victoria (`win`):** la plataforma solo conoce el fin de partida. Lo habitual es llamar a `onGameOver(score)` también al ganar; si el juego debe distinguirlo, es otra spec.
- **Assets:** copiar a `public/games/<id>/` y referenciar con ruta absoluta (`/games/<id>/sprites.png`), no relativa. Las imágenes se cargan antes del primer dibujo y los sonidos con `new Audio(...)`. Los navegadores solo reproducen audio tras un gesto del usuario; entrar con un clic desde la ficha lo cumple, pero prueba un sonido real.
- **Ratón o táctil:** la plataforma soporta teclado. Si el original depende del ratón (p. ej. mover la paleta), la spec debe decidir: añadir teclado, mantener el ratón escuchando solo sobre el canvas, o dejarlo fuera de alcance. No lo asumas.
- **Varios archivos `.js`** (`levels.js`, `spritesheet.js`): módulos TypeScript en `app/games/<id>/`, importados por el motor. Los datos de niveles se conservan idénticos.
- **Sonido y animaciones extra:** forman parte del juego original, así que se portan salvo que el usuario decida lo contrario. Si no, quedan fuera de alcance de forma explícita.
- **Ajustes propios del original** (tema claro/oscuro, `localStorage` propio): no se portan.
- **Nombre del archivo y funciones:** `createTetris`, `TetrisGame`, `app/games/tetris/engine.ts`, `app/components/tetris-game.tsx`. El id en minúsculas y en español si hay traducción natural (`asteroides`).

## 5. Notas por juego de referencia

Verifica cada dato leyendo el código: esto es lo que se vio al preparar el skill.

### `02-asteroids` — ya integrado (SPEC 05)

Un solo `game.js` de 510 líneas, canvas 800×600, 3 vidas, niveles, power-up de triple disparo. Es la implementación de referencia: `app/games/asteroides/engine.ts` y `app/components/asteroides-game.tsx`.

### `03-tetris` — ya integrado (SPEC 07, id `caida`)

Implementación: `app/games/caida/engine.ts` y `app/components/caida-game.tsx`. Decisiones que se tomaron y conviene repetir en juegos parecidos: canvas lógico de 800×600 con el tablero a la izquierda y un panel lateral dibujado (siguiente pieza y líneas); entrada por evento `keydown` con auto-repetición, como el original; 7 piezas (el código tenía una 8.ª «tuerca» que se quitó por decisión del usuario); HUD sin Vidas; el Tetris reemplazó al placeholder `caida`. Notas originales del análisis:

- `index.html` con `<canvas id="board">` de **300×600**, `<canvas id="next-canvas">` de 120×120 y un HUD en el DOM (`#score`, `#lines`, `#level`). `game.js` de unas 330 líneas.
- Un **overlay compartido** (`#overlay`) para PAUSA y GAME OVER, con botón de reinicio: se elimina.
- **Sin vidas:** acaba cuando la pieza nueva colisiona al aparecer. En el registro, `hud: { vidas: false, nivel: true }`. El nivel sube con las líneas (`floor(lines/10)+1`).
- Teclas con `e.code`: flechas, `KeyX` (girar), `Space` (caída rápida), `KeyP` (pausa, se elimina). Escucha en `document`: pasa a `window`.
- Lee el DOM y el CSS: `scoreEl`, `linesEl`, `levelEl`, `getComputedStyle(...).getPropertyValue('--grid-line')`. Hay un **selector de tema claro/oscuro** con `localStorage('tetris-theme')`: no se porta.
- Decisiones a preguntar: qué hacer con la vista previa (dibujarla en el canvas principal), con las líneas (dibujar en el canvas o descartar) y con el canvas 1:2 (barras laterales).

### `04-arkanoid` — pendiente

- `index.html` carga tres scripts: `assets/spritesheet.js`, `levels.js` y `game.js`. Canvas **800×600** (4:3), `game.js` de unas 270 líneas, `levels.js` con 5 niveles.
- **Assets:** `assets/spritesheet-breakout.png` (cargado con `loadSpritesheet(cb)`, asíncrono) y dos sonidos `.mp3` con rutas relativas (`new Audio('assets/sounds/...')`). Van a `public/games/arkanoid/` con rutas absolutas, y el motor debe esperar a la imagen antes del primer dibujo.
- **Ratón:** `canvas.addEventListener('click', ...)` y `mousemove` (lanzar la pelota y mover la paleta). La plataforma es solo teclado: **es una decisión de la spec** (ver sección 4).
- Teclado con `e.key` (`ArrowLeft`/`ArrowRight`); pausa con `P` o `Esc` (se elimina).
- Estados `playing | paused | gameover | win`, 3 vidas, nivel. La victoria se mapea según la sección 4.
- Trae sus propias specs, `.agents/skills` y `skills-lock.json`: ignorarlos.

## 6. Desde cero

1. Pregunta lo mínimo para escribir la spec: objetivo del juego y cómo se pierde o gana, controles (teclado), cómo se puntúa (más es mejor), si hay vidas y niveles, progresión de dificultad, qué hay en pantalla.
2. Empieza desde `assets/engine.ts.tpl`; la lógica nueva se describe en la spec con fórmulas y constantes concretas (velocidades, puntos, tiempos), no con adjetivos: "la pelota acelera un 5 % por bloque" es verificable, "se siente rápido" no.
3. Mantén el motor pequeño. Si el juego crece, es mejor dividir la spec en varias que una sola con decisiones en cuatro dominios.
4. Todo lo demás (ficha, portada, registro, leaderboard) es igual que en un portado.
