import { randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createTelemetryToken } from "@/lib/telemetry/token";

function createProtocolId() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const timestamp = `${values.year}${values.month}${values.day}-${values.hour}${values.minute}${values.second}`;
  const suffix = randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase();

  return `${timestamp}-${suffix}`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();

  if (!claimsData?.claims?.sub) {
    return Response.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { id, expiresAt } = createTelemetryToken();
  const protocolId = createProtocolId();

  const { error } = await supabaseAdmin.from("telemetry_sessions").insert({
    id,
    protocol_id: protocolId,
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
    protocolId,
    url: new URL(`/coleta/${id}`, baseUrl).toString(),
    expiresAt: expiresAt.toISOString(),
  });
}
