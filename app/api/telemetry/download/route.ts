export function GET() {
  const target = process.env.ANDROID_APK_URL ?? "https://github.com/mrleles/colher-dados/releases/latest/download/colher-dados.apk";
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return Response.json({ error: "URL de distribuição do APK inválida." }, { status: 500 });
  }
  if (url.protocol !== "https:") {
    return Response.json({ error: "O download do APK deve utilizar HTTPS." }, { status: 500 });
  }
  return Response.redirect(url, 302);
}
