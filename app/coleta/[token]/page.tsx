"use client";

import { useEffect, useRef, useState } from "react";

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

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function measureLatency(url: string) {
  const samples: number[] = [];
  for (let i = 0; i < 5; i += 1) {
    const start = performance.now();
    await fetch(url, { cache: "no-store", method: "HEAD" });
    samples.push(performance.now() - start);
  }
  return median(samples);
}

async function collectMetrics() {
  const nav = navigator as NavigatorWithConnection;
  const connection = nav.connection;
  const latencyUrl = "/api/telemetry/ping";
  const downloadUrl = "/api/telemetry/download";

  const pingMedian = await measureLatency(latencyUrl);

  const start = performance.now();
  const response = await fetch(downloadUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("Falha no teste de download.");
  const bytes = (await response.arrayBuffer()).byteLength;
  const elapsedSeconds = (performance.now() - start) / 1000;
  const downloadSpeed = elapsedSeconds > 0 ? (bytes * 8) / elapsedSeconds / 1_000_000 : null;

  return {
    userAgent: navigator.userAgent,
    os: navigator.platform || null,
    deviceModel: null,
    ramGb: nav.deviceMemory ?? null,
    cpuCores: navigator.hardwareConcurrency ?? null,
    screenRes: `${screen.width}x${screen.height}`,
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
