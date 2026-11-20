# SPEC 24 — Registro, inicio de sesión y autenticación real con Supabase Auth

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 03, SPEC 06
> **Fecha:** 2026-11-20
> **Objetivo:** Reemplazar la sesión falsa de `localStorage` por Supabase Auth: registro e inicio de sesión con correo y contraseña o con Google y GitHub, recuperación de contraseña, página `/cuenta`, y puntuaciones ligadas al usuario.

## Por qué existe esta spec

Hoy `/auth` es una pantalla de mentira: `auth-form.tsx` deja entrar con cualquier nombre, `session-provider.tsx` guarda `{ name }` en `localStorage` (`av_user`) y no hay contraseña, correo ni sesión en el servidor. Los botones GOOGLE y GITHUB no hacen nada. En la base, `scores` solo acepta inserts con `user_id is null` (SPEC 06) y `server.ts` ya avisa de que el refresco de sesión «lo hará el proxy cuando exista (spec de Auth)».

Esta spec convierte esa maqueta en autenticación real sin cambiar el aspecto de la pantalla, que ya tiene las pestañas INICIAR SESIÓN / CREAR CUENTA, el modo invitado y los botones sociales. El invitado sigue pudiendo jugar y guardar puntuaciones anónimas como hasta ahora.

Terminología: **OAuth** es el protocolo con el que la app delega el inicio de sesión en un servicio externo. **Google** y **GitHub** son los dos proveedores OAuth que se integran aquí. En la spec, «OAuth» y «Google/GitHub» se refieren a lo mismo.

## Alcance

**Dentro:**

- Registro con correo, contraseña y nombre de jugador (`username`, de 1 a 10 caracteres), con **confirmación de correo obligatoria**: después de registrarse se muestra «Revisa tu correo».
- Inicio de sesión con **correo y contraseña**.
- Inicio de sesión y registro con **Google** y **GitHub** (OAuth de Supabase).
- Paso **«Elige tu nombre de jugador»** (`/auth/nombre`) la primera vez que alguien entra sin `username` (caso OAuth).
- **Recuperar la contraseña**: el enlace «¿Olvidaste tu contraseña?» lleva a `/auth/recuperar`, que envía el correo; el correo lleva a `/auth/nueva-contrasena`, donde se escribe la nueva.
- Rutas de servidor `/auth/confirm` (enlaces de correo con `token_hash`) y `/auth/callback` (código OAuth).
- `proxy.ts` en la raíz: refresca la sesión en cada petición, protege `/cuenta` y manda a `/auth/nombre` a quien tiene sesión sin `username`.
- `session-provider.tsx` lee el usuario real de Supabase. `signOut` cierra la sesión de verdad. Desaparece `av_user`.
- Página **`/cuenta`**: ver el correo y el proveedor, cambiar el nombre de jugador, cambiar la contraseña (solo en cuentas de correo) y cerrar sesión.
- Barra de navegación: con sesión, el botón con el nombre lleva a `/cuenta`; sin sesión, a `/auth`.
- Puntuaciones con sesión: el nombre del modal de fin de partida viene **prellenado con el `username` y se puede editar**, y el insert lleva `user_id = auth.uid()`.
- Al cambiar el nombre en `/cuenta`, las puntuaciones del usuario cuyo `player_name` era el nombre anterior pasan al nombre nuevo.
- Migración: política de insert para usuarios autenticados y función `renombrar_scores`.
- Configuración manual en el dashboard de Supabase (proveedores, URLs y plantillas de correo), escrita como paso del plan.
- Nota en `CLAUDE.md` sobre la autenticación real (sustituye a «Real auth does not exist yet»).

**Fuera de alcance (specs futuras):**

- SMTP propio (Resend, SES...) y plantillas de correo con la marca. Se usa el SMTP por defecto de Supabase.
- Nombres de jugador únicos (hace falta una tabla `profiles`).
- Iniciar sesión escribiendo el nombre de usuario en lugar del correo.
- Borrar la cuenta, cambiar el correo, vincular varias identidades (correo + Google) y 2FA/MFA.
- Más proveedores OAuth (Discord, Apple, ...).
- Pasar a Supabase las puntuaciones locales (`av_scores`) de los placeholders; siguen en `localStorage`.
- Mostrar en el Salón de la Fama las puntuaciones propias o un perfil público.
- Roles, administración y moderación de nombres.
- Rediseño visual de `/auth`: se conserva el diseño actual y solo se añaden los estados que faltan.

## Modelo de datos

### Usuario (Supabase Auth, sin tabla nueva)

El nombre de jugador vive en `user_metadata` del usuario de Auth:

```ts
// auth.users.raw_user_meta_data
{
  username: "PX_KAI";
} // trim + mayúsculas, 1–10 caracteres (igual que scores.player_name)
```

- Con correo: `signUp({ email, password, options: { data: { username }, emailRedirectTo } })`.
- Con OAuth: Supabase rellena el metadata del proveedor (`full_name`, `user_name`, `avatar_url`...) pero **no** `username`. Se escribe en `/auth/nombre` con `updateUser({ data: { username } })`.
- Proveedor: `user.app_metadata.provider` (`"email" | "google" | "github"`).
- Validación del nombre en el cliente: `trim()`, mayúsculas y de 1 a 10 caracteres. No es único.
- Contraseña: mínimo 6 caracteres (el mínimo por defecto de Supabase). En el registro y en el cambio se pide repetirla.

### Sesión en el cliente (`app/components/session-provider.tsx`)

```ts
export interface Usuario {
  id: string; // auth.users.id
  name: string; // user_metadata.username ("" si aún no lo eligió)
  email: string;
  provider: "email" | "google" | "github";
}

interface SessionValue {
  user: Usuario | null;
  cargando: boolean; // true hasta conocer la sesión inicial
  signOut: () => Promise<void>; // supabase.auth.signOut()
  refrescar: () => Promise<void>; // relee el usuario después de updateUser
  saveScore: (entry: ScoreEntry) => void; // sin cambios (av_scores, placeholders)
}
```

- El provider usa el cliente de navegador (`lib/supabase/client.ts`): sesión inicial con `auth.getUser()` y suscripción a `onAuthStateChange`.
- **Desaparece** `login(u)` y la clave `av_user`. El invitado no tiene sesión (`user === null`).
- `av_scores` y `saveScore` siguen igual. `av_player_name` sigue sirviendo para prellenar el nombre del invitado.

### Migración `supabase/migrations/20261120120000_auth_scores.sql`

```sql
-- SPEC 24: puntuaciones de usuarios autenticados y renombrado.

-- La política anónima de SPEC 06 (user_id is null) se queda.
create policy "scores_insert_authenticated" on public.scores
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Renombra solo las filas propias que tenían el nombre anterior.
create function public.renombrar_scores(anterior text, nuevo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  filas integer;
begin
  if (select auth.uid()) is null then
    raise exception 'Sin sesión';
  end if;
  if char_length(nuevo) not between 1 and 10 then
    raise exception 'Nombre inválido';
  end if;
  update public.scores
     set player_name = nuevo
   where user_id = (select auth.uid())
     and player_name = anterior;
  get diagnostics filas = row_count;
  return filas;
end;
$$;

revoke execute on function public.renombrar_scores(text, text) from public, anon;
grant execute on function public.renombrar_scores(text, text) to authenticated;
```

- Sigue sin haber políticas de UPDATE ni DELETE en `scores`. El único cambio posible es el renombrado, y solo a través de la función.
- Después se regenera `lib/supabase/database.types.ts` (aparece `Functions.renombrar_scores`).

### Rutas nuevas

| Ruta                     | Tipo           | Función                                                                                                    |
| ------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------- |
| `/auth/confirm`          | Route Handler  | `verifyOtp({ type, token_hash })` (registro y recuperación) y redirige a `next`                            |
| `/auth/callback`         | Route Handler  | `exchangeCodeForSession(code)` (Google/GitHub) y redirige a `next` o a `/auth/nombre`                      |
| `/auth/nombre`           | Página cliente | Formulario «Elige tu nombre de jugador»                                                                    |
| `/auth/recuperar`        | Página cliente | Pide el correo y llama a `resetPasswordForEmail(email, { redirectTo: origin + "/auth/nueva-contrasena" })` |
| `/auth/nueva-contrasena` | Página cliente | Nueva contraseña con su repetición (`updateUser({ password })`); requiere sesión de recuperación           |
| `/cuenta`                | Página cliente | Panel de cuenta (protegida por `proxy.ts`)                                                                 |

Reglas de `proxy.ts`, en este orden:

1. Siempre: crea el cliente de servidor con las cookies de la petición y de la respuesta, y llama a `auth.getUser()` (refresca el token).
2. Sin usuario y ruta `/cuenta` o `/auth/nombre` → redirige a `/auth?next=<ruta>`.
3. Con usuario, sin `username` y la ruta no empieza por `/auth` ni `/api` → redirige a `/auth/nombre`.
4. Con usuario con `username` y ruta exacta `/auth` → redirige a `/cuenta`.
5. `matcher` que excluye `_next/static`, `_next/image`, `favicon.ico`, `games/` y los archivos de imagen.

### Configuración en el dashboard de Supabase (manual, no versionada)

- **Authentication → Providers → Email:** activo y con «Confirm email» activado.
- **Google** y **GitHub:** activos, con el Client ID y el Secret de las apps OAuth creadas en Google Cloud Console y en GitHub Developer Settings. En las dos apps, la URL de callback es la de Supabase (`https://negkbokeejfirkvprzhc.supabase.co/auth/v1/callback`).
- **URL Configuration:** Site URL `http://localhost:3000`. Redirect URLs `http://localhost:3000/auth/callback`, `http://localhost:3000/auth/confirm` y `http://localhost:3000/auth/nueva-contrasena` (más las de producción cuando haya despliegue).
- **Email Templates:** en _Confirm signup_ y _Reset password_, el enlace pasa a `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` y `...&type=recovery&next=/auth/nueva-contrasena`, respectivamente.

### Mensajes de error (español, en el formulario)

| Caso                                   | Mensaje                                                  |
| -------------------------------------- | -------------------------------------------------------- |
| Credenciales inválidas                 | `CORREO O CONTRASEÑA INCORRECTOS`                        |
| Correo sin confirmar                   | `CONFIRMA TU CORREO ANTES DE ENTRAR`                     |
| Correo ya registrado                   | `ESE CORREO YA TIENE CUENTA`                             |
| Contraseña corta o no coincide         | `MÍNIMO 6 CARACTERES` / `LAS CONTRASEÑAS NO COINCIDEN`   |
| Nombre vacío o de más de 10 caracteres | `NOMBRE DE 1 A 10 CARACTERES`                            |
| Límite de correos o de peticiones      | `DEMASIADOS INTENTOS, ESPERA UNOS MINUTOS`               |
| Enlace de correo inválido o caducado   | `/auth?error=enlace` → `EL ENLACE NO ES VÁLIDO O CADUCÓ` |
| Fallo de red u otro                    | `NO SE PUDO CONECTAR, INTÉNTALO DE NUEVO`                |

Mientras una petición está en curso, el botón de enviar queda deshabilitado y muestra `CARGANDO...`.

## Plan de implementación

Antes de escribir código de Next.js hay que leer `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`, `02-guides/authentication.md` y `02-guides/authentication-with-cache-components.md` (lo exige `AGENTS.md`).

1. **Configurar Supabase (manual, lo hace el usuario):** proveedores, URLs y plantillas según «Configuración en el dashboard». Comprobación: en el dashboard aparecen Email (con confirmación), Google y GitHub activos. Todavía no cambia nada en la app.
2. **Migración** `20261120120000_auth_scores.sql` (política `scores_insert_authenticated` y función `renombrar_scores`), aplicada con el MCP de Supabase. Se regenera `database.types.ts` y se revisan los advisors de seguridad. `rls-check.mjs` sigue pasando: el insert anónimo funciona y el UPDATE/DELETE directo se rechaza.
3. **`proxy.ts`** solo con la regla 1 (refrescar la sesión) y el `matcher`. Se actualiza el comentario de `lib/supabase/server.ts`. La app sigue funcionando igual porque todavía nadie tiene sesión.
4. **`session-provider.tsx` sobre Supabase** (`Usuario`, `cargando`, `signOut`, `refrescar`; sin `login` ni `av_user`). En el mismo paso, `auth-form.tsx` pasa a `signInWithPassword` en la pestaña INICIAR SESIÓN (campos correo y contraseña; al entrar navega al parámetro `next` si es una ruta interna, si no a `/biblioteca`) y el botón invitado solo navega a `/biblioteca`. `nav.tsx` lleva a `/auth` o muestra el nombre (todavía sin enlace a `/cuenta`). Se prueba con un usuario creado a mano desde el dashboard.
5. **Registro:** la pestaña CREAR CUENTA (usuario, correo, contraseña y su repetición) llama a `signUp` con `username` y `emailRedirectTo`, y muestra el estado «REVISA TU CORREO». Se crea `app/auth/confirm/route.ts`. Los mensajes de error de la tabla aparecen en el formulario.
6. **OAuth:** los botones GOOGLE y GITHUB llaman a `signInWithOAuth({ provider, options: { redirectTo: origin + "/auth/callback?next=..." } })`. Se crean `app/auth/callback/route.ts` y `app/auth/nombre/page.tsx`, y se añaden las reglas 2 (solo `/auth/nombre`) y 3 de `proxy.ts`.
7. **Recuperación:** se añade el enlace «¿Olvidaste tu contraseña?» en INICIAR SESIÓN y se crean `app/auth/recuperar/page.tsx` y `app/auth/nueva-contrasena/page.tsx`. Al terminar se navega a `/biblioteca` con la sesión iniciada.
8. **`/cuenta`:** `app/cuenta/page.tsx` + `app/components/account-panel.tsx` (correo, proveedor, cambiar nombre, cambiar contraseña si `provider === "email"`, cerrar sesión → `/`). Para cambiar el nombre: primero `updateUser({ data: { username } })`, después `rpc("renombrar_scores", { anterior, nuevo })` y por último `refrescar()`. Se añaden las reglas 2 (`/cuenta`) y 4 de `proxy.ts`. En `nav.tsx`, el nombre enlaza a `/cuenta` en escritorio y en el panel móvil.
9. **Puntuaciones con sesión:** en `game-player.tsx`, el nombre se prellena con `user.name` cuando hay sesión (con `av_player_name` cuando no) y el insert usa `user_id: user?.id ?? null`. `hall-of-fame.tsx` sigue usando `user.name`.
10. **`CLAUDE.md`:** se sustituye el punto «Real auth does not exist yet» por una descripción breve: Supabase Auth, `proxy.ts`, `user_metadata.username`, `/cuenta`, la política de insert autenticado y `renombrar_scores`.

## Criterios de aceptación

- [ ] Con CREAR CUENTA (usuario `TEST1`, correo nuevo y contraseña de 6 o más caracteres) se ve «REVISA TU CORREO» y en `auth.users` aparece el usuario con `raw_user_meta_data.username = "TEST1"` y `email_confirmed_at` nulo.
- [ ] Iniciar sesión con ese correo **antes** de confirmar muestra `CONFIRMA TU CORREO ANTES DE ENTRAR`.
- [ ] El enlace del correo de confirmación abre `/auth/confirm`, deja la sesión iniciada y la barra muestra `TEST1`.
- [ ] Iniciar sesión con una contraseña incorrecta muestra `CORREO O CONTRASEÑA INCORRECTOS` y no inicia sesión.
- [ ] Registrarse con un correo ya registrado muestra `ESE CORREO YA TIENE CUENTA`.
- [ ] Con GOOGLE se vuelve a la app por `/auth/callback`. La primera vez se ve `/auth/nombre`; después de guardar un nombre, la barra lo muestra. La segunda vez se entra sin pasar por `/auth/nombre`.
- [ ] Lo mismo con GITHUB.
- [ ] Con sesión de OAuth sin `username`, abrir `/biblioteca` redirige a `/auth/nombre`.
- [ ] «¿Olvidaste tu contraseña?» → `/auth/recuperar` envía el correo. Su enlace abre `/auth/nueva-contrasena`, la nueva contraseña se guarda y la anterior deja de funcionar.
- [ ] Un enlace de correo manipulado o ya usado lleva a `/auth` con `EL ENLACE NO ES VÁLIDO O CADUCÓ`.
- [ ] Al recargar cualquier página, la sesión sigue iniciada (la cookie la refresca `proxy.ts`) y `localStorage` ya no tiene la clave `av_user`.
- [ ] Sin sesión, abrir `/cuenta` redirige a `/auth?next=/cuenta` y, al iniciar sesión, se vuelve a `/cuenta`.
- [ ] Con sesión, abrir `/auth` redirige a `/cuenta`.
- [ ] En `/cuenta` se ven el correo y el proveedor (`CORREO`, `GOOGLE` o `GITHUB`). La sección de contraseña solo aparece en cuentas de correo.
- [ ] Cambiar la contraseña en `/cuenta` permite entrar con la nueva y rechaza la anterior.
- [ ] CERRAR SESIÓN en `/cuenta` vuelve al Home, la barra muestra «Iniciar Sesión» y al recargar sigue sin sesión.
- [ ] Con sesión, al terminar una partida de un juego real el modal muestra el `username` prellenado. Al guardar, la fila de `scores` tiene el `user_id` del usuario y el `player_name` escrito, aunque se haya editado.
- [ ] Como invitado, guardar una puntuación sigue creando una fila con `user_id` nulo y el nombre se prellena desde `av_player_name`.
- [ ] Después de cambiar el nombre de `TEST1` a `TEST2` en `/cuenta`, las filas del usuario con `player_name = 'TEST1'` pasan a `TEST2`, las que tenía con otro nombre no cambian y las filas de otros usuarios tampoco.
- [ ] Con la clave publicable y sin sesión, `rpc("renombrar_scores")` falla, y un `UPDATE` o `DELETE` directo sobre `scores` sigue siendo rechazado.
- [ ] Un usuario autenticado no puede insertar en `scores` con el `user_id` de otro usuario (lo rechaza RLS).
- [ ] Los juegos placeholder siguen guardando en `av_scores` y el Salón de la Fama los sigue mostrando.
- [ ] `npm run lint` y `npm run build` terminan sin errores, y la consola del navegador no muestra errores en `/auth`, `/cuenta` y `/jugar/asteroides`.
- [ ] El advisor de seguridad de Supabase no muestra avisos nuevos por `renombrar_scores` ni por la política.

## Decisiones tomadas y descartadas

- **Sí:** correo + contraseña y Google + GitHub en **una sola spec**. Lo decidió el usuario. Se propuso dividirla (correo primero, OAuth después) y se descartó.
- **Sí:** `username` en `user_metadata`. No necesita tabla nueva, y el nombre ya se copia en `scores.player_name`. Contrapartida aceptada: no es único y el usuario puede cambiarlo con `updateUser`, así que no es fiable para autorización (solo se muestra).
- **No:** tabla `profiles` con `username` único y trigger. Se propuso y se descartó; queda para una spec futura si hace falta unicidad.
- **Sí:** confirmación de correo obligatoria. Impide registrar correos ajenos.
- **Sí:** enlaces de correo con `token_hash` en `/auth/confirm`, cambiando las plantillas. A diferencia de `?code=` (PKCE), funciona aunque el correo se abra en otro dispositivo o navegador.
- **Sí:** `/auth/callback` con `exchangeCodeForSession` solo para OAuth, que siempre vuelve al mismo navegador.
- **Sí:** iniciar sesión con correo. Con el nombre en `user_metadata` no hay forma segura de buscar el correo a partir del nombre.
- **Sí:** pedir el nombre la primera vez a los usuarios de OAuth (`/auth/nombre`). No se deriva del nombre del proveedor.
- **Sí:** recuperación de contraseña dentro de esta spec (lo decidió el usuario).
- **Sí:** página `/cuenta` con correo y proveedor, cambio de nombre, cambio de contraseña y cierre de sesión. Borrar la cuenta y cambiar el correo quedan fuera.
- **Sí:** con sesión, el nombre del modal viene prellenado y se puede editar; la fila lleva siempre el `user_id`.
- **Sí:** renombrar solo las filas propias cuyo `player_name` era el nombre anterior. Así se respetan las partidas guardadas a propósito con otro nombre.
- **Sí:** función `security definer` `renombrar_scores` en lugar de una política UPDATE. Una política dejaría cambiar también `score` y `game_id`; la función solo toca `player_name` de las filas propias.
- **Sí:** se mantiene la política anónima de SPEC 06 y se añade otra para `authenticated`. El modo invitado sigue igual.
- **Sí:** `proxy.ts` refresca la sesión y protege `/cuenta`. Es el mecanismo que espera `@supabase/ssr` y lo que anunciaba el comentario de `server.ts`.
- **Sí:** `/cuenta` y las páginas de `/auth/*` son componentes cliente que leen `useSession`. Evitan leer datos sin caché en Server Components con Cache Components activado; la protección real la hace `proxy.ts`.
- **Sí:** `av_scores` y `saveScore` siguen en `localStorage` para los placeholders. Desaparece `av_user`.
- **Sí:** SMTP por defecto de Supabase. Basta para desarrollar; el SMTP propio va en otra spec.
- **No:** iniciar sesión con magic link. El diseño actual pide contraseña.
- **No:** secretos de OAuth en `.env.local`. Viven solo en el dashboard de Supabase y la app no los necesita.
- **Sí:** número 24. Las specs de `specs/game-jam/` ya usan del 18 al 23.

## Riesgos

| Riesgo                                                                                                                | Mitigación                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| El SMTP por defecto de Supabase envía muy pocos correos por hora y las pruebas de registro o recuperación se bloquean | Mensaje `DEMASIADOS INTENTOS...`; en las pruebas, reutilizar usuarios y confirmar desde el dashboard si hace falta. SMTP propio en otra spec |
| Las plantillas de correo no se cambian y los enlaces llegan con `?code=` en lugar de `token_hash`                     | Paso 1 explícito; criterio de aceptación de confirmación por enlace                                                                          |
| Las Redirect URLs no incluyen la ruta y Supabase redirige al Site URL sin sesión                                      | Lista exacta de URLs en el paso 1; añadir las de producción al desplegar                                                                     |
| `user_metadata.username` lo puede cambiar el propio usuario con `updateUser` saltándose la validación del cliente     | Solo se muestra; el `player_name` de `scores` sigue limitado a 1–10 caracteres por el `check`, y `renombrar_scores` valida la longitud       |
| Nombres repetidos entre usuarios en el ranking                                                                        | Aceptado en esta spec; la unicidad queda para una spec con `profiles`                                                                        |
| El cambio de nombre se guarda en Auth pero `renombrar_scores` falla, y las filas viejas quedan con el nombre anterior | Se muestra un aviso en `/cuenta` y se puede repetir: la función recibe `anterior`, así que se puede volver a lanzar                          |
| Con «Secure password change» activado en Supabase, `updateUser({ password })` pide reautenticarse                     | Se deja desactivado (valor por defecto); si se activa, se trata en otra spec                                                                 |
| Las redirecciones del `proxy.ts` entran en bucle (`/auth/nombre` ↔ `/auth`)                                           | Reglas en orden, `/auth/*` excluida de la regla 3; criterios de redirección explícitos                                                       |
| El `matcher` del proxy intercepta los assets de los juegos (`public/games/`) y los ralentiza                          | Se excluyen `games/` y las extensiones de imagen                                                                                             |
| Los usuarios de prueba creados durante la verificación quedan en `auth.users`                                         | Se borran al final desde el dashboard; sus filas de `scores` se dejan (no hay DELETE por RLS)                                                |

## Qué **no** está en esta spec

- SMTP propio y plantillas de correo con la marca.
- Nombres de jugador únicos y tabla `profiles`.
- Iniciar sesión con el nombre de usuario.
- Borrar la cuenta, cambiar el correo, vincular identidades y 2FA.
- Más proveedores OAuth.
- Pasar a Supabase las puntuaciones de los placeholders.
- Perfil público y «mis puntuaciones» en el Salón de la Fama.
- Rediseño visual de `/auth`.

Cada uno, si llega, va en su propia spec.
