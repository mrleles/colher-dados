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

    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json(
      { error: "Não foi possível iniciar o teste DNS externo." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
