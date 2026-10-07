import { isIP } from "node:net";

function firstValidIp(value: string | null) {
  if (!value) return null;
  for (const candidate of value.split(",")) {
    const ip = candidate.trim();
    if (isIP(ip)) return ip;
  }
  return null;
}

function getClientIp(request: Request) {
  return firstValidIp(request.headers.get("x-forwarded-for")) ?? firstValidIp(request.headers.get("x-real-ip"));
}

type IpApiResponse = { is_bogon?: boolean; company?: string | null };

export type ClientNetwork = { ip: string | null; isp: string | null };

export async function resolveClientNetwork(request: Request): Promise<ClientNetwork> {
  const ip = getClientIp(request);
  if (!ip || !isIP(ip)) return { ip: null, isp: null };
  if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return { ip, isp: null };
  }

  try {
    const response = await fetch('https://api.ipapi.is/?q=' + encodeURIComponent(ip), {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return { ip, isp: null };
    const data = (await response.json()) as IpApiResponse;
    return { ip, isp: data.is_bogon ? null : data.company?.trim() || null };
  } catch {
    return { ip, isp: null };
  }
}
