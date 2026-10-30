export const runtime = "edge";
export const dynamic = "force-dynamic";

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
        { error: "O serviço externo de DNS não conseguiu iniciar o teste.", upstreamStatus: upstream.status },
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

    if (
      !data ||
      typeof data !== "object" ||
      typeof (data as { testId?: unknown }).testId !== "string" ||
      !Array.isArray((data as { hostnames?: unknown }).hostnames)
    ) {
      console.error("[telemetry:dns] upstream create-test returned an unexpected payload", {
        status: upstream.status,
        contentType,
      });
      return Response.json(
        { error: "O serviço externo de DNS retornou dados incompletos." },
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
