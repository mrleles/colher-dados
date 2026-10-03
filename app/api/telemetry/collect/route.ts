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

  const { error } = await supabaseAdmin.rpc("submit_telemetry", {
    p_session_id: token,
    p_user_agent: metrics.userAgent ?? null,
    p_os: metrics.os ?? null,
    p_device_model: metrics.deviceModel ?? null,
    p_ram_gb: metrics.ramGb ?? null,
    p_cpu_cores: metrics.cpuCores ?? null,
    p_screen_res: metrics.screenRes ?? null,
    p_net_effective_type: metrics.netEffectiveType ?? null,
    p_net_rtt: metrics.netRtt ?? null,
    p_net_save_data: metrics.netSaveData ?? null,
    p_ping_median: metrics.pingMedian ?? null,
    p_download_speed: metrics.downloadSpeed ?? null,
  });

  if (error) {
    if (error.message.includes("invalid_or_expired_session")) {
      return Response.json(
        { error: "Link de coleta inválido, expirado ou já utilizado." },
        { status: 410 },
      );
    }

    console.error("Failed to submit telemetry", error);
    return Response.json({ error: "Não foi possível salvar os dados." }, { status: 500 });
  }

  return Response.json({ ok: true });
}
