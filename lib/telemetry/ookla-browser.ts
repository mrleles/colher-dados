export type OoklaCandidate = { id: number; name: string; city: string; host: string };
export type OoklaLatencyResult = OoklaCandidate & { latencyMs: number | null; jitterMs: number | null; error?: string };
export type OoklaDownloadResult = { server: OoklaCandidate; latencyMs: number; jitterMs: number; downloadMbps: number | null };

export const OOKLA_CANDIDATES: OoklaCandidate[] = [
  { id: 9407, name: "SuperNet-ES", city: "São Mateus, ES", host: "test1.supernetes.com.br:8080" },
  { id: 21551, name: "VIVO GVS", city: "Governador Valadares, MG", host: "gvs.testepower.com.br:8080" },
  { id: 9417, name: "SuperNet-ES", city: "Guarapari, ES", host: "test4.supernetes.com.br:8080" },
];

const PING_SAMPLES = 5;
const PING_TIMEOUT_MS = 4000;
const DOWNLOAD_SIZE_BYTES = 10 * 1024 * 1024;

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function standardDeviation(values: number[], average: number) {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function pingOoklaServer(server: OoklaCandidate): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket("wss://" + server.host + "/ws");
    const samples: number[] = [];
    let sampleStartedAt = 0;
    let settled = false;
    let timeoutId: number | undefined;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      socket.close();
      if (error) reject(error); else resolve(samples);
    };

    timeoutId = window.setTimeout(() => finish(new Error("Tempo limite ao conectar ao servidor.")), PING_TIMEOUT_MS);
    socket.onerror = () => finish(new Error("Falha na conexão WebSocket."));

    socket.onopen = () => {
      const sessionId = crypto.randomUUID();

      const sendPing = () => {
        if (settled) return;
        sampleStartedAt = performance.now();
        socket.send("PING");
      };

      socket.onmessage = (event) => {
        const message = typeof event.data === "string" ? event.data : "";
        if (!message.includes("PONG")) return;
        samples.push(performance.now() - sampleStartedAt);
        if (samples.length >= PING_SAMPLES) { finish(); return; }
        window.setTimeout(sendPing, 80);
      };

      socket.send("HI " + sessionId);
      socket.send("GETIP");
      socket.send("CAPABILITIES");
      sendPing();
    };
  });
}

export async function measureOoklaLatency(server: OoklaCandidate): Promise<OoklaLatencyResult> {
  try {
    const samples = await pingOoklaServer(server);
    const latencyMs = median(samples);
    if (latencyMs === null) throw new Error("Nenhuma resposta de latência.");
    return { ...server, latencyMs, jitterMs: standardDeviation(samples, latencyMs) };
  } catch (error) {
    return { ...server, latencyMs: null, jitterMs: null, error: error instanceof Error ? error.message : "Falha desconhecida." };
  }
}

export async function findNearestOoklaServer(candidates: OoklaCandidate[] = OOKLA_CANDIDATES) {
  const results = await Promise.all(candidates.map(measureOoklaLatency));
  const available = results.filter((r) => r.latencyMs !== null).sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity));
  if (!available.length) throw new Error("Não foi possível medir nenhum dos três servidores.");
  return { selected: available[0], results };
}

export async function measureOoklaDownload(server: OoklaLatencyResult): Promise<OoklaDownloadResult> {
  if (server.latencyMs === null || server.jitterMs === null) throw new Error("Servidor sem latência válida.");
  const url = "https://" + server.host + "/download?nocache=" + Date.now() + "&size=" + DOWNLOAD_SIZE_BYTES + "&guid=" + crypto.randomUUID();
  const startedAt = performance.now();
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok || !response.body) throw new Error("Falha no download (" + response.status + ").");
  const reader = response.body.getReader();
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
  }
  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  const downloadMbps = elapsedSeconds > 0 ? (bytes * 8) / elapsedSeconds / 1000000 : null;
  return { server, latencyMs: server.latencyMs, jitterMs: server.jitterMs, downloadMbps };
}