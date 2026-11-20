// SPEC 24: utilidades de autenticación compartidas por el cliente, los
// Route Handlers de /auth y proxy.ts. Sin "use client": no usa APIs del navegador.

export const MENSAJES = {
  credenciales: "CORREO O CONTRASEÑA INCORRECTOS",
  sinConfirmar: "CONFIRMA TU CORREO ANTES DE ENTRAR",
  yaRegistrado: "ESE CORREO YA TIENE CUENTA",
  corta: "MÍNIMO 6 CARACTERES",
  noCoinciden: "LAS CONTRASEÑAS NO COINCIDEN",
  nombre: "NOMBRE DE 1 A 10 CARACTERES",
  limite: "DEMASIADOS INTENTOS, ESPERA UNOS MINUTOS",
  enlace: "EL ENLACE NO ES VÁLIDO O CADUCÓ",
  red: "NO SE PUDO CONECTAR, INTÉNTALO DE NUEVO",
} as const;

export const MIN_PASSWORD = 6;
export const RUTA_POR_DEFECTO = "/biblioteca";

// trim + mayúsculas; null si no tiene de 1 a 10 caracteres (igual que scores.player_name).
export function normalizarNombre(valor: string): string | null {
  const nombre = valor.trim().toUpperCase();
  return nombre.length >= 1 && nombre.length <= 10 ? nombre : null;
}

// Devuelve el mensaje de error de la contraseña o null si es válida.
export function validarPassword(
  pass: string,
  repetida?: string,
): string | null {
  if (pass.length < MIN_PASSWORD) return MENSAJES.corta;
  if (repetida !== undefined && pass !== repetida) return MENSAJES.noCoinciden;
  return null;
}

// Solo rutas internas ("/x"), nunca "//host" ni "/\host": evita redirecciones abiertas.
export function rutaInterna(
  next: string | null | undefined,
  porDefecto: string = RUTA_POR_DEFECTO,
): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return porDefecto;
  }
  return next;
}

// Traduce un error de Supabase Auth a los mensajes de la tabla de la spec.
export function mensajeDeError(error: unknown): string {
  const e = error as { code?: string; status?: number; name?: string } | null;
  switch (e?.code) {
    case "invalid_credentials":
      return MENSAJES.credenciales;
    case "email_not_confirmed":
      return MENSAJES.sinConfirmar;
    case "user_already_exists":
    case "email_exists":
      return MENSAJES.yaRegistrado;
    case "weak_password":
      return MENSAJES.corta;
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
    case "over_sms_send_rate_limit":
      return MENSAJES.limite;
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
      return MENSAJES.enlace;
  }
  if (e?.status === 429) return MENSAJES.limite;
  return MENSAJES.red;
}

// Texto de los errores que llegan por ?error= a /auth.
export function mensajeDeParametro(error: string | null): string | null {
  if (error === "enlace") return MENSAJES.enlace;
  if (error === "oauth") return MENSAJES.red;
  return null;
}
