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
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      resolve();
    };

    const timeout = window.setTimeout(finish, 2500);
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

function logDnsProgress(stage: string, detail: string) {
  // Progress logs help distinguish an unexecuted routine from a failed DNS lookup.
  // Do not include test IDs, customer tokens, IP addresses or probe hostnames.
  console.info(`[telemetry:dns] ${stage}: ${detail}`);
}

function logDnsDiagnostic(stage: string, detail: string) {
  // The collection remains best-effort. Diagnostics intentionally omit test IDs,
  // customer tokens, IP addresses and probe hostnames.
  console.warn(`[telemetry:dns] ${stage}: ${detail}`);
}

async function collectDnsServer(): Promise<string | null> {
  let stage = "create-test";

  try {
    logDnsProgress(stage, "iniciando teste DNS");
    const response = await fetch("/api/dns/new", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) {
      logDnsDiagnostic(stage, `API respondeu HTTP ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { testId?: string; hostnames?: unknown };
    const hostnames = Array.isArray(data.hostnames)
      ? data.hostnames.filter((hostname): hostname is string => typeof hostname === "string" && hostname.length > 0)
      : [];

    if (!data.testId || hostnames.length === 0) {
      logDnsDiagnostic(stage, "resposta sem testId ou sem hostnames válidos");
      return null;
    }

    logDnsProgress(stage, `teste criado; ${hostnames.length} sondagens preparadas`);
    stage = "probe-hostnames";
    await Promise.all(hostnames.map(probeDnsHostname));
    logDnsProgress(stage, "sondagens concluídas; consultando resolvedores");

    stage = "poll-results";
    let lastHttpStatus: number | null = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, attempt === 0 ? 1000 : 700));

      const resultResponse = await fetch(
        `/api/dns/result/${encodeURIComponent(data.testId)}`,
        {
          headers: { Accept: "application/json" },
          cache: "no-store",
        },
      );

      if (!resultResponse.ok) {
        lastHttpStatus = resultResponse.status;
        continue;
      }

      const result = (await resultResponse.json()) as DnsLeakResult;
      const resolvers = (result.resolvers ?? [])
        .filter((resolver) => resolver.role?.toLowerCase() === "resolver")
        .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

      const values = resolvers
        .map(formatDnsResolver)
        .filter((value): value is string => Boolean(value));

      if (values.length) {
        const uniqueValues = [...new Set(values)].slice(0, 3);
        logDnsProgress(stage, `${uniqueValues.length} resolvedor(es) identificado(s)`);
        return uniqueValues.join(", ").slice(0, 255);
      }
    }

    if (lastHttpStatus !== null) {
      logDnsDiagnostic(stage, `API de resultado respondeu HTTP ${lastHttpStatus}`);
    } else {
      logDnsDiagnostic(stage, "nenhum resolver foi identificado após as tentativas de consulta");
    }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.name : "erro inesperado";
    logDnsDiagnostic(stage, `falha de rede ou resposta inválida (${detail})`);
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
  const ooklaServerId = nearest.selected.id;
  const ooklaServerName = nearest.selected.name;
  const ooklaServerCity = nearest.selected.city;
  const ooklaServerHost = nearest.selected.host;

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
    ooklaServerId,
    ooklaServerName,
    ooklaServerCity,
    ooklaServerHost,
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
    <main style={{ color: "#fff" }}>
      <h1>Verificação de conexão</h1>
      {status === "coletando" && <p>Coletando dados do dispositivo e da conexão…</p>}
      {status === "enviando" && <p>Enviando os dados ao atendente…</p>}
      {status === "sucesso" && <p>Dados enviados ao atendente.</p>}
      {status === "erro" && <p>{error}</p>}
    </main>
  );
}
