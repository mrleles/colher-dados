import { createHash } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

const metricsSchema = z.object({
  appVersion: z.string().max(32),
  androidVersion: z.string().max(40),
  sdkInt: z.number().int().min(28).max(100),
  manufacturer: z.string().max(100),
  model: z.string().max(120),
  connectionType: z.enum(["wifi", "cellular", "ethernet", "vpn", "other", "none"]),
  internetAvailable: z.boolean(),
  internetValidated: z.boolean(),
  captivePortal: z.boolean(),
  vpnActive: z.boolean(),
  activeInterface: z.string().max(100).nullable(),
  dnsServers: z.array(z.string().max(100)).max(16),
  privateDnsActive: z.boolean(),
  privateDnsServerName: z.string().max(253).nullable(),
  gateway: z.string().max(100).nullable(),
  routes: z.array(z.object({ destination: z.string().max(100), gateway: z.string().max(100).nullable(), default: z.boolean() })).max(64),
  localAddresses: z.array(z.string().max(100)).max(32),
  clientCollectedAt: z.string().datetime(),
});
const bodySchema = z.object({ token: z.string().min(40).max(100), metrics: metricsSchema });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Dados do aplicativo inválidos." }, { status: 400 });

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const { error } = await supabaseAdmin.rpc("submit_android_telemetry", {
    p_token_hash: tokenHash, p_metrics: parsed.data.metrics,
  });
  if (error) {
    if (error.message.includes("invalid_or_expired_android_token")) {
      return Response.json({ error: "Autorização inválida, expirada ou já utilizada." }, { status: 410 });
    }
    console.error("Failed to submit Android telemetry");
    return Response.json({ error: "Não foi possível salvar o diagnóstico." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
