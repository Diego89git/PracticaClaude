// SPEC 24: piezas comunes de las pantallas de /auth/* y /cuenta.
// Reutilizan .auth-card y .auth-header de globals.css (mismo aspecto que /auth).

export function AuthTarjeta({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">{titulo}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

// Error en magenta (role="alert") o confirmación en cian (role="status").
export function AuthMensaje({
  error,
  ok,
}: {
  error?: string | null;
  ok?: string | null;
}) {
  if (error) {
    return (
      <div className="auth-msg err" role="alert">
        {error}
      </div>
    );
  }
  if (ok) {
    return (
      <div className="auth-msg ok" role="status">
        {ok}
      </div>
    );
  }
  return null;
}
