# SPEC 02 — Pestaña Home (landing)

> **Estado:** Aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-16
> **Objetivo:** Añadir la landing Home en `/` según `references/templates/home-about/home.jsx`, mover la biblioteca a `/biblioteca` y actualizar la navegación.

## Por qué existe esta spec

SPEC 01 dejó la biblioteca en `/`. El template nuevo (`references/templates/home-about/`) añade una landing como puerta de entrada: el logo y "Inicio" llevan al Home, y "Biblioteca" pasa a ser una pestaña aparte. Esto cambia rutas definidas en SPEC 01, por eso se documenta aquí. Los criterios de SPEC 01 que mencionan `/` como biblioteca quedan reemplazados por esta spec.

## Alcance

**Dentro:**

- Pantalla Home en `/` con las secciones del template: hero con siluetas flotantes, "¿Por qué Arcade Vault?" (4 beneficios), "Juegos disponibles ahora" (6 mini tarjetas), bloque de estadísticas, "Actividad en vivo" (últimas puntuaciones y top de hoy), "Precios" con FAQ y CTA final.
- Animación de aparición al hacer scroll (clase `.reveal` / `.in`).
- Mover la biblioteca de `/` a `/biblioteca`, sin cambios visuales.
- Nav actualizado: Inicio, Biblioteca, Salón de la Fama y "Acerca de" deshabilitado, en escritorio y en el panel móvil.
- Estilos del Home añadidos a `app/globals.css`, tomados de `references/templates/home-about/styles.css`.
- Contenido ficticio del Home en `app/data.ts`.

**Fuera de alcance (specs futuras):**

- Pantalla "Acerca de" (`about.jsx`): contenido, formulario de contacto, gamepad y terminal de éxito. Sus estilos (`.about*`, `.contact*`, `.term*`, `.gp*`, `.highlight*`, `.div-*`) no se portan ahora.
- Cambios del Home según sesión: es igual con o sin sesión.
- Datos reales (base de datos, estadísticas en vivo, actividad real).
- Pasarela de pago o planes reales: la sección "Precios" es solo contenido.

## Modelo de datos

Se añade a `app/data.ts` (datos ficticios, luego vendrán de una base de datos):

```ts
export interface Beneficio {
  icon: "GAMEPAD" | "FREE" | "TROPHY" | "ROCKET";
  title: string;
  desc: string;
  color: ColorJuego;
}
export interface Estadistica { n: string; u: string; s: string }
export interface ActividadReciente {
  player: string;
  game: string;
  score: number;
  when: string;          // "hace 2 min"
  color: ColorJuego;
}
export interface TopJugador { rank: number; player: string; score: number }
export interface Pregunta { q: string; a: string }

export const BENEFICIOS: Beneficio[];            // 4 elementos
export const ESTADISTICAS: Estadistica[];        // 3 elementos
export const ACTIVIDAD_RECIENTE: ActividadReciente[]; // 7 elementos
export const TOP_HOY: TopJugador[];              // 5 elementos
export const PREGUNTAS: Pregunta[];              // 3 elementos
```

Los textos y valores son los de `home.jsx`. Las 6 mini tarjetas salen de `GAMES.slice(0, 6)`. Los textos del plan "Jugador Vault" (precio, lista de ventajas, pie) quedan como contenido editorial fijo en el componente.

## Plan de implementación

Antes de escribir UI, usar `/frontend-design` (lo exige `CLAUDE.md`) sin alejarse del template, y leer en `node_modules/next/dist/docs/` lo necesario sobre Server y Client Components.

1. Añadir a `app/globals.css` los bloques del Home de `home-about/styles.css`: desde `.home {` hasta `.reveal.in`, incluidos `@keyframes bounce` y `float` y los `@media` asociados. No copiar los bloques de About. Añadir una regla `.av-nav .links .disabled` (opacidad reducida, `cursor: not-allowed`, sin hover), que el template no define.
2. Añadir a `app/data.ts` los tipos y constantes del modelo de datos.
3. Mover la biblioteca: crear `app/biblioteca/page.tsx` que renderiza `<Library />`. `app/page.tsx` queda temporalmente con un marcador mínimo. Actualizar a `/biblioteca` los enlaces "VOLVER AL VAULT" (detalle, reproductor, 404), "VOLVER A LA BIBLIOTECA" (salón) y la redirección tras iniciar sesión o entrar como invitado (`auth-form.tsx`).
4. Actualizar `app/components/nav.tsx`: logo e "Inicio" a `/`; "Biblioteca" a `/biblioteca` (activo en `/biblioteca`, `/juegos/*`, `/jugar/*`); "Inicio" activo solo en `/`; "Acerca de" como elemento no navegable con `aria-disabled="true"` y `title="Próximamente"`, en el nav y en el panel móvil.
5. Crear `app/components/reveal-observer.tsx` (cliente): `IntersectionObserver` con umbral 0.12 que añade la clase `in` a los `.reveal` y deja de observarlos.
6. Crear los componentes del Home en `app/components/home/`: `floating-silhouettes.tsx` (8 SVG), `feature-icon.tsx`, `mini-card.tsx` (con `next/link` a `/juegos/[id]`).
7. Crear `app/components/home/home.tsx` (componente de servidor) con las 6 secciones, leyendo todo de `app/data.ts`, y montarlo en `app/page.tsx` junto con `<RevealObserver />`. CTAs: "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS" e "INSERTAR MONEDA" van a `/biblioteca`; "CREAR CUENTA" y "EMPEZAR GRATIS" a `/auth`; "VER SALÓN" a `/salon`.
8. Revisar el Home contra el template abierto en el navegador (escritorio y móvil) y ejecutar `npm run lint` y `npm run build`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `/` muestra el Home con el título "EL ARCADE CLÁSICO ESTÁ DE VUELTA" y las secciones `// 01`, `// 02`, `// 03` y `// 04`, más el CTA final "¿LISTO PARA JUGAR?".
- [ ] El hero muestra 8 siluetas decorativas y no son accesibles para lectores de pantalla (`aria-hidden`).
- [ ] La sección 01 muestra 4 tarjetas; la 02 muestra exactamente 6 mini tarjetas (los 6 primeros de `GAMES`).
- [ ] El bloque de estadísticas muestra "12+", "MILES" y "GLOBAL".
- [ ] "Actividad en vivo" muestra 7 filas de últimas puntuaciones y 5 del top de hoy, con el #1, #2 y #3 destacados.
- [ ] Pulsar una mini tarjeta navega a `/juegos/<id>`.
- [ ] "EXPLORAR JUEGOS", "VER TODOS LOS JUEGOS" e "INSERTAR MONEDA" llevan a `/biblioteca`; "CREAR CUENTA" y "EMPEZAR GRATIS" llevan a `/auth`; "VER SALÓN" lleva a `/salon`.
- [ ] `/biblioteca` muestra la biblioteca idéntica a la de SPEC 01 (hero, buscador, chips, 8 tarjetas).
- [ ] Ningún enlace interno apunta a `/` esperando la biblioteca: "VOLVER AL VAULT", "VOLVER A LA BIBLIOTECA" y la redirección tras login llevan a `/biblioteca`.
- [ ] Las secciones con `.reveal` aparecen con animación al entrar en el viewport.
- [ ] El nav muestra Inicio, Biblioteca, Salón de la Fama y "Acerca de"; este último no navega y tiene `aria-disabled="true"`, en escritorio y en el panel móvil.
- [ ] "Inicio" está activo solo en `/`; "Biblioteca" lo está en `/biblioteca`, `/juegos/*` y `/jugar/*`.
- [ ] El logo lleva a `/`.
- [ ] Con sesión iniciada, el Home es idéntico al de sin sesión.
- [ ] En ancho ≤ 520 px el Home no tiene scroll horizontal y las rejillas pasan a una columna.
- [ ] `app/globals.css` no contiene reglas `.about`, `.contact`, `.term` ni `.gp`.
- [ ] Ninguna lista de contenido del Home (actividad, top, beneficios, estadísticas, FAQ) está escrita en un componente: todas salen de `app/data.ts`.
- [ ] Una captura del Home a 1440 px es visualmente equivalente a la del template (salvo animaciones).

## Decisiones tomadas y descartadas

- **Sí:** Home en `/` y biblioteca en `/biblioteca`. Fiel al template: el logo lleva al Home.
- **No:** Home en `/inicio` con la biblioteca en `/`. No toca rutas, pero se aparta del flujo del template.
- **Sí:** "Acerca de" visible pero deshabilitado. Anticipa la siguiente spec sin dejar un enlace roto.
- **No:** ocultarlo hasta la spec de About.
- **Sí:** todo el contenido ficticio del Home en `app/data.ts`, para seguir SPEC 01 y poder sustituirlo por base de datos.
- **Sí:** el Home no cambia con la sesión. Es el comportamiento del template y evita lógica nueva.
- **Sí:** tras iniciar sesión o entrar como invitado se va a `/biblioteca`, como hacía el flujo de la plantilla original.
- **Sí:** Home como componente de servidor con un pequeño cliente solo para el efecto de scroll.
- **Sí:** portar solo los estilos del Home, aunque el CSS del template incluya los de About. Esos entran con su propia spec.
- **Sí:** estilo del estado deshabilitado definido aquí (el template no lo trae).

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| Contenido `.reveal` invisible si el JavaScript falla o tarda | Aceptado: el efecto es progresivo y solo afecta a la animación; revisar que sin hidratar no quede contenido crítico oculto. |
| Enlaces antiguos a `/` que esperaban la biblioteca se olvidan | Buscar con `grep` toda referencia a `"/"` y `href="/"` y cubrirlo en los criterios de aceptación. |
| Copiar CSS de más desde el template (bloques de About) | Criterio explícito: `globals.css` sin `.about`, `.contact`, `.term` ni `.gp`. |
| Mostrar "12+ JUEGOS" cuando hay 8 en el catálogo | Es texto del template y se mantiene como contenido ficticio; se corrige con datos reales en otra spec. |

## Qué **no** está en esta spec

- Pantalla "Acerca de" y su formulario de contacto.
- Un Home distinto para usuarios con sesión.
- Datos reales para estadísticas, actividad o ranking.
- Cobros, planes o suscripciones.

Cada uno, si llega, va en su propia spec.
