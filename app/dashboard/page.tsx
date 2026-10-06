import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { redirect } from "next/navigation";
import styles from "./dashboard.module.css";
import Link from "next/link";

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
  ram_gb: number | null;
  cpu_cores: number | null;
  screen_res: string | null;
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
        .select("session_id, os, ram_gb, cpu_cores, screen_res, ping_median, download_speed, collected_at")
        .in("session_id", sessionIds)
    : { data: [], error: null };

  if (metricsError) throw new Error("Não foi possível carregar as métricas.");

  const metricBySession = new Map(
    ((metrics ?? []) as MetricRow[]).map((metric) => [metric.session_id, metric])
  );

  const collectedCount = sessionRows.filter((session) => metricBySession.has(session.id)).length;
  const waitingCount = sessionRows.filter(
    (session) => !metricBySession.has(session.id) && new Date(session.expires_at) > new Date()
  ).length;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>ATENDIMENTO</span>
          <h1>Dashboard de telemetria</h1>
          <p>Acompanhe as coletas realizadas pelos clientes.</p>
        </div>
        <div className={styles.headerActions}>
          <a className={styles.refresh} href="/dashboard">Atualizar</a>
          <form action={logout}>
            <button className={styles.logout} type="submit">Sair</button>
          </form>
        </div>
      </header>

      <section className={styles.summary} aria-label="Resumo das coletas">
        <article><span>Total de coletas</span><strong>{sessionRows.length}</strong></article>
        <article><span>Coletadas</span><strong>{collectedCount}</strong></article>
        <article><span>Aguardando</span><strong>{waitingCount}</strong></article>
      </section>

      {sessionRows.length === 0 ? (
        <section className={styles.empty}>
          <h2>Nenhuma coleta encontrada</h2>
          <p>Gere uma coleta na tela inicial para começar.</p>
          <Link href="/">Gerar coleta</Link>
        </section>
      ) : (
        <section className={styles.tableCard}>
          <div className={styles.tableHeader}>
            <div><h2>Coletas recentes</h2><p>Últimas 100 sessões, da mais recente para a mais antiga.</p></div>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Protocolo</th><th>Status</th><th>SO</th><th>RAM</th><th>CPU</th><th>Resolução</th><th>Ping</th><th>Download</th><th>Coleta</th></tr></thead>
              <tbody>
                {sessionRows.map((session) => {
                  const metric = metricBySession.get(session.id);
                  const status = statusFor(session, metric);
                  return (
                    <tr key={session.id}>
                      <td className={styles.protocol}>{session.protocol_id}</td>
                      <td><span className={`${styles.status} ${status.className}`}>{status.label}</span></td>
                      <td>{metric?.os ?? "Não informado"}</td>
                      <td>{formatNumber(metric?.ram_gb ?? null, " GB")}</td>
                      <td>{metric?.cpu_cores ?? "Não informado"}</td>
                      <td>{metric?.screen_res ?? "Não informado"}</td>
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

      <footer className={styles.footer}><Link href="/">← Voltar para gerar uma coleta</Link></footer>
    </main>
  );
}
