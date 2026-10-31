"use client";

import { useEffect, useRef, useState } from "react";
import { collectBatteryLevel, collectDeviceInfo } from "@/lib/telemetry/device";

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
  groups?: Array<{
    label?: string;
    members?: string[];
  }>;
  resolvers?: Array<{
    role?: string;
    operator?: string;
    hostname?: string;
    count?: number;
    transport?: string;
    ip?: string;
    address?: string;
  }>;
};

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

function formatDnsResolver(
  resolver: NonNullable<DnsLeakResult["resolvers"]>[number],
  groups: NonNullable<DnsLeakResult["groups"]>,
) {
  const operator = resolver.operator?.trim();
  const hostname = resolver.hostname?.trim();
  const group = operator
    ? groups.find((item) => item.label?.trim().toLowerCase() === operator.toLowerCase())
    : undefined;
  const addresses = [
    ...(group?.members ?? []),
    resolver.ip,
    resolver.address,
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
  const uniqueAddresses = [...new Set(addresses)].slice(0, 3);

  if (operator && uniqueAddresses.length) {
    return `${operator} (${uniqueAddresses.join(", ")})`;
  }
  return operator || hostname || uniqueAddresses[0] || null;
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
        .map((resolver) => formatDnsResolver(resolver, result.groups ?? []))
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
    <main
      style={{
        boxSizing: "border-box",
        width: "100%",
        maxWidth: 1040,
        margin: "0 auto",
        padding: "24px 16px 40px",
        color: "#fff",
      }}
    >
      <h1>Verificação de conexão</h1>
      {status === "coletando" && <p>Coletando dados do dispositivo e da conexão…</p>}
      {status === "enviando" && <p>Enviando os dados técnicos ao atendente…</p>}
      {status === "sucesso" && <p>Dados técnicos enviados ao atendente.</p>}
      {status === "erro" && <p role="alert">{error}</p>}

      <section aria-labelledby="speedtest-title" style={{ marginTop: 28 }}>
        <h2 id="speedtest-title">Teste de velocidade da SuperNet</h2>
        <p>
          Execute o teste abaixo. Ao terminar, informe ao atendente os resultados
          apresentados: velocidade de download, velocidade de upload, ping e jitter.
        </p>
        <div
          style={{
            width: "100%",
            overflow: "hidden",
            borderRadius: 12,
            background: "#fff",
          }}
        >
          <iframe
            title="Teste de velocidade SuperNet"
            src="https://supernetsm.speedtestcustom.com"
            width="100%"
            height="650"
            frameBorder="0"
            loading="eager"
            style={{ display: "block", width: "100%", border: 0 }}
          />
        </div>
        <p style={{ fontSize: 14, color: "#cbd5e1", marginTop: 12 }}>
          Se o teste não carregar,{" "}
          <a
            href="https://supernetsm.speedtestcustom.com"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#93c5fd" }}
          >
            abra o Speedtest da SuperNet em outra aba
          </a>
          .
        </p>
      </section>
    </main>
  );
}
