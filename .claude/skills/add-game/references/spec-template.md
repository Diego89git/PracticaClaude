# Esqueleto de la spec de un juego

Plantilla de `specs/NN-slug.md` para integrar un juego. Sustituye cada `{{...}}` con lo que respondió el usuario y borra los comentarios `<!-- -->` y las variantes que no apliquen. Este esqueleto aporta el **contenido** propio de un juego. El **formato** (cabecera, orden y títulos de las secciones, idioma, palabras de estado, tono) se toma del skill `/spec` (`SKILL.md` y `template.md`) y de las specs existentes, que el paso 3 de `SKILL.md` obliga a leer antes de escribir. Si chocan con este esqueleto, mandan ellos y se avisa al usuario de que el esqueleto está desactualizado.

Reglas de redacción (las de `/spec`):

- Una frase en el objetivo. Si no cabe, el juego es demasiado grande: propón dividirlo.
- Nombres concretos de archivos, rutas y valores; nada de "el módulo de niveles".
- Criterios booleanos y verificables. Nunca "funciona bien".
- Sin TODOs: una decisión pendiente se anota como pendiente, con su motivo.
- Estado `Borrador` (o la palabra equivalente que usen las specs recientes), fecha obtenida con `date +%F` o del contexto de la sesión, número = el mayor de `specs/` + 1.

---

````markdown
# SPEC {{NN}} — {{TITULO}}

> **Estado:** Borrador
> **Depende de:** SPEC 01, SPEC 03, SPEC 05, SPEC 06 <!-- y la spec del registro si ya existe -->
> **Fecha:** {{AAAA-MM-DD}}
> **Objetivo:** Añadir el juego {{TITULO}} ({{portado desde references/started-games/NN-nombre | creado desde cero}}) al catálogo de Arcade Vault, jugable en `/jugar/{{id}}` y con su leaderboard real en Supabase.

## Por qué existe esta spec

{{2-4 frases: qué juego es, de dónde viene, y qué patrón sigue.}} Sigue la receta de `.claude/skills/add-game/references/pattern.md`, establecida por las SPEC 05 (motor y reproductor) y 06 (tablas y leaderboard).

## Alcance

**Dentro:**

- Fila `{{id}}` en la tabla `games` de Supabase, con su migración en `supabase/migrations/`.
- Portada `.cover-{{id}}` en `app/globals.css`.
- Motor en `app/games/{{id}}/engine.ts`: {{código de references/started-games/NN-nombre portado a TypeScript | lógica nueva descrita en el modelo de datos}}, con las adaptaciones obligadas (canvas por parámetro, listeners con limpieza, callbacks hacia el HUD).
- Componente cliente `app/components/{{id}}-game.tsx`.
- Entrada de `{{id}}` en el registro de juegos (`app/games/catalog.ts` y `app/games/components.tsx`).
- HUD de la plataforma alimentado por el motor: {{Puntuación, Vidas, Nivel | solo los que el juego use}}.
- PAUSA, FIN, JUGAR DE NUEVO y GUARDAR PUNTUACIÓN con el juego real; puntuación guardada en `scores`.
- Mecánicas del original sin cambios: {{lista corta}}.
- Control solo con teclado: {{teclas}}. Las flechas y ESPACIO no hacen scroll.
{{- Assets copiados a `public/games/{{id}}/`: {{lista}}.}}

**Fuera de alcance (specs futuras):**

- {{Controles de ratón o táctiles | cualquier entrada que el original tenga y la plataforma no soporte}}.
- Cambios de balance, mecánicas nuevas o recoloreo del juego.
- {{Campos del original que la plataforma no muestra (p. ej. líneas): se descartan o se dibujan en el canvas, según se decida}}.
- Ranking por tiempo o donde menos puntos es mejor.
- Validación de puntuaciones en servidor.
- Cualquier cambio en los otros juegos.

## Modelo de datos

Fila de `games` (migración `supabase/migrations/<timestamp>_game_{{id}}.sql`):

```sql
insert into public.games (id, title, short, long, cat, cover, color) values (
  '{{id}}', '{{TITULO}}', '{{frase corta}}', '{{descripción larga}}',
  '{{ARCADE|PUZZLE|SHOOTER|VERSUS}}', 'cover-{{id}}', '{{cyan|magenta|yellow|green}}'
);
```

Entrada del registro (`app/games/catalog.ts`):

```ts
{{id}}: { hud: { vidas: {{true|false}}, nivel: {{true|false}} } },
```

Motor: `create{{Id}}(canvas: HTMLCanvasElement, events: GameEvents): GameEngine`, con el contrato de `references/pattern.md`. Constantes propias del juego: {{tablero, velocidades, puntos... con valores}}.

Convenciones: canvas de {{W}}×{{H}} px {{(4:3)|(se centra con barras negras en el marco CRT)}}; tiempos en segundos; `dt` limitado a 50 ms.

## Plan de implementación

Antes de empezar, leer `.claude/skills/add-game/references/pattern.md` (sobre todo la sección 7, "Trampas") y, en `node_modules/next/dist/docs/`, lo que haga falta de Client Components y Cache Components, según exige `AGENTS.md`. Usar `/frontend-design` para la portada.

<!-- Variante A: SOLO si el registro NO existe (catalog.ts ausente). Desde la SPEC 07 existe, así que lo normal es la variante B: omite este paso 1 y empieza por la ficha. -->
<!-- Si el juego reemplaza a un placeholder con su mismo id (como `caida`): no se crea portada ni se quita la entrada local de app/data.ts; ver pattern.md sección 7, punto 15. -->
1. **Registro de juegos.** Crear `app/games/types.ts`, `catalog.ts` y `components.tsx`; mover a `types.ts` los eventos y props de ASTEROIDES; sustituir en `game-player.tsx` el `game.id === "asteroides"` por `esJuegoReal` y `COMPONENTES[game.id]`; ocultar Vidas y Nivel del HUD según `hud`; pasar `tieneRankingReal` a `esJuegoReal` en `app/juegos/[id]/page.tsx` y `hall-of-fame.tsx`. Verificar: `tsc`, `eslint` y ASTEROIDES se juega y se guarda exactamente igual que antes.

<!-- Pasos del juego (en la variante B son los pasos 1 a 5) -->
{{N}}. **Ficha.** Crear la migración con la fila de `games` y aplicarla con `apply_migration` **tras pedir confirmación al usuario**. Añadir `.cover-{{id}}` a `app/globals.css`. Verificar: `list_tables` y una consulta muestran la fila; `/biblioteca` muestra {{N+1}} tarjetas; `/juegos/{{id}}` carga con ranking vacío; `/jugar/{{id}}` aún muestra el placeholder.
{{N+1}}. **Motor.** Crear `app/games/{{id}}/engine.ts` desde `assets/engine.ts.tpl`{{ portando el código de references/started-games/NN-nombre según references/porting.md}}. Verificar: `npx tsc --noEmit`, `npx eslint app/games` y `node .claude/skills/add-game/scripts/engine-smoke.mjs app/games/{{id}}/engine.ts create{{Id}}`.
{{N+2}}. **Componente.** Crear `app/components/{{id}}-game.tsx` desde `assets/game-component.tsx.tpl`{{ y copiar los assets a `public/games/{{id}}/`}}.
{{N+3}}. **Registro.** Añadir `{{id}}` a `catalog.ts` y `components.tsx`. Verificar en el navegador: `/jugar/{{id}}` muestra el canvas, el HUD se actualiza, PAUSA congela, FIN abre el modal.
{{N+4}}. **Cierre.** `npm run lint`, `npm run build` sin trazas de error, `get_advisors` de seguridad sin avisos, `node .claude/skills/add-game/scripts/rls-check.mjs {{id}}` y una partida completa hasta verla en `/juegos/{{id}}` y en `/salon`. Borrar todas las filas de prueba de `scores`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] La tabla `games` contiene la fila `{{id}}` con `cover-{{id}}` y color `{{color}}`; `supabase/migrations/` contiene su migración.
- [ ] `/biblioteca` muestra {{N+1}} tarjetas y la de {{TITULO}} usa una portada distinta de las demás.
- [ ] `/juegos/{{id}}` muestra título, descripción larga y, sin puntuaciones, "Sé el primero en entrar al salón de la fama".
- [ ] `/jugar/{{id}}` muestra el juego real en un canvas de {{W}}×{{H}} dentro del marco CRT, sin el placeholder; los juegos que no son reales siguen con el placeholder.
- [ ] El canvas no dibuja HUD ni "GAME OVER".
- [ ] {{Un criterio por mecánica del juego, con números: "Completar una línea suma 100", "Chocar resta una vida y la nave reaparece a los 2 s"...}}
- [ ] Las flechas y ESPACIO no hacen scroll de la página mientras se juega.
- [ ] PAUSA congela el juego y muestra "EN PAUSA"; REANUDAR continúa.
- [ ] El fin de partida abre el modal "FIN DEL JUEGO" con la puntuación final; FIN abre el mismo modal.
- [ ] Con el modal abierto, ESPACIO no cambia la puntuación y teclear el nombre no mueve el juego.
- [ ] El nombre se pre-rellena desde `localStorage["av_player_name"]`; GUARDAR PUNTUACIÓN inserta una fila en `scores` con `game_id: "{{id}}"` y `user_id: null`.
- [ ] El botón se deshabilita durante el envío: tres clics seguidos insertan una sola fila.
- [ ] Si el insert falla, el modal muestra un error, no muestra "PUNTUACIÓN GUARDADA" y permite reintentar.
- [ ] La puntuación guardada aparece en `/juegos/{{id}}` y en la pestaña de {{TITULO}} de `/salon`.
- [ ] JUGAR DE NUEVO deja {{valores iniciales}}.
- [ ] Salir de `/jugar/{{id}}` y volver no duplica el bucle: los frames por segundo no aumentan tras tres remontajes.
- [ ] El canvas se ve completo sin scroll horizontal a 1440 px y a 768 px.
- [ ] Con la clave publishable, el `INSERT` válido en `scores` pasa, los inválidos se rechazan y `UPDATE`/`DELETE` no modifican filas.
- [ ] `/juegos/no-existe` y `/jugar/no-existe` muestran la pantalla 404 <!-- no "devuelven 404": en producción responden 200, ver pattern.md sección 7 -->.
- [ ] Con una clave de Supabase inválida, `/biblioteca` sigue respondiendo 200 con los juegos locales.
- [ ] `scores` no contiene filas de prueba al terminar.
- [ ] Los demás juegos (reales y placeholder) se comportan como antes.

## Decisiones tomadas y descartadas

<!-- Una por línea, con el motivo. Incluye siempre las que respondió el usuario. Ejemplos: -->
- **Sí:** id `{{id}}` en minúsculas y español, coherente con el catálogo.
- **Sí:** el HUD, la pausa, FIN y el modal los pone la plataforma; se retiran del canvas.
- **Sí:** ranking real con puntuación mayor = mejor; `best` y `plays` calculados desde `scores`.
- **Sí:** {{decisión sobre entrada (ratón/táctil), assets, estado de victoria, vista previa, campos sin HUD...}}.
- **No:** {{lo descartado y por qué}}.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Strict Mode monta el efecto dos veces y duplica el bucle | `destroy()` cancela el frame y quita los listeners; criterio de frames por segundo |
| Envíos repetidos al guardar | `ref` que bloquea al instante; criterio de tres clics seguidos |
| {{riesgo propio del juego}} | {{mitigación}} |

## Qué **no** está en esta spec

- {{lista, repetida del alcance}}.

Cada uno, si llega, va en su propia spec.
````

---

## Detalles al rellenar

- **`Depende de`:** SPEC 01 (reproductor), 03 (cliente de Supabase), 05 (patrón de motor) y 06 (tablas), más la del registro si ya existe. Comprueba que cada una existe en `specs/`; si no, dilo en lugar de escribir una referencia colgante.
- **Contar tarjetas:** `getCatalogo` suma los 8 placeholders de `app/data.ts` y los juegos de Supabase. Con ASTEROIDES son 9; cada juego nuevo suma una.
- **Criterios de mecánicas:** cada regla del juego original (puntos, vidas, niveles, power-ups, condiciones de fin) es un criterio con su número. Sácalos del código leído, no de memoria.
- **Pasos pequeños:** si un paso supera unas 50 líneas de código, divídelo; cada paso debe dejar la app funcionando y poder commitearse solo.
