 "use client";

import { FormEvent, useState } from "react";
import styles from "./dashboard.module.css";

export default function CreateSessionForm() {
  const [url, setUrl] = useState<string | null>(null);
  const [protocolId, setProtocolId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [appLink, setAppLink] = useState<string | null>(null);
  const [androidCopied, setAndroidCopied] = useState(false);
  const [androidError, setAndroidError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setAndroidError(null);
    setUrl(null);
    setAppLink(null);
    setAndroidCopied(false);
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

      const androidResponse = await fetch("/api/telemetry/android/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: data.token }),
      });
      const androidData = await androidResponse.json();
      if (!androidResponse.ok) {
        setAndroidError(androidData.error ?? "Não foi possível preparar o aplicativo Android.");
      } else {
        setAppLink("colherdados://diagnostico?token=" + encodeURIComponent(androidData.token));
      }
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

  async function copyAndroidLink() {
    if (!appLink) return;
    await navigator.clipboard.writeText(appLink);
    setAndroidCopied(true);
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
            <div><span>Protocolo</span><strong>{protocolId}</strong></div>
            <div><span>Válido até</span><strong>{expiresAt ? new Date(expiresAt).toLocaleString("pt-BR") : "60 minutos"}</strong></div>
          </div>
          <div className={styles.linkRow}>
            <input readOnly value={url} aria-label="Link de coleta" />
            <button type="button" onClick={() => void copyLink()}>{copied ? "✓ Copiado" : "Copiar link"}</button>
          </div>
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #273341" }}>
            <strong style={{ display: "block", marginBottom: 7 }}>Diagnóstico complementar Android</strong>
            <p style={{ margin: "0 0 12px", color: "#8ea2b8", fontSize: 13 }}>
              O cliente pode instalar o APK, abrir o aplicativo pelo link abaixo, revisar os dados de rede e autorizar o envio.
            </p>
            {appLink ? (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
                <a href={appLink} style={{ color: "#9bd8c5", fontWeight: 700 }}>Abrir no aplicativo Colher Dados</a>
                <button type="button" onClick={() => void copyAndroidLink()}>{androidCopied ? "✓ Link do app copiado" : "Copiar link para o cliente"}</button>
              </div>
            ) : (
              <p style={{ color: "#ef9299", fontSize: 13 }}>{androidError ?? "Autorização Android não disponível."}</p>
            )}
            <p style={{ margin: "12px 0 0" }}>
              <a href="/api/telemetry/download" style={{ color: "#93c5fd" }}>Baixar APK Android</a>
            </p>
          </div>
        </div>
      )}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </section>
  );
}
