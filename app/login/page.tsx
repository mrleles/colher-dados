import { login } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const hasError = params.error === "invalid";

  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: 24,
      background: "#0b0f14",
      color: "#e8edf3",
      fontFamily: "Arial, Helvetica, sans-serif",
    }}>
      <section style={{
        width: "100%",
        maxWidth: 420,
        padding: 32,
        border: "1px solid #202a35",
        borderRadius: 12,
        background: "#11171e",
      }}>
        <span style={{
          display: "block",
          marginBottom: 8,
          color: "#8ea2b8",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.12em",
        }}>
          ATENDIMENTO
        </span>
        <h1 style={{ margin: 0 }}>Entrar</h1>
        <p style={{ color: "#8ea2b8", lineHeight: 1.5 }}>
          Acesse o painel de telemetria.
        </p>

        {hasError && (
          <p role="alert" style={{
            padding: 12,
            borderRadius: 8,
            background: "#321b1d",
            color: "#ef9299",
          }}>
            E-mail ou senha inválidos.
          </p>
        )}

        <form action={login} style={{ display: "grid", gap: 16 }}>
          <label style={{ display: "grid", gap: 8 }}>
            <span>E-mail</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              style={{
                minHeight: 42,
                padding: "0 12px",
                border: "1px solid #273341",
                borderRadius: 8,
                background: "#0b0f14",
                color: "#e8edf3",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 8 }}>
            <span>Senha</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              style={{
                minHeight: 42,
                padding: "0 12px",
                border: "1px solid #273341",
                borderRadius: 8,
                background: "#0b0f14",
                color: "#e8edf3",
              }}
            />
          </label>

          <button type="submit" style={{
            minHeight: 42,
            border: 0,
            borderRadius: 8,
            background: "#e8edf3",
            color: "#0b0f14",
            fontWeight: 700,
            cursor: "pointer",
          }}>
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
