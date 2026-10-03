"use client";

import { FormEvent, useState } from "react";

export default function HomePage() {
  const [protocolId, setProtocolId] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setUrl(null);

    try {
      const response = await fetch("/api/telemetry/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocolId }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error ?? "Não foi possível criar a coleta.");

      setUrl(data.url);
      setExpiresAt(data.expiresAt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Colher Dados</h1>
      <p>Gere um link temporário para coleta de telemetria.</p>

      <form onSubmit={createSession}>
        <label htmlFor="protocolId">Protocolo</label>
        <input
          id="protocolId"
          value={protocolId}
          onChange={(event) => setProtocolId(event.target.value)}
          maxLength={100}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Gerando…" : "Gerar link"}
        </button>
      </form>

      {url && (
        <section>
          <p>Link válido até {expiresAt ? new Date(expiresAt).toLocaleString("pt-BR") : "60 minutos"}.</p>
          <input readOnly value={url} aria-label="Link de coleta" />
          <button type="button" onClick={() => void navigator.clipboard.writeText(url)}>
            Copiar link
          </button>
        </section>
      )}

      {error && <p role="alert">{error}</p>}
    </main>
  );
}
