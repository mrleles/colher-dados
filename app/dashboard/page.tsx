import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { redirect } from "next/navigation";
import styles from "./dashboard.module.css";
import CreateSessionForm from "./create-session-form";
import CopySessionLink from "./copy-session-link";
import { AccordionCard, AccordionCards } from "./accordion-cards";

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
  collected_at: string;
};

type AndroidMetricRow = {
  session_id: string;
  android_version: string;
  sdk_int: number;
  manufacturer: string;
  model: string;
  connection_type: string;
  vpn_active: boolean;
  active_interface: string | null;
  dns_servers: string[];
  private_dns_active: boolean;
  private_dns_server_name: string | null;
  gateway: string | null;
  collected_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
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

  const [{ data: metrics, error: metricsError }, { data: androidMetrics, error: androidMetricsError }] = await Promise.all([
    sessionIds.length
      ? supabaseAdmin.from("telemetry_metrics").select(
          "session_id, device_brand, device_model_name, ram_gb, battery_level, dns_server, client_ip, isp, collected_at",
        ).in("session_id", sessionIds)
      : Promise.resolve({ data: [], error: null }),
    sessionIds.length
      ? supabaseAdmin.from("telemetry_android_metrics").select(
          "session_id, android_version, sdk_int, manufacturer, model, connection_type, vpn_active, active_interface, dns_servers, private_dns_active, private_dns_server_name, gateway, collected_at",
        ).in("session_id", sessionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (metricsError) throw new Error("Não foi possível carregar as métricas.");
  if (androidMetricsError) throw new Error("Não foi possível carregar os diagnósticos Android. Verifique se a migração docs/migration-android-dns.sql foi aplicada.");

  const metricBySession = new Map(
    ((metrics ?? []) as MetricRow[]).map((metric) => [metric.session_id, metric]),
  );
  const androidMetricBySession = new Map(
    ((androidMetrics ?? []) as AndroidMetricRow[]).map((metric) => [metric.session_id, metric]),
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
          <AccordionCards initialOpenId={sessionRows[0].id}>
            {sessionRows.map((session) => {
              const metric = metricBySession.get(session.id);
              const androidMetric = androidMetricBySession.get(session.id);
              const status = statusFor(session, metric ?? (androidMetric as unknown as MetricRow | undefined));
              return (
                <AccordionCard
                  key={session.id}
                  id={session.id}
                  protocolId={session.protocol_id}
                  statusLabel={status.label}
                  statusClassName={status.className}
                >
                  <div className={styles.infoGrid}>
                    <InfoItem label="Marca" value={metric?.device_brand ?? "Não informado"} />
                    <InfoItem label="Modelo comercial" value={metric?.device_model_name ?? "Não identificado"} />
                    <InfoItem label="RAM" value={formatNumber(metric?.ram_gb ?? null, " GB")} />
                    <InfoItem label="Bateria" value={formatNumber(metric?.battery_level ?? null, "%")} />
                    <InfoItem label="Provedor (ISP)" value={metric?.isp ?? "Não identificado"} />
                    <InfoItem label="IP público" value={metric?.client_ip ?? "Não informado"} />
                    <div className={styles.infoItem}>
                      <span>Resolvedor DNS observado</span>
                      <strong title={metric?.dns_server ?? "Não identificado"}>{metric?.dns_server ?? "Não identificado"}</strong>
                      <small className={styles.infoHelp}>
                        Identificado pelas consultas DNS do teste. Pode ser diferente do DNS configurado no dispositivo ou roteador.
                      </small>
                    </div>
                    <InfoItem label="Data da coleta" value={formatDate(metric?.collected_at ?? null)} />
                  </div>

                  <section style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #25313d" }}>
                    <h4 style={{ margin: "0 0 12px", color: "#e4eaf1" }}>Diagnóstico nativo Android</h4>
                    {androidMetric ? (
                      <>
                        <div className={styles.infoGrid}>
                          <InfoItem label="Origem" value="Aplicativo Colher Dados" />
                          <InfoItem label="Versão Android" value={androidMetric.android_version + " (API " + androidMetric.sdk_int + ")"} />
                          <InfoItem label="Dispositivo" value={androidMetric.manufacturer + " " + androidMetric.model} />
                          <InfoItem label="Conexão" value={androidMetric.connection_type} />
                          <InfoItem label="Interface" value={androidMetric.active_interface ?? "Não informada"} />
                          <InfoItem label="VPN" value={androidMetric.vpn_active ? "Detectada" : "Não detectada"} />
                          <InfoItem label="DNS disponibilizado ao link" value={(androidMetric.dns_servers ?? []).join(", ") || "Não informado"} />
                          <InfoItem label="Private DNS" value={androidMetric.private_dns_active ? "Ativo" : "Inativo"} />
                          <InfoItem label="Hostname Private DNS" value={androidMetric.private_dns_server_name ?? "Não informado"} />
                          <InfoItem label="Gateway padrão" value={androidMetric.gateway ?? "Não informado"} />
                          <InfoItem label="Coleta Android" value={formatDate(androidMetric.collected_at)} />
                        </div>
                        <small className={styles.infoHelp}>
                          DNS informado pelo Android para a rede ativa. Não comprova a origem DHCP nem identifica o DNS upstream do roteador. Com VPN ativa, os servidores podem pertencer à VPN.
                        </small>
                      </>
                    ) : (
                      <p style={{ margin: 0, color: "#8ea2b8", fontSize: 13 }}>Aguardando diagnóstico pelo aplicativo Android.</p>
                    )}
                  </section>

                  {!metric && !androidMetric && new Date(session.expires_at) > new Date() ? (
                    <div className={styles.cardFooter}>
                      <span>Link válido até {formatDate(session.expires_at)}</span>
                      <CopySessionLink sessionId={session.id} />
                    </div>
                  ) : null}
                </AccordionCard>
              );
            })}
          </AccordionCards>
        </section>
      )}
    </main>
  );
}
