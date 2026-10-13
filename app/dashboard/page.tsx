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
  device_brand: string | null;
  device_model_name: string | null;
  ram_gb: number | null;
  battery_level: number | null;
  dns_server: string | null;
  client_ip: string | null;
  isp: string | null;
  ping_median: number | null;
  download_speed: number | null;
  ookla_server_id: number | null;
  ookla_server_name: string | null;
  ookla_server_city: string | null;
  ookla_server_host: string | null;
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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoItem}>
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  );
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
          "session_id, device_brand, device_model_name, ram_gb, battery_level, dns_server, client_ip, isp, ping_median, download_speed, ookla_server_id, ookla_server_name, ookla_server_city, ookla_server_host, collected_at",
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
        <section className={styles.collectionSection}>
          <div className={styles.collectionHeader}>
            <div>
              <h2>Coletas recentes</h2>
              <p>Últimas 100 sessões, da mais recente para a mais antiga.</p>
            </div>
          </div>
          <div className={styles.collectionGrid}>
            {sessionRows.map((session) => {
              const metric = metricBySession.get(session.id);
              const status = statusFor(session, metric);
              const serverName = metric
                ? `${metric.ookla_server_name ?? "Não identificado"} — ${metric.ookla_server_city ?? "cidade não informada"}${metric.ookla_server_id ? ` (ID ${metric.ookla_server_id})` : ""}`
                : "Aguardando teste de velocidade";

              return (
                <article className={styles.collectionCard} key={session.id}>
                  <div className={styles.cardHeader}>
                    <div>
                      <span className={styles.cardEyebrow}>PROTOCOLO</span>
                      <h3>{session.protocol_id}</h3>
                    </div>
                    <span className={`${styles.status} ${status.className}`}>{status.label}</span>
                  </div>

                  <div className={styles.speedPanel}>
                    <div className={styles.speedItem}>
                      <span>Download</span>
                      <strong>{formatNumber(metric?.download_speed ?? null, " Mbps")}</strong>
                    </div>
                    <div className={styles.speedDivider} />
                    <div className={styles.speedItem}>
                      <span>Ping</span>
                      <strong>{formatNumber(metric?.ping_median ?? null, " ms")}</strong>
                    </div>
                  </div>

                  <div className={styles.serverPanel}>
                    <span>Servidor de teste</span>
                    <strong>{serverName}</strong>
                    {metric?.ookla_server_host ? <small>{metric.ookla_server_host}</small> : null}
                  </div>

                  <div className={styles.infoGrid}>
                    <InfoItem label="Marca" value={metric?.device_brand ?? "Não informado"} />
                    <InfoItem label="Modelo comercial" value={metric?.device_model_name ?? "Não identificado"} />
                    <InfoItem label="RAM" value={formatNumber(metric?.ram_gb ?? null, " GB")} />
                    <InfoItem label="Bateria" value={formatNumber(metric?.battery_level ?? null, "%")} />
                    <InfoItem label="Provedor (ISP)" value={metric?.isp ?? "Não identificado"} />
                    <InfoItem label="IP público" value={metric?.client_ip ?? "Não informado"} />
                    <InfoItem label="DNS" value={metric?.dns_server ?? "Não identificado"} />
                    <InfoItem label="Data da coleta" value={formatDate(metric?.collected_at ?? null)} />
                  </div>

                  {!metric && new Date(session.expires_at) > new Date() ? (
                    <div className={styles.cardFooter}>
                      <span>Link válido até {formatDate(session.expires_at)}</span>
                      <CopySessionLink sessionId={session.id} />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
