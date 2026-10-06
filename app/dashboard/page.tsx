import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { redirect } from "next/navigation";
import styles from "./dashboard.module.css";
import CreateSessionForm from "./create-session-form";
import CopySessionLink from "./copy-session-link";

export const dynamic = "force-dynamic";

type SessionRow = {
  id: string;
  protocol_id: string;
  created_at: string;
  expires_at: string;
  is_used: boolean;
};

type MetricRow = {
  session_id: string;
  os: string | null;
  device_brand: string | null;
  device_model: string | null;
  ram_gb: number | null;
  wifi_ssid: string | null;
  wifi_frequency_mhz: number | null;
  wifi_signal_strength_dbm: number | null;
  ping_median: number | null;
  download_speed: number | null;
  collected_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatNumber(value: number | null, suffix = "") {
  if (value === null || value === undefined) return "Não informado";
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

function statusFor(session: SessionRow, metric?: MetricRow) {
  if (metric) return { label: "Coletado", className: styles.statusSuccess };
  if (new Date(session.expires_at) <= new Date()) {
    return { label: "Expirado", className: styles.statusExpired };
  }
  return { label: "Aguardando", className: styles.statusWaiting };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    redirect("/login");
  }

  const { data: sessions, error: sessionsError } = await supabaseAdmin
    .from("telemetry_sessions")
    .select("id, protocol_id, created_at, expires_at, is_used")
    .order("created_at", { ascending: false })
    .limit(100);

  if (sessionsError) throw new Error("Não foi possível carregar as sessões.");

  const sessionRows = (sessions ?? []) as SessionRow[];
  const sessionIds = sessionRows.map((session) => session.id);

  const { data: metrics, error: metricsError } = sessionIds.length
    ? await supabaseAdmin
        .from("telemetry_metrics")
        .select(
          "session_id, os, device_brand, device_model, ram_gb, wifi_ssid, wifi_frequency_mhz, wifi_signal_strength_dbm, ping_median, download_speed, collected_at",
        )
        .in("session_id", sessionIds)
    : { data: [], error: null };

  if (metricsError) throw new Error("Não foi possível carregar as métricas.");

  const metricBySession = new Map(
    ((metrics ?? []) as MetricRow[]).map((metric) => [metric.session_id, metric]),
  );

  const collectedCount = sessionRows.filter((session) => metricBySession.has(session.id)).length;
  const waitingCount = sessionRows.filter(
    (session) => !metricBySession.has(session.id) && new Date(session.expires_at) > new Date(),
  ).length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ATENDIMENTO</span>
          <h1>Dashboard de telemetria</h1>
          <p>Gere links e acompanhe as coletas realizadas pelos clientes.</p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.refresh} href="/dashboard">Atualizar</a>
          <form action={logout}>
            <button className={styles.logout} type="submit">Sair</button>
          </form>
        </div>
      </header>

      <CreateSessionForm />

      <section className={styles.summary} aria-label="Resumo das coletas">
        <article><span>Total de coletas</span><strong>{sessionRows.length}</strong></article>
        <article><span>Coletadas</span><strong>{collectedCount}</strong></article>
        <article><span>Aguardando</span><strong>{waitingCount}</strong></article>
      </section>

      {sessionRows.length === 0 ? (
        <section className={styles.empty}>
          <h2>Nenhuma coleta encontrada</h2>
          <p>Use o botão acima para gerar o primeiro link de coleta.</p>
        </section>
      ) : (
        <section className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div><h2>Coletas recentes</h2><p>Últimas 100 sessões, da mais recente para a mais antiga.</p></div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Protocolo</th><th>Status</th><th>Link</th><th>Marca</th><th>Modelo</th><th>SO</th>
                  <th>RAM</th><th>Wi-Fi</th><th>Frequência</th><th>Sinal</th><th>Ping</th><th>Download</th><th>Coleta</th>
                </tr>
              </thead>
              <tbody>
                {sessionRows.map((session) => {
                  const metric = metricBySession.get(session.id);
                  const status = statusFor(session, metric);
                  return (
                    <tr key={session.id}>
                      <td className={styles.protocol}>{session.protocol_id}</td>
                      <td><span className={`${styles.status} ${status.className}`}>{status.label}</span></td>
                      <td>{!metric && new Date(session.expires_at) > new Date() ? <CopySessionLink sessionId={session.id} /> : "—"}</td>
                      <td>{metric?.device_brand ?? "Não informado"}</td>
                      <td>{metric?.device_model ?? "Não informado"}</td>
                      <td>{metric?.os ?? "Não informado"}</td>
                      <td>{formatNumber(metric?.ram_gb ?? null, " GB")}</td>
                      <td>{metric?.wifi_ssid ?? "Não disponível via navegador"}</td>
                      <td>{metric?.wifi_frequency_mhz != null ? `${metric.wifi_frequency_mhz} MHz` : "Não disponível via navegador"}</td>
                      <td>{metric?.wifi_signal_strength_dbm != null ? `${metric.wifi_signal_strength_dbm} dBm` : "Não disponível via navegador"}</td>
                      <td>{formatNumber(metric?.ping_median ?? null, " ms")}</td>
                      <td>{formatNumber(metric?.download_speed ?? null, " Mbps")}</td>
                      <td>{formatDate(metric?.collected_at ?? null)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
