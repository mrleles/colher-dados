import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createTelemetryToken } from "@/lib/telemetry/token";

const bodySchema = z.object({
  protocolId: z.string().trim().min(1).max(100),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json({ error: "protocolId inválido." }, { status: 400 });
  }

  const { id, expiresAt } = createTelemetryToken();

  const { error } = await supabaseAdmin.from("telemetry_sessions").insert({
    id,
    protocol_id: parsed.data.protocolId,
    expires_at: expiresAt.toISOString(),
    is_used: false,
  });

  if (error) {
    console.error("Failed to create telemetry session", error);
    return Response.json({ error: "Não foi possível criar a coleta." }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return Response.json({
    token: id,
    url: new URL(`/coleta/${id}`, baseUrl).toString(),
    expiresAt: expiresAt.toISOString(),
  });
}
