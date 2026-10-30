export const runtime = "edge";
export const dynamic = "force-dynamic";

const MAX_HOSTNAMES = 100;
const DNS_HOSTNAME_PATTERN = /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*\.?$/;
const TEST_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

function isDnsTestPayload(value: unknown): value is { testId: string; hostnames: string[] } {
  if (!value || typeof value !== "object") return false;

  const payload = value as { testId?: unknown; hostnames?: unknown };
  return (
    typeof payload.testId === "string" &&
    TEST_ID_PATTERN.test(payload.testId) &&
    Array.isArray(payload.hostnames) &&
    payload.hostnames.length > 0 &&
    payload.hostnames.length <= MAX_HOSTNAMES &&
    payload.hostnames.every(
      (hostname) => typeof hostname === "string" && DNS_HOSTNAME_PATTERN.test(hostname),
    )
  );
}

export async function GET() {
  try {
    const upstream = await fetch("https://dnsleak.dev/api/new", {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = await upstream.text();
    const contentType = upstream.headers.get("content-type") ?? "";

    if (!upstream.ok) {
      console.error("[telemetry:dns] upstream create-test failed", {
        status: upstream.status,
        contentType,
      });
      return Response.json(
        { error: "O serviço externo de DNS não conseguiu iniciar o teste." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      console.error("[telemetry:dns] upstream create-test returned invalid JSON", {
        status: upstream.status,
        contentType,
        bodyLength: body.length,
      });
      return Response.json(
        { error: "O serviço externo de DNS retornou uma resposta inválida." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!isDnsTestPayload(data)) {
      console.error("[telemetry:dns] upstream create-test returned an unexpected payload", {
        status: upstream.status,
        contentType,
      });
      return Response.json(
        { error: "O serviço externo de DNS retornou dados incompletos ou inválidos." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    console.error("[telemetry:dns] create-test request failed", {
      error: cause instanceof Error ? cause.name : "unknown",
    });
    return Response.json(
      { error: "Não foi possível iniciar o teste DNS externo." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
