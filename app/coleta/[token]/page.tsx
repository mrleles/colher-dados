"use client";

import { useEffect, useRef, useState } from "react";
import { collectBatteryLevel, collectDeviceInfo } from "@/lib/telemetry/device";
import { findNearestOoklaServer, measureOoklaDownload } from "@/lib/telemetry/ookla-browser";

type Status = "coletando" | "enviando" | "sucesso" | "erro";

type NetworkInformation = {
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformation;
  deviceMemory?: number;
};

type DnsLeakResult = {
  resolvers?: Array<{
    role?: string;
    operator?: string;
    hostname?: string;
    count?: number;
    transport?: string;
    members?: string[];
  }>;
};

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function probeDnsHostname(hostname: string) {
  return new Promise<void>((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.src = "";
      resolve();
    }, 1500);

    const finish = () => {
      window.clearTimeout(timeout);
      resolve();
    };

    image.onload = finish;
    image.onerror = finish;
    image.src = `https://${hostname}/`;
  });
}

function formatDnsResolver(resolver: NonNullable<DnsLeakResult["resolvers"]>[number]) {
  const operator = resolver.operator?.trim();
  const hostname = resolver.hostname?.trim();
  const address = resolver.members?.[0]?.trim();

  if (operator && address) return `${operator} (${address})`;
  return operator || hostname || address || null;
}

async function collectDnsServer(): Promise<string | null> {
  try {
    const response = await fetch("https://dnsleak.dev/api/new", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { testId?: string; hostnames?: string[] };
    if (!data.testId || !Array.isArray(data.hostnames) || data.hostnames.length === 0) return null;

    await Promise.all(data.hostnames.map(probeDnsHostname));

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 1000 : 500));

      const resultResponse = await fetch(
        `https://dnsleak.dev/api/result/${encodeURIComponent(data.testId)}`,
        {
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );

      if (!resultResponse.ok) continue;

      const result = (await resultResponse.json()) as DnsLeakResult;
      const resolvers = (result.resolvers ?? [])
        .filter((resolver) => resolver.role === "resolver")
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

      const values = resolvers
        .map(formatDnsResolver)
        .filter((value): value is string => Boolean(value));

      if (values.length) {
        return [...new Set(values)].slice(0, 3).join(", ").slice(0, 255);
      }
    }
  } catch {
    // DNS identification is best-effort and must never block the collection.
  }

  return null;
}

async function collectMetrics() {
  const nav = navigator as NavigatorWithConnection;
  const connection = nav.connection;
  const userAgent = navigator.userAgent;
  const device = await collectDeviceInfo(userAgent);
  const batteryLevel = await collectBatteryLevel();
  const dnsServer = await collectDnsServer();

  const nearest = await findNearestOoklaServer();
  const downloadResult = await measureOoklaDownload(nearest.selected);
  const pingMedian = downloadResult.latencyMs;
  const downloadSpeed = downloadResult.downloadMbps;

  return {
    userAgent,
    os: device.os,
    deviceBrand: device.brand,
    deviceModel: device.model,
    ramGb: nav.deviceMemory ?? null,
    batteryLevel,
    dnsServer,
    // No standard browser API exposes SSID, Wi-Fi frequency or RSSI.
    wifiSsid: null,
    wifiFrequencyMhz: null,
    wifiSignalStrengthDbm: null,
    netEffectiveType: connection?.effectiveType ?? null,
    netRtt: connection?.rtt ?? null,
    netSaveData: connection?.saveData ?? null,
    pingMedian,
    downloadSpeed,
  };
}

export default function CollectionPage({ params }: { params: Promise<{ token: string }> }) {
  const [status, setStatus] = useState<Status>("coletando");
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        const { token } = await params;
        const metrics = await collectMetrics();
        setStatus("enviando");

        const response = await fetch("/api/telemetry/collect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, metrics }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? "Não foi possível enviar os dados.");
        }

        setStatus("sucesso");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Erro inesperado.");
        setStatus("erro");
      }
    })();
  }, [params]);

  return (
    <main>
      <h1>Verificação de conexão</h1>
      {status === "coletando" && <p>Coletando dados do dispositivo e da conexão…</p>}
      {status === "enviando" && <p>Enviando os dados ao atendente…</p>}
      {status === "sucesso" && <p>Dados enviados ao atendente.</p>}
      {status === "erro" && <p>{error}</p>}
    </main>
  );
}
