import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

const bodySchema = z.object({ sessionToken: z.string().uuid() });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Sessão de diagnóstico inválida." }, { status: 400 });

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("telemetry_sessions").select("id, expires_at")
    .eq("id", parsed.data.sessionToken).gt("expires_at", new Date().toISOString()).maybeSingle();

  if (sessionError) {
    console.error("Failed to validate Android session");
    return Response.json({ error: "Não foi possível validar a sessão." }, { status: 500 });
  }
  if (!session) return Response.json({ error: "Sessão inválida ou expirada." }, { status: 410 });

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabaseAdmin.from("telemetry_android_tokens").insert({
    session_id: session.id, token_hash: tokenHash, expires_at: session.expires_at,
  });
  if (error) {
    if (error.code === "23505") return Response.json({ error: "Esta sessão já possui uma autorização Android." }, { status: 409 });
    console.error("Failed to issue Android token");
    return Response.json({ error: "Não foi possível preparar o aplicativo." }, { status: 500 });
  }
  return Response.json({ token, expiresAt: session.expires_at });
}
