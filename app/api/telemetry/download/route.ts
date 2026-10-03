const SIZE = 1024 * 1024;

export function GET() {
  const payload = new Uint8Array(SIZE);
  return new Response(payload, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(SIZE),
      "Cache-Control": "no-store",
    },
  });
}
