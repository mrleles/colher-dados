export default function ErrorPage() {
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
      <section>
        <h1>Não foi possível concluir a autenticação.</h1>
        <a href="/login" style={{ color: "#8ea2b8" }}>
          Voltar para o login
        </a>
      </section>
    </main>
  );
}
