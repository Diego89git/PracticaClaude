# SPEC 03 — Integración base con Supabase

> **Estado:** aprobado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-16
> **Objetivo:** Dejar Supabase conectado a la app Next.js (dependencias, variables de entorno y clientes de navegador y servidor) sin usarlo todavía en ninguna pantalla.

## Por qué existe esta spec

La base de datos `public` del proyecto Supabase está vacía y la app solo usa datos ficticios y `localStorage` (SPEC 01). Las specs futuras (base de datos, autenticación, realtime, Edge Functions) necesitan una integración común ya probada. Se separa aquí para que cada una de esas specs trate solo de su dominio y no de configuración.

## Alcance

**Dentro:**

- Instalar `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local`, documentadas en `.env.example`.
- Ajustar `.gitignore` para que `.env.example` se versione y `.env.local` siga ignorado.
- Cliente de navegador en `lib/supabase/client.ts`.
- Cliente de servidor en `lib/supabase/server.ts`, con cookies de `next/headers`.
- Ruta temporal `app/api/supabase-health/route.ts` para comprobar la conexión.
- Documentar en `CLAUDE.md` la integración (ubicación de los clientes y variables).

**Fuera de alcance (specs futuras):**

- Tablas, migraciones, RLS y datos semilla.
- Autenticación real: registro, login, OAuth, sustitución de `av_user` en `localStorage`.
- `proxy.ts` de Next 16 para refrescar la sesión en cada petición (va con Auth).
- Tipos generados de la base (`database.types.ts`); se generan cuando existan tablas.
- Cliente con `service_role`; no se guarda ninguna clave secreta en esta spec.
- Realtime y Edge Functions.
- Cualquier cambio en `app/data.ts` o en las pantallas existentes.

## Modelo de datos

Esta spec no introduce estructuras de datos ni tablas. Solo configuración.

Variables de entorno (ambas públicas, seguras para el navegador):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Interfaz de los módulos nuevos:

```ts
// lib/supabase/client.ts
export function createClient(): SupabaseClient; // navegador

// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>; // servidor, usa cookies()
```

Respuesta de la ruta temporal `GET /api/supabase-health`:

```ts
{ ok: true }  | { ok: false; error: string }
```

## Plan de implementación

Antes de empezar: leer en `node_modules/next/dist/docs/` las guías de variables de entorno, Route Handlers y `cookies()` asíncrono con Cache Components, según exige `AGENTS.md`. Consultar la guía de Supabase para Next.js App Router con `@supabase/ssr` (por ejemplo con el MCP `search_docs`).

1. Instalar `@supabase/supabase-js` y `@supabase/ssr` con `npm install`. Verificar que `npm run build` sigue compilando.
2. Obtener la URL del proyecto y la clave publishable con el MCP (`get_project_url`, `get_publishable_keys`) y escribirlas en `.env.local`. Crear `.env.example` con las mismas variables y valores de ejemplo. Añadir `!.env.example` a `.gitignore` tras la regla `.env*`. Comprobar con `git status` que `.env.local` no aparece y `.env.example` sí.
3. Crear `lib/supabase/client.ts` con `createBrowserClient` de `@supabase/ssr`. Debe lanzar un error claro si falta alguna de las dos variables.
4. Crear `lib/supabase/server.ts` con `createServerClient` y `cookies()` de `next/headers`, con la gestión de cookies que indica la guía oficial de `@supabase/ssr`. Mismo error claro si faltan variables.
5. Crear `app/api/supabase-health/route.ts` (GET) que crea el cliente de servidor, hace un `fetch` a `<URL>/auth/v1/settings` con la cabecera `apikey` (sin tocar sesiones ni usuarios) y devuelve `{ ok: true }` o `{ ok: false, error }` con estado 500. Probar con `npm run dev` y `curl http://localhost:3000/api/supabase-health`.
6. Añadir a `CLAUDE.md` una nota breve en "Architecture notes": clientes en `lib/supabase/`, variables requeridas y que `proxy.ts` aún no existe.
7. Ejecutar `npm run lint` y `npm run build`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` terminan sin errores.
- [ ] `package.json` lista `@supabase/supabase-js` y `@supabase/ssr` como dependencias.
- [ ] `.env.local` existe con las dos variables y `git status` no lo muestra.
- [ ] `.env.example` existe, contiene los nombres de las dos variables sin valores reales y `git status` lo muestra como archivo nuevo.
- [ ] Ningún archivo versionado contiene la URL real ni la clave del proyecto.
- [ ] `lib/supabase/client.ts` y `lib/supabase/server.ts` exportan `createClient`.
- [ ] Sin `NEXT_PUBLIC_SUPABASE_URL`, llamar a `createClient` lanza un error que nombra la variable que falta.
- [ ] `GET /api/supabase-health` responde 200 con `{ "ok": true }` con las variables correctas.
- [ ] `GET /api/supabase-health` responde 500 con `{ "ok": false, ... }` si se cambia la clave por una inválida.
- [ ] Ninguna pantalla existente (`/`, `/biblioteca`, `/juegos/*`, `/jugar/*`, `/auth`, `/salon`) cambia de comportamiento.
- [ ] `app/data.ts` no tiene modificaciones.
- [ ] No existe `proxy.ts` ni `middleware.ts` en el repositorio.
- [ ] `CLAUDE.md` menciona `lib/supabase/` y las dos variables de entorno.

## Decisiones tomadas y descartadas

- **Sí:** alcance limitado a la integración. El usuario quiere la base lista y dejar BD, Auth, realtime y Edge Functions para specs propias.
- **No:** crear tablas o esquema ahora. Sin consumidor no hay forma de validarlos.
- **Sí:** `@supabase/supabase-js` + `@supabase/ssr`. Auth en App Router exige cookies y es mejor dejarlo preparado.
- **No:** solo `supabase-js`. Habría que migrar los clientes cuando llegue Auth.
- **Sí:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Es la clave nueva de Supabase y reemplaza a `anon`.
- **No:** `ANON_KEY`. Es la clave legacy.
- **Sí:** clientes en `lib/supabase/`, fuera de `app/`. No son rutas ni componentes y así se importan con `@/lib/supabase/...`.
- **No:** `app/lib/supabase/`.
- **Sí:** sin `proxy.ts` por ahora. Sin sesión no hay nada que refrescar y se evita ejecutar código en cada petición. Se añade con la spec de Auth.
- **Sí:** verificar con una ruta `/api/supabase-health`, la única prueba real de conexión sin tablas.
- **No:** solo lint y build. No detectan credenciales incorrectas.
- **Sí:** `.env.example` versionado mediante `!.env.example` en `.gitignore`, porque hoy `.env*` lo ignora.
- **Sí:** tipos generados se difieren hasta que existan tablas; ahora saldrían vacíos.
- **Sí:** el MCP de Supabase ya autenticado se usa para obtener URL y clave publishable, sin copiarlas a mano.
- **Pendiente de decidir (al cerrar la spec):** si `/api/supabase-health` se borra o se conserva. Se decide al terminar el paso 5; hasta entonces es temporal.

## Riesgos

| Riesgo                                                                                | Mitigación                                                                                                                 |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `cookies()` asíncrono y Cache Components exigen patrones concretos en rutas           | Leer las guías de `node_modules/next/dist/docs/` antes de escribir `server.ts` y la ruta.                                  |
| Subir claves a git por error                                                          | `.env.local` ignorado y criterio explícito de que no aparezca la URL ni la clave en archivos versionados.                  |
| La ruta de salud queda expuesta en producción                                         | Es temporal; no devuelve datos del proyecto, solo `ok`/`error` genérico. Decidir su borrado al terminar.                   |
| `getSession()` y `getUser()` no hacen red sin sesión y no detectan una clave inválida | La ruta usa un `fetch` a `/auth/v1/settings` con `apikey`: responde 401 con clave inválida y 200 con la real (comprobado). |
| La guía de `@supabase/ssr` cambia entre versiones                                     | Fijar la versión instalada y seguir la documentación consultada con `search_docs`.                                         |

## Qué **no** está en esta spec

- Tablas, migraciones, RLS o datos semilla.
- Autenticación real, OAuth o `proxy.ts`.
- Realtime y Edge Functions.
- Tipos generados de la base.
- Clave `service_role` o cualquier secreto de servidor.
- Cambios en `app/data.ts` o en las pantallas.

Cada uno, si llega, va en su propia spec.
