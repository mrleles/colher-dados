export const runtime = "edge";
export const dynamic = "force-dynamic";

const MAX_RESPONSE_BYTES = 64 * 1024;
const TEST_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

type RouteContext = {
  params: Promise<{ testId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { testId } = await context.params;

  // Restrict this endpoint to the test identifiers returned by dnsleak.dev;
  // it must never become a general-purpose URL proxy.
  if (!TEST_ID_PATTERN.test(testId)) {
    return Response.json(
      { error: "Identificador de teste DNS inválido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const upstream = await fetch(
      `https://dnsleak.dev/api/result/${encodeURIComponent(testId)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      },
    );

    if (!upstream.ok) {
      console.error("[telemetry:dns] upstream result request failed", {
        status: upstream.status,
      });
      return Response.json(
        { error: "O serviço externo não conseguiu consultar o resultado DNS." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const declaredLength = Number(upstream.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_RESPONSE_BYTES) {
      return Response.json(
        { error: "O serviço externo retornou uma resposta muito grande." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const body = await upstream.text();
    if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) {
      return Response.json(
        { error: "O serviço externo retornou uma resposta muito grande." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      return Response.json(
        { error: "O serviço externo retornou um resultado DNS inválido." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return Response.json(
        { error: "O serviço externo retornou um resultado DNS inválido." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (cause) {
    console.error("[telemetry:dns] result request failed", {
      error: cause instanceof Error ? cause.name : "unknown",
    });
    return Response.json(
      { error: "Não foi possível consultar o resultado do teste DNS." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
