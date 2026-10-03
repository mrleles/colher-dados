import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

const metricsSchema = z.object({
  userAgent: z.string().max(2000).optional().nullable(),
  os: z.string().max(100).optional().nullable(),
  deviceModel: z.string().max(255).optional().nullable(),
  ramGb: z.number().finite().nonnegative().optional().nullable(),
  cpuCores: z.number().int().positive().optional().nullable(),
  screenRes: z.string().max(32).optional().nullable(),
  netEffectiveType: z.string().max(16).optional().nullable(),
  netRtt: z.number().int().nonnegative().optional().nullable(),
  netSaveData: z.boolean().optional().nullable(),
  pingMedian: z.number().finite().nonnegative().optional().nullable(),
  downloadSpeed: z.number().finite().nonnegative().optional().nullable(),
});

const bodySchema = z.object({
  token: z.string().uuid(),
  metrics: metricsSchema,
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json({ error: "Dados de telemetria inválidos." }, { status: 400 });
  }

  const { token, metrics } = parsed.data;

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("telemetry_sessions")
    .select("id, expires_at, is_used")
    .eq("id", token)
    .maybeSingle();

  if (sessionError) {
    console.error("Failed to validate telemetry session", sessionError);
    return Response.json({ error: "Não foi possível validar a coleta." }, { status: 500 });
  }

  if (!session || session.is_used || new Date(session.expires_at).getTime() <= Date.now()) {
    return Response.json({ error: "Link de coleta inválido, expirado ou já utilizado." }, { status: 410 });
  }

  const { error: metricsError } = await supabaseAdmin.from("telemetry_metrics").insert({
    session_id: token,
    user_agent: metrics.userAgent,
    os: metrics.os,
    device_model: metrics.deviceModel,
    ram_gb: metrics.ramGb,
    cpu_cores: metrics.cpuCores,
    screen_res: metrics.screenRes,
    net_effective_type: metrics.netEffectiveType,
    net_rtt: metrics.netRtt,
    net_save_data: metrics.netSaveData,
    ping_median: metrics.pingMedian,
    download_speed: metrics.downloadSpeed,
  });

  if (metricsError) {
    console.error("Failed to save telemetry metrics", metricsError);
    return Response.json({ error: "Não foi possível salvar os dados." }, { status: 500 });
  }

  const { error: consumeError } = await supabaseAdmin
    .from("telemetry_sessions")
    .update({ is_used: true })
    .eq("id", token)
    .eq("is_used", false);

  if (consumeError) {
    console.error("Failed to consume telemetry session", consumeError);
    return Response.json({ error: "Os dados foram salvos, mas a sessão não pôde ser encerrada." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
