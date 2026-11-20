# SPEC 17 — Apariencia del mando táctil igual al gamepad MK-II de referencia

> **Estado:** Aprobado
> **Depende de:** SPEC 16
> **Fecha:** 2026-11-17
> **Objetivo:** Que el mando táctil de los cuatro juegos reales tenga la apariencia del gamepad neón de `references/gamepad-assets/` (carcasa, cruceta con gema central y botones redondos A/B con anillo), sin cambiar su comportamiento ni los motores.

## Por qué existe esta spec

La SPEC 16 dejó el mando funcionando, pero con un aspecto genérico: cajas planas con el color de los tokens. En `references/gamepad-assets/` hay un diseño acabado, el «Gamepad MK-II» (`gamepad.html` y la captura `gamepad-neon.png`): una carcasa oscura con borde luminoso y textura de puntos, una cruceta de cuatro teclas con una gema cian pulsante en el centro y dos botones redondos (B cian, A magenta) con anillo punteado al pulsar.

Esta spec traslada ese aspecto al componente real. El comportamiento no cambia: los botones siguen emitiendo `KeyboardEvent` sintéticos según `mantener`/`repetir`/`pulso`, y `controles` en `catalog.ts` sigue declarando los mismos botones. Solo cambian la estructura del DOM del mando, sus estilos y un detalle nuevo: los botones también se iluminan con el teclado físico.

## Alcance

**Dentro:**

- `app/components/touch-controls.tsx`: reparto de los botones declarados entre una **cruceta** (flechas) y **botones redondos** (acciones), derivado del `code` y la `etiqueta`, sin tocar `catalog.ts`.
- Cruceta: cuatro teclas en cruz (arriba, abajo, izquierda, derecha) y centro con la gema pulsante. Solo se dibujan las teclas que el juego declara.
- Botones redondos: estilo A/B de la referencia (B cian, A magenta), con la `etiqueta` del botón dentro y anillo punteado al pulsar.
- Carcasa con borde interior, brillo exterior y rejilla de puntos.
- Iluminar el botón correspondiente cuando se pulsa la tecla física con el mismo `code`.
- Estilos en `app/globals.css` que sustituyen a los de `.touch-btn` de la SPEC 16: aspecto neón fijo, independiente de skin y modo claro/oscuro.
- Mantener la disposición de la SPEC 16: bajo el CRT en vertical y a ambos lados en apaisado, visible solo con `(pointer: coarse)`.
- Nota breve en `CLAUDE.md` sobre el reparto cruceta/redondos.

**Fuera de alcance (specs futuras):**

- Cambios en motores, `GameProps`, `components.tsx` y `catalog.ts` (los botones y sus modos no cambian).
- Campo `tipo` en `BotonTactil`: el reparto se deriva del `code` y la `etiqueta`.
- Teclas WASD, Z/X/J/K de la referencia: los motores no las leen y no se añaden.
- Cambiar el tema del mando con las skins o el modo claro/oscuro: es neón siempre.
- Vibración, sonido, gestos sobre el canvas y mando analógico (siguen fuera, como en la SPEC 16).
- Modificar `references/gamepad-assets/`: es solo referencia.
- Rediseño del resto de pantallas.

## Modelo de datos

No hay tablas ni migraciones y no cambia `BotonTactil`. La regla de reparto es una función pura dentro de `touch-controls.tsx`:

- Un botón es de **cruceta** si su `code` es `ArrowUp`, `ArrowDown`, `ArrowLeft` o `ArrowRight` **y** su `etiqueta` tiene un solo carácter (`◀`, `▶`, `▲`, `▼`). Es la misma condición que hoy decide la clase `dir`.
- El resto es de **acción** (redondo): `▲ IMPULSO`, `DISPARO`, `⟳ GIRAR`, `⤓ CAER`.
- Posición en la cruceta por `code`: `ArrowUp` arriba, `ArrowDown` abajo, `ArrowLeft` izquierda, `ArrowRight` derecha.
- Lado: la cruceta va siempre a la izquierda y las acciones a la derecha. El campo `zona` deja de decidir la posición (en SERPENTINA las cuatro flechas deben quedar juntas en la cruceta).

Resultado por juego:

| Juego           | Cruceta (izquierda) | Redondos (derecha)                  |
| --------------- | ------------------- | ----------------------------------- |
| `asteroides`    | ◀ ▶                 | ▲ IMPULSO (cian), DISPARO (magenta) |
| `caida`         | ◀ ▶ ▼               | ⟳ GIRAR (cian), ⤓ CAER (magenta)    |
| `bloque-buster` | ◀ ▶                 | ninguno                             |
| `serpentina`    | ▲ ▼ ◀ ▶             | ninguno                             |

Cuando no hay botones de acción (BLOQUE BUSTER, SERPENTINA), la cruceta se centra y no se dibuja la columna derecha. Los redondos se colorean por orden: primero cian, segundo magenta, y así alternando.

Estructura del componente (se mantienen `.touch-controls`, `.touch-zone izquierda` para la cruceta y `.touch-zone derecha` para las acciones, para no cambiar el layout de `game-player.tsx` ni las reglas apaisadas de la SPEC 16):

```tsx
<div className="touch-controls" aria-label="Mando táctil">
  <div className="touch-zone izquierda">   {/* cruceta */}
    <div className="gp-dpad">
      <button className="dp dp-up" .../> ... <div className="dp-hub"><span className="dp-hub-gem"/></div>
    </div>
  </div>
  <div className="touch-zone derecha">      {/* acciones */}
    <button className="ab ab-cian" ...><span className="ab-ring"/><span className="ab-letter">…</span></button>
  </div>
</div>
```

Estados de un botón, por atributo para no depender de clases de React: `data-pulsado` (toque, ya existe) y `data-tecla` (tecla física pulsada, nuevo). Ambos se estilan igual que `.on` de la referencia.

Iluminación por teclado: `touch-controls.tsx` escucha `keydown`/`keyup` de `window` mientras `activo` y pone o quita `data-tecla` en el botón cuyo `code` coincide; ignora `e.repeat` y los eventos cuyo origen es un campo de texto. Es independiente de `data-pulsado`, para que el `keyup` inmediato de un botón `pulso` no apague un botón que sigue tocado.

Tamaños (se mantienen los mínimos táctiles; **sustituyen** al criterio de 72 px en «dirección principal» de la SPEC 16): teclas de la cruceta de 64×64 px (cruceta de 192×192) y botones redondos de 76 px, nunca menos de 56 px.

Valores de color del neón, definidos dentro de `.touch-controls` y no con los tokens de skin (para que no cambien con el skin): cian `#00f5ff`, magenta `#ff006e`, fondo de la carcasa `linear-gradient(180deg, #1c1c28, #0c0c14)`, líneas `rgba(0, 245, 255, 0.18)`. La tipografía es `var(--pixel)`.

## Plan de implementación

Antes de empezar, leer `AGENTS.md` y lo necesario de Client Components en `node_modules/next/dist/docs/`. Invocar `/frontend-design` antes de estilar y abrir `references/gamepad-assets/gamepad.html` como fuente de los valores.

1. **Reparto y estructura.** En `touch-controls.tsx`, separar los botones en cruceta y acciones con la regla del modelo de datos y renderizar la nueva estructura de DOM, conservando `onPointerDown`/`Up`/`Cancel`/`LostPointerCapture`, `disabled`, `aria-label` y la liberación de teclas. Verificar: `npx tsc --noEmit`, `npx eslint app/components`; en `/jugar/serpentina` y `/jugar/asteroides` con emulación táctil los botones siguen emitiendo los mismos eventos que antes.
2. **Estilos neón en `globals.css`.** Sustituir `.touch-btn`, `.touch-btn.dir` y `.touch-btn[data-pulsado]` por `.gp-dpad`, `.dp`, `.dp-hub`, `.dp-hub-gem`, `.ab`, `.ab-ring`, `.ab-letter` y la carcasa (`.touch-controls` en vertical), tomando los valores de `gamepad.html`. Añadir `@keyframes pulse-led` y desactivar la animación con `prefers-reduced-motion: reduce`. Verificar captura a 390×844 comparada con `gamepad-neon.png`.
3. **Disposición y tamaños.** Vertical: carcasa única bajo el CRT. A 360 de ancho los dos redondos pasan a columna (`@media (max-width: 420px)`) para que no haya scroll horizontal. Apaisado: las dos zonas siguen a ambos lados del canvas, cada una con su carcasa (porque `.touch-controls` es `display: contents`), y la cruceta se reduce si el alto disponible no alcanza. Verificar 360×640, 390×844 y 844×390: sin scroll horizontal y, en apaisado, sin scroll vertical.
4. **Iluminación con teclado físico.** Añadir el efecto de `keydown`/`keyup` con `data-tecla`. Verificar con un teclado en una ventana táctil emulada: la tecla `ArrowLeft` enciende ◀ y al soltar se apaga; con PAUSA no se enciende.
5. **Verificación por juego.** En emulación táctil, probar los cuatro juegos con eventos de puntero reales: mismos modos que la SPEC 16 (ASTEROIDES mantener + multitoque, CAÍDA repetición, BLOQUE BUSTER paleta continua, SERPENTINA un giro por toque), ninguna tecla pegada tras PAUSA o FIN y sin listeners duplicados al salir y volver.
6. **Cierre.** `npm run lint`, `npm run build`; `git diff --stat` solo muestra `touch-controls.tsx`, `globals.css` y `CLAUDE.md`; comprobar en escritorio que el mando sigue sin aparecer; añadir la nota a `CLAUDE.md`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `git diff` solo cambia `app/components/touch-controls.tsx`, `app/globals.css` y `CLAUDE.md`; no hay cambios en `app/games/` ni en `game-player.tsx`.
- [ ] El mando tiene carcasa con borde interior luminoso, rejilla de puntos y brillo exterior como en `gamepad-neon.png`.
- [ ] `/jugar/serpentina` muestra una cruceta con las cuatro teclas ▲ ▼ ◀ ▶ y gema cian pulsante en el centro, y ningún botón redondo.
- [ ] `/jugar/asteroides` muestra cruceta con ◀ ▶ y dos redondos: IMPULSO cian y DISPARO magenta.
- [ ] `/jugar/caida` muestra cruceta con ◀ ▶ ▼ y dos redondos: GIRAR cian y CAER magenta.
- [ ] `/jugar/bloque-buster` muestra solo la cruceta con ◀ ▶, centrada.
- [ ] Al tocar un botón se hunde y se ilumina (cian en cruceta, glow de su color en los redondos); en los redondos aparece el anillo punteado.
- [ ] Las teclas de la cruceta miden al menos 56×56 px y los redondos al menos 72 px.
- [ ] El comportamiento no cambia: los modos `mantener`, `repetir` y `pulso` emiten los mismos eventos que en la SPEC 16, el multitoque funciona por botón y no queda ninguna tecla pegada tras PAUSA, FIN o SALIR.
- [ ] Con PAUSA o el modal «FIN DEL JUEGO» abierto el mando no emite eventos y se ve deshabilitado.
- [ ] Pulsar una tecla física (por ejemplo `ArrowLeft`) ilumina el botón con ese `code` y al soltarla se apaga; no se ilumina con el juego pausado ni al escribir en un campo de texto.
- [ ] Un botón `pulso` sigue iluminado mientras se mantiene el dedo, aunque su `keyup` sintético sea inmediato.
- [ ] A 360×640 y 390×844 el mando cabe sin scroll horizontal; a 844×390 queda a ambos lados del canvas sin scroll vertical ni horizontal.
- [ ] El aspecto neón es el mismo en modo claro, modo oscuro y en las tres skins.
- [ ] Con `prefers-reduced-motion: reduce` la gema no se anima.
- [ ] En escritorio con ratón (`pointer: fine`) el mando no aparece.
- [ ] Probado en al menos un móvil real (comprobación manual del usuario: aspecto, toques y orientación).

## Decisiones tomadas y descartadas

- **Sí:** repartir los botones en cruceta (flechas) y botones redondos (acciones), como el gamepad de referencia. Respuesta del usuario (opción recomendada). Reproduce la referencia de verdad en lugar de solo recolorear cajas.
- **No:** conservar la rejilla de dos zonas y aplicar solo el estilo a cada botón. Es menos trabajo, pero no se parece a la referencia.
- **Sí:** derivar el reparto de `code` y `etiqueta`, sin campo nuevo en `catalog.ts`. Respuesta del usuario (opción recomendada). La etiqueta de un solo carácter distingue la flecha de `▲ IMPULSO` y `⟳ GIRAR`, que también usan `ArrowUp`.
- **No:** campo `tipo` en `BotonTactil`. Es más explícito, pero cambia el registro y obliga a tocar `catalog.ts`; queda como seguimiento si un juego nuevo choca con la regla.
- **Sí:** la cruceta va siempre a la izquierda y las acciones a la derecha, y `zona` deja de decidir la posición. Sin esto, SERPENTINA (▲▼ declaradas a la derecha) partiría la cruceta en dos.
- **Sí:** neón fijo, independiente de skin y de modo claro/oscuro. Respuesta del usuario (opción recomendada). El mando es un periférico oscuro con brillo cian/magenta; esto sustituye al criterio de «legible en claro/oscuro y skins» de la SPEC 16 por «igual en todos».
- **Sí:** entran los cuatro extras de la referencia: carcasa con rejilla de puntos, gema pulsante, anillo punteado al pulsar e iluminación con teclado físico. Respuesta del usuario.
- **Sí:** la iluminación por teclado usa un atributo propio (`data-tecla`), separado de `data-pulsado`. Así el `keyup` inmediato de un botón `pulso` no apaga un botón que sigue tocado.
- **Sí:** solo se iluminan las teclas que el motor ya lee (el `code` de cada botón). No se copian WASD/ZXJK de la referencia porque ningún motor las lee.
- **Sí:** teclas de cruceta de 64 px y redondos de 76 px, por encima del mínimo de 56 px. Cambia el criterio de 72 px para «dirección principal» de la SPEC 16, que se aplica ahora solo a los redondos; con 72 px las cuatro teclas, la cruceta mediría 216 px y no cabría en 360 de ancho.
- **Sí:** a 360 de ancho los redondos se apilan en columna. La cruceta (192 px) más dos redondos en fila (≥ 160 px) más la carcasa no caben en 336 px.
- **Sí:** la etiqueta del botón (`▲ IMPULSO`, `DISPARO`) va dentro del redondo en letra pequeña, y no la letra A/B de la referencia: el jugador debe saber qué hace cada botón.
- **No:** copiar el HTML de la referencia tal cual. Es una página independiente con su propio script; se traslada solo el CSS y la estructura al componente React existente.

## Riesgos

| Riesgo                                                                                                | Mitigación                                                                                      |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| La cruceta de 192 px y los efectos ocupan demasiado alto en apaisado de 390 px                        | Reducir la cruceta con `clamp()` y el alto en `dvh`; comprobar 844×390 sin scroll vertical      |
| Una `etiqueta` larga no cabe en el redondo de 76 px con la fuente pixel                               | Letra de 8 px, glifo y texto en dos líneas; comprobar `DISPARO` e `IMPULSO` en 360 de ancho     |
| Un juego nuevo con una flecha de una letra pensada como acción acaba en la cruceta                    | La regla está documentada en `CLAUDE.md`; si ocurre se valora el campo `tipo` en otra spec      |
| Los sombreados y brillos (`box-shadow`, `filter: drop-shadow`) bajan el rendimiento en móviles lentos | Pocas capas de sombra y sin animaciones salvo la gema; se comprueba en el móvil real            |
| El neón fijo desentona con una skin clara                                                             | Aceptado: el mando es un periférico oscuro; se revisa en las tres skins y en ambos modos        |
| La iluminación por teclado se dispara por eventos sintéticos del propio mando                         | Es inocua: los dos atributos son independientes y el resultado visual es el mismo               |
| La carcasa en apaisado se duplica (una por lado) y roba ancho al canvas                               | Relleno reducido en apaisado; el canvas sigue calculado con `dvh`, no con el ancho de los lados |

## Qué **no** está en esta spec

- Cambios en motores, `catalog.ts`, `game-player.tsx` y el comportamiento de los botones.
- Campo `tipo` en `BotonTactil` y mapas de teclas alternativas (WASD, Z/X/J/K).
- Temas del mando según skin o modo claro/oscuro.
- Vibración, sonido, gestos, joystick analógico y Gamepad API.
- Rediseño móvil del resto de pantallas.

Cada uno, si llega, va en su propia spec.
