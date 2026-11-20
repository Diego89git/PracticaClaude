---
name: add-game
description: Diseña la integración de un juego nuevo en Arcade Vault (portarlo desde references/started-games, como tetris o arkanoid, o crearlo desde cero) con su ficha en Supabase, su portada y su leaderboard real, y deja la spec lista en specs/ para implementarla con /spec-impl, copiando el formato del skill /spec y de las specs ya escritas. Úsalo siempre que el usuario pida agregar, integrar, portar, adaptar, migrar o crear un juego, o un leaderboard o ranking para un juego, o mencione references/started-games, aunque no diga "skill" ni "spec". No lo uses para cambiar la jugabilidad de un juego ya integrado, ni para los juegos placeholder, ni para tareas que no sean añadir un juego.
---

# add-game — integrar un juego nuevo en Arcade Vault

Las SPEC 05 (motor y reproductor de ASTEROIDES) y 06 (tablas `games` y `scores` y leaderboard real) abrieron el camino para el primer juego. Este skill convierte ese trabajo en una receta repetible, para que cada juego nuevo sea una spec y no una investigación desde cero. Cada trampa que costó una vuelta de depuración está documentada en `references/pattern.md`.

**Produce una spec en `specs/`, no código.** El proyecto sigue Spec Driven Design y `/spec-impl` solo implementa specs aprobadas: corregir una spec cuesta minutos, corregir un juego a medio portar cuesta horas. La implementación la hará `/spec-impl`, que seguirá la receta que la spec cita.

## Qué leer y cuándo

| Archivo                                          | Léelo cuando                                                                                           |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `~/.claude/skills/spec/SKILL.md` y `template.md` | Siempre, justo antes de crear el archivo de la spec (paso 3): formato, secciones y reglas de redacción |
| `specs/*.md`                                     | Siempre, justo antes de crear el archivo (paso 3): las dos últimas, la 05, la 06 y la última de juego  |
| `references/pattern.md`                          | Siempre, antes de redactar: arquitectura, contratos, trampas y verificación                            |
| `references/porting.md`                          | El juego viene de `references/started-games/` o hay que decidir entrada, assets, HUD y canvas          |
| `references/spec-template.md`                    | Al escribir la spec: esqueleto con las secciones y los criterios habituales                            |
| `assets/*.tpl`                                   | No se copian aquí; la spec los cita para el paso de implementación                                     |
| `scripts/*.mjs`                                  | No se ejecutan aquí; la spec los cita en el paso de verificación                                       |

## Flujo

Sigue las fases de `/spec`: entender, preguntar, escribir, guardar, con una parada obligatoria antes de escribir para **leer el skill `/spec` y las specs existentes** (paso 3). Si te invocaron con un texto (`/add-game tetris`), úsalo como descripción inicial; si no, pide una frase.

### 1. Reconocer el estado del repo (antes de preguntar)

Lo que ya puedes saber no se le pregunta al usuario.

- Lee `CLAUDE.md` y `AGENTS.md` y haz `ls specs` para ver qué specs hay y cómo se numeran. Su lectura a fondo, para copiar el formato, es el paso 3.
- Compara el repo con el "Estado conocido" de `references/pattern.md`. Mira sobre todo si existe `app/games/catalog.ts`: si **no** existe, la spec lleva el paso del registro de juegos (variante A del esqueleto); si existe, no (variante B).
- Averigua qué juegos reales hay y qué ids están ocupados: `ls app/games`, `supabase/migrations/` y, con el MCP de Supabase, `select id from public.games` (solo lectura).
- Si el usuario nombra un juego de `references/started-games/`, léelo ya: su `CLAUDE.md` o `README.md`, `index.html`, los `.js` y un `wc -l`, buscando lo que indica la sección 2 de `references/porting.md` (DOM, teclado y ratón, assets, estados).
- Si el repo y `pattern.md` discrepan, manda el repo. Dilo al final: la receta está desactualizada y conviene corregirla.

### 2. Preguntar

Bloques de 3 a 5 preguntas concretas, con `AskUserQuestion`, la recomendación primero y marcada. Estas son las que casi siempre hacen falta; salta las que el usuario ya respondió o el código resuelve:

1. **Fuente:** qué juego de `references/started-games/` o, desde cero, cómo se juega, cómo se gana o se pierde y cómo se puntúa.
2. **Identidad:** `id` (minúsculas, con guiones, en español si hay traducción natural, sin erratas: forma la URL), título, categoría (`ARCADE`, `PUZZLE`, `SHOOTER`, `VERSUS`) y color (`cyan`, `magenta`, `yellow`, `green`). Propón tú el texto corto y el largo de la ficha, en español, y pide que lo revise.
3. **HUD:** ¿tiene vidas? ¿niveles? Lo que no tenga se oculta. Los datos propios que la plataforma no muestra (líneas, tiempo) se dibujan en el canvas o se descartan.
4. **Entrada:** las teclas. La plataforma es solo teclado; si el original usa ratón o táctil, decidir: añadir teclado, conservar el ratón sobre el canvas o dejarlo fuera.
5. **Assets y sonido:** sprites, sonidos y niveles del original, y si se portan.
6. **Fin y victoria:** qué cuenta como fin de partida y cómo se trata una victoria (lo habitual: `onGameOver` también al ganar).
7. **Canvas:** si no es 4:3, barras laterales o ampliar el canvas con paneles.
8. **Alcance del original:** qué mecánicas, animaciones o ajustes se conservan y cuáles se recortan.

Ya están resueltas por el patrón y no se reabren: el HUD, la pausa y el modal los pone la plataforma; el ranking es real y mayor puntuación = mejor; solo la clave publishable, con RLS; un solo reinicio (JUGAR DE NUEVO); la ficha vive en Supabase y no en `app/data.ts`.

Si el juego no cabe en una frase, o implica decisiones en cuatro o más dominios, propón dividirlo en varias specs antes de seguir.

Para de preguntar cuando puedas responder sin suponer: qué archivos aparecen o cambian, cuál es el primer paso y cuál el último, y cómo se verifica que está terminado.

### 3. Leer las referencias de formato (obligatorio, justo antes de escribir)

No crees el archivo de la spec sin haber leído, en esta conversación y con `Read`, lo que sigue. El formato del proyecto vive en el skill `/spec` y en las specs ya escritas, no en tu memoria, y cambia (palabras de estado, encabezados, orden de secciones, tono): una spec que no lo copia hay que rehacerla antes de poder aprobarla. Léelas siempre, aunque ya las hayas visto antes: pueden haber cambiado.

1. **El skill `/spec`:** `~/.claude/skills/spec/SKILL.md` y `~/.claude/skills/spec/template.md` (en Windows, `C:\Users\<usuario>\.claude\skills\spec\`). Si no están ahí, prueba `.claude/skills/spec/` dentro del proyecto; si tampoco, díselo al usuario y sigue con `references/spec-template.md`. No puedes invocarlo con la herramienta Skill (es de invocación solo manual), así que se lee como un documento. De ahí salen la cabecera, las secciones obligatorias y su orden, las reglas de redacción (una idea por frase, nombres concretos, sin TODOs, criterios booleanos), el estado por defecto y las reglas de numeración.
2. **Las specs de `specs/`, completas, como modelo:**
   - **Las dos últimas** del listado: idioma, palabras de estado, encabezados exactos, tono y nivel de detalle.
   - **`05-asteroids-game.md` y `06-games-table-leaderboard-supabase.md`:** son el modelo de contenido de un juego (motor, reproductor, ficha, leaderboard, riesgos y decisiones).
   - **La spec de juego más reciente**, si ya hay alguna posterior a la 06 (busca "juego" o "leaderboard" en los títulos): lo último que se aprendió manda sobre la 05 y la 06.
   - **La spec del registro de juegos**, si existe, para citarla en `Depende de`.
3. **Si hay discrepancias:** la estructura y las reglas de formato las dictan `/spec` y las últimas specs; el contenido propio de un juego, `references/spec-template.md` y `references/pattern.md`. Si el esqueleto de este skill choca con las specs recientes, siguen las recientes y avisas al usuario de que el esqueleto está desactualizado.
4. **Datos que `/spec` recibe ya calculados y tú no:** la **fecha** (`date +%F`, o la del contexto de la sesión) y el **listado de `specs/`**. El número de la spec es el mayor del listado más uno, con dos dígitos.

### 4. Escribir la spec

Rellena `references/spec-template.md` con las respuestas, copiando de las specs que acabas de leer el formato y el estilo. Si ya tienes todo, escribe la spec completa y guárdala sin enseñar borradores; solo si falta información, ve sección a sección.

- El **número** sale del paso 3; el **slug**, corto y en kebab-case a partir del objetivo (`juego-tetris`).
- **Estado `Borrador`**, nunca `Aprobado`: lo cambia el usuario cuando la relea.
- **Fecha:** la obtenida en el paso 3, nunca una inventada.
- **`Depende de`:** comprueba que cada spec citada existe; si no, dilo en lugar de dejar una referencia colgante.
- Los **criterios de las mecánicas** salen del código del juego que leíste, con sus números (puntos, vidas, velocidades), no de memoria.
- Los **pasos** son pequeños y cada uno deja la app funcionando; el último es el cierre (lint, build, RLS, partida completa), no "probar todo".
- La spec cita `.claude/skills/add-game/references/pattern.md` como lectura previa del plan, y los scripts y plantillas en los pasos que los usan.
- Si falta `specs/.spec-config.yml`, créalo con `AutoCreateBranch: true`; si existe, no lo toques.
- Escribe directamente en `specs/NN-slug.md` sin pedir permiso; pregunta solo si el archivo ya existe.

### 5. Cerrar

Confirma la ruta del archivo, que está en `Borrador` y que la cambie a `Aprobado` tras releerla. Indica **qué referencias leíste** (el skill `/spec` con sus dos archivos y las specs concretas del paso 3) para que se pueda comprobar de dónde sale el formato. Resume en pocas líneas **lo que decidiste tú** (textos de la ficha, valores propuestos) para que lo revise. El siguiente paso es `/spec-impl NN-slug`. **Para ahí:** no propongas implementar ni escribas código.

## Reglas

- **No crees el archivo de la spec sin haber hecho el paso 3.** Es la comprobación que evita specs con otro formato, otro idioma o referencias que no existen.
- **No escribas código del juego ni copies las plantillas al proyecto.** Eso es de `/spec-impl`, con la spec aprobada. Si el usuario pide implementar directamente, recuérdale la regla y ofrece cerrar primero la spec.
- **No escribas en Supabase.** Leer para detectar ids ocupados está bien; migraciones e inserciones solo en `/spec-impl`, con confirmación.
- **No hagas commits.**
- **No reabras decisiones ya tomadas** por el usuario ni por el patrón, y registra en la sección de decisiones de la spec las que sí tomó en esta conversación.
- **No supongas.** Si algo cambia el resultado (entrada con ratón, victoria, assets), pregúntalo en la fase 2.

## Mantener el skill al día

Tras implementar un juego, si apareció una trampa o un patrón nuevo, añádelo a `references/pattern.md` (sección 7) o `references/porting.md` (sección 5) y actualiza el "Estado conocido". Cuando el registro de juegos exista, borra del patrón el paso de migración y deja solo "añadir una línea". El skill vale lo que valga su última lección.
