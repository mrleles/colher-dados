"use client";

import { FormEvent, useState } from "react";
import styles from "./dashboard.module.css";

export default function CreateSessionForm() {
  const [url, setUrl] = useState<string | null>(null);
  const [protocolId, setProtocolId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setUrl(null);
    setProtocolId(null);
    setExpiresAt(null);
    setCopied(false);

    try {
      const response = await fetch("/api/telemetry/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error ?? "Não foi possível criar a coleta.");

      setProtocolId(data.protocolId);
      setUrl(data.url);
      setExpiresAt(data.expiresAt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <section className={styles.generator}>
      <div className={styles.generatorHeader}>
        <div>
          <span className={styles.eyebrow}>NOVA COLETA</span>
          <h2>Gerar link para o cliente</h2>
          <p>O protocolo é criado automaticamente com base na data e hora da solicitação.</p>
        </div>
      </div>

      <form className={styles.generatorForm} onSubmit={createSession}>
        <button className={styles.generateButton} type="submit" disabled={loading}>
          {loading ? "Gerando…" : "Gerar link de coleta"}
        </button>
      </form>

      {url && (
        <div className={styles.generated}>
          <div className={styles.generatedMeta}>
            <div>
              <span>Protocolo</span>
              <strong>{protocolId}</strong>
            </div>
            <div>
              <span>Válido até</span>
              <strong>{expiresAt ? new Date(expiresAt).toLocaleString("pt-BR") : "60 minutos"}</strong>
            </div>
          </div>
          <div className={styles.linkRow}>
            <input readOnly value={url} aria-label="Link de coleta" />
            <button type="button" onClick={() => void copyLink()}>
              {copied ? "✓ Copiado" : "Copiar link"}
            </button>
          </div>
        </div>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}
