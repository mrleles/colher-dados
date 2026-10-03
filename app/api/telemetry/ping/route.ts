export function HEAD() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export function GET() {
  return new Response("ok", { headers: { "Cache-Control": "no-store" } });
}
