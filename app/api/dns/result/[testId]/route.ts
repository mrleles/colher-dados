export const runtime = "edge";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ testId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { testId } = await context.params;

  // Restrict this endpoint to the test identifiers returned by dnsleak.dev;
  // it must never become a general-purpose URL proxy.
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(testId)) {
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
    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "Não foi possível consultar o resultado do teste DNS." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
