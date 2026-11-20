# SPEC 01 — MVP visual de Arcade Vault (todas las pantallas)

> **Estado:** Borrador
> **Depende de:** ninguna
> **Fecha:** 2026-10-16
> **Objetivo:** Portar a Next.js (App Router) las 5 pantallas de `references/templates/` con datos ficticios y sin ningún juego real.

## Por qué existe esta spec

`references/templates/` es un prototipo en React UMD + Babel con un router casero (hash JSON). El MVP debe vivir en el proyecto Next.js real con rutas reales, manteniendo el diseño neón idéntico. Los datos ficticios se aíslan en un solo archivo para sustituirlos luego por una base de datos.

## Alcance

**Dentro:**

- Pantallas: Biblioteca, Detalle de juego, Reproductor (placeholder), Auth (iniciar sesión / crear cuenta) y Salón de la Fama.
- Layout global: fondo (`av-bg`, `av-noise`), barra de navegación (con menú móvil), contador de créditos y footer.
- Estilos: `references/templates/styles.css` portado tal cual a `app/globals.css`.
- Datos ficticios en `app/data.ts` (juegos, categorías, jugadores, puntuaciones semilla).
- Sesión simulada y puntuaciones guardadas en `localStorage`.
- Reproductor: copia fiel del placeholder de la plantilla (marco CRT, HUD, puntaje simulado, pausa, fin, modal de guardar puntuación).
- Fuentes Press Start 2P, JetBrains Mono y Courier Prime vía `next/font/google`.
- Página 404 para ids de juego inexistentes.

**Fuera de alcance (specs futuras):**

- Cualquier juego real (lógica, canvas, controles).
- Base de datos, API o autenticación real (OAuth Google/GitHub, hash de contraseñas, sesiones de servidor).
- Los botones Google/GitHub del Auth son solo visuales.
- Puntuaciones reales por juego o ranking global persistente.
- Tests automatizados (no hay runner configurado).
- Reescritura de estilos con utilidades Tailwind.

## Modelo de datos

Todo vive en `app/data.ts` como datos ficticios que luego vendrán de una base de datos.

```ts
export type Categoria = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type ColorJuego = "cyan" | "magenta" | "yellow" | "green";

export interface Juego {
  id: string;        // slug de URL, ej. "bloque-buster"
  title: string;
  short: string;
  long: string;
  cat: Categoria;
  cover: string;     // clase CSS, ej. "cover-bricks"
  color: ColorJuego;
  best: number;
  plays: string;     // ya formateado, ej. "12.4K"
}

export interface Puntuacion {
  rank: number;
  name: string;
  score: number;
  date: string;      // "DD/MM/2026"
}

export const GAMES: Juego[];                  // los 8 juegos de la plantilla
export const CATS: string[];                  // ["TODOS", ...categorías]
export function seededScores(seed: number, count?: number): Puntuacion[];
```

Persistencia en el navegador (solo demo):

```ts
// localStorage
"av_user"   // { name: string } | ausente = invitado
"av_scores" // { game: string; score: number; name: string; at: number }[]
```

Convenciones: formato numérico `toLocaleString("es-ES")`; nombre de usuario en mayúsculas, máximo 10 caracteres; textos de interfaz en español.

## Plan de implementación

Antes de empezar: leer en `node_modules/next/dist/docs/` las guías de layouts, rutas dinámicas (`params` asíncrono), `next/font` y Cache Components, según exige `AGENTS.md`.

1. Portar `styles.css` a `app/globals.css` (después de `@import "tailwindcss"`), cambiando las variables de fuente para usar las de `next/font`. Verificar que `npm run dev` compila.
2. Crear `app/data.ts` con tipos, `GAMES`, `CATS`, `PLAYERS` y `seededScores`.
3. Reescribir `app/layout.tsx`: fuentes, `lang="es"`, metadata ("Arcade Vault · Portal Retro"), `av-bg`, `av-noise`, `<main className="av-main">` y footer. Usar `LayoutProps<"/">`.
4. Crear `app/components/session-provider.tsx` (cliente): contexto con `user`, `login`, `signOut`, `saveScore`, leyendo y escribiendo `av_user` / `av_scores` con `try/catch`.
5. Crear `app/components/nav.tsx` (cliente): enlaces con `next/link`, estado activo por `usePathname`, contador de créditos, botón de sesión y panel móvil. Montarlo en el layout.
6. Biblioteca: `app/page.tsx` + `app/components/library.tsx` (búsqueda, chips de categoría, estado vacío) + `app/components/game-card.tsx` (efecto tilt). Navega a `/juegos/[id]`.
7. Detalle: `app/juegos/[id]/page.tsx` con `generateStaticParams`, ranking de 10 filas y botones a `/jugar/[id]` y `/`. Id inexistente llama a `notFound()`; añadir `app/not-found.tsx` con estilo neón.
8. Reproductor: `app/jugar/[id]/page.tsx` + `app/components/game-player.tsx` copiando el placeholder de la plantilla. SALIR vuelve a `/juegos/[id]`; VOLVER AL VAULT va a `/`.
9. Auth: `app/auth/page.tsx` + `app/components/auth-form.tsx` (pestañas, campo de correo solo en "crear cuenta", invitado, botones sociales sin acción). Al enviar, llama a `login` y va a `/`.
10. Salón de la Fama: `app/salon/page.tsx` + `app/components/hall-of-fame.tsx` (pestañas por juego, podio, tabla, fila "TU MEJOR MARCA" si hay sesión).
11. Reemplazar los textos por defecto de create-next-app y ejecutar `npm run lint` y `npm run build` sin errores.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `/` muestra el hero "ARCADE VAULT" y 8 tarjetas de juego.
- [ ] Escribir "caí" en el buscador deja solo la tarjeta CAÍDA; una búsqueda sin coincidencias muestra "NO HAY RESULTADOS".
- [ ] Seleccionar la categoría SHOOTER muestra exactamente INVASORES y ROCAS; TODOS vuelve a mostrar 8.
- [ ] Pulsar una tarjeta o su botón JUGAR navega a `/juegos/<id>`.
- [ ] `/juegos/caida` muestra título, descripción larga, tags, 3 estadísticas y un ranking de 10 filas con las tres primeras destacadas.
- [ ] `/juegos/no-existe` y `/jugar/no-existe` muestran la página 404.
- [ ] "JUGAR AHORA" lleva a `/jugar/<id>`; "VOLVER AL VAULT" lleva a `/`.
- [ ] En `/jugar/<id>` el puntaje sube mientras no hay pausa; PAUSA lo detiene y muestra "EN PAUSA"; REANUDAR lo reanuda.
- [ ] FIN abre el modal con la puntuación final; GUARDAR PUNTUACIÓN muestra "PUNTUACIÓN GUARDADA" y añade una entrada a `localStorage["av_scores"]`.
- [ ] JUGAR DE NUEVO reinicia puntaje, vidas y nivel; SALIR vuelve a `/juegos/<id>`.
- [ ] `/auth` alterna entre "INICIAR SESIÓN" y "CREAR CUENTA"; solo la segunda muestra el campo de correo.
- [ ] Enviar el formulario guarda `av_user` con el nombre en mayúsculas (máx. 10 caracteres), redirige a `/` y la barra muestra ese nombre en lugar de "Iniciar Sesión".
- [ ] "JUGAR COMO INVITADO" redirige a `/` sin sesión.
- [ ] Con la sesión iniciada, recargar la página conserva el nombre en la barra; al cerrar sesión se elimina `av_user`.
- [ ] `/salon` muestra pestañas de los 8 juegos, podio con 3 puestos y una tabla de 12 filas; cambiar de pestaña cambia los datos.
- [ ] La fila "TU MEJOR MARCA" aparece solo con sesión iniciada.
- [ ] En ancho ≤ 768 px aparece el botón hamburguesa y abre el panel móvil con los enlaces.
- [ ] El enlace activo de la barra se resalta: Biblioteca en `/`, `/juegos/*` y `/jugar/*`; Salón en `/salon`.
- [ ] Ningún componente fuera de `app/data.ts` contiene listas hardcodeadas de juegos o puntuaciones.

## Decisiones tomadas y descartadas

- **Sí:** rutas reales del App Router (`/`, `/juegos/[id]`, `/jugar/[id]`, `/auth`, `/salon`). URLs compartibles y encaje natural con Next.js.
- **No:** replicar el router por hash JSON de la plantilla. Va contra el framework.
- **Sí:** portar `styles.css` tal cual a `app/globals.css`. Fidelidad visual máxima, 950 líneas de tema propio.
- **No:** reescribir con utilidades Tailwind. Mucho trabajo y riesgo de divergir del diseño.
- **Sí:** datos ficticios aislados en `app/data.ts`. Cambiar a base de datos solo tocará ese punto.
- **Sí:** sesión y puntuaciones en `localStorage` (`av_user`, `av_scores`), como en la plantilla. Mantiene el flujo de demo sin backend. Esta decisión no fue confirmada explícitamente; se toma la de la plantilla.
- **Sí:** reproductor copiado tal cual como placeholder. Los juegos reales lo sustituirán en specs futuras.
- **Sí:** fuentes con `next/font/google` en vez del `<link>` de la plantilla.
- **No:** dependencias nuevas (React, Babel por CDN, etc.). Next.js ya aporta todo.

## Riesgos

| Riesgo | Mitigación |
| ------ | ---------- |
| `localStorage` no existe en el servidor y causa errores de hidratación | Leerlo solo en efectos del cliente; render inicial como invitado. |
| Cache Components y `params` asíncrono cambian respecto a versiones antiguas | Leer las guías de `node_modules/next/dist/docs/` antes de escribir las rutas dinámicas. |
| `localStorage` bloqueado o lleno | Todo acceso dentro de `try/catch`; la app sigue funcionando sin persistir. |
| Divergencia visual por cambiar `font-family` a las variables de `next/font` | Revisar cada pantalla contra la plantilla abierta en el navegador. |

## Qué **no** está en esta spec

- Ningún juego real.
- Base de datos, API, autenticación real u OAuth.
- Ranking persistente o validación de puntuaciones.
- Tests automatizados.
- Reescritura de estilos con Tailwind.

Cada uno, si llega, va en su propia spec.
