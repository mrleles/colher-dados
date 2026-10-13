export type OoklaCandidate = { id: number; name: string; city: string; host: string };
export type OoklaLatencyResult = OoklaCandidate & {
  latencyMs: number | null;
  jitterMs: number | null;
  error?: string;
};
export type OoklaDownloadResult = {
  server: OoklaCandidate;
  latencyMs: number;
  jitterMs: number;
  downloadMbps: number | null;
};

export const OOKLA_CANDIDATES: OoklaCandidate[] = [
  { id: 9407, name: "SuperNet-ES", city: "São Mateus, ES", host: "test1.supernetes.com.br:8080" },
  { id: 21551, name: "VIVO GVS", city: "Governador Valadares, MG", host: "gvs.testepower.com.br:8080" },
  { id: 9417, name: "SuperNet-ES", city: "Guarapari, ES", host: "test4.supernetes.com.br:8080" },
];

const PING_SAMPLES = 5;
const PING_TIMEOUT_MS = 5000;
const DOWNLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 15000;

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

function websocketUrl(server: OoklaCandidate) {
  return "wss://" + server.host + "/ws";
}

function socketFailure(server: OoklaCandidate, event: CloseEvent | Event) {
  if (event instanceof CloseEvent && event.code !== 1000) {
    return "WebSocket encerrado (código " + event.code + (event.reason ? ": " + event.reason : "") + ").";
  }

  return "Não foi possível abrir o WebSocket Ookla. O servidor pode não aceitar WSS na porta 8080 ou a conexão pode estar sendo bloqueada pela rede.";
}

function pingOoklaServer(server: OoklaCandidate): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const samples: number[] = [];
    let settled = false;
    let timeoutId: number | undefined;
    let sampleTimeoutId: number | undefined;
    let socket: WebSocket | null = null;
    let waitingForPong = false;
    let pingStartedAt = 0;

    const cleanup = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (sampleTimeoutId !== undefined) window.clearTimeout(sampleTimeoutId);
      if (socket && socket.readyState === WebSocket.OPEN) socket.close(1000, "teste concluído");
      socket = null;
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(samples);
    };

    const startPing = () => {
      if (!socket || socket.readyState !== WebSocket.OPEN || settled) return;

      if (samples.length >= PING_SAMPLES) {
        finish();
        return;
      }

      waitingForPong = true;
      pingStartedAt = performance.now();
      socket.send("PING " + Math.round(Date.now()));

      sampleTimeoutId = window.setTimeout(() => {
        finish(new Error("Tempo limite aguardando PONG do servidor."));
      }, PING_TIMEOUT_MS);
    };

    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;

      const message = event.data.trim();
      if (!waitingForPong || !message.startsWith("PONG")) return;

      waitingForPong = false;
      if (sampleTimeoutId !== undefined) window.clearTimeout(sampleTimeoutId);
      sampleTimeoutId = undefined;
      samples.push(performance.now() - pingStartedAt);

      if (samples.length >= PING_SAMPLES) {
        finish();
      } else {
        window.setTimeout(startPing, 20);
      }
    };

    try {
      socket = new WebSocket(websocketUrl(server));
      socket.onmessage = handleMessage;
      socket.onerror = (event) => {
        finish(new Error(socketFailure(server, event)));
      };
      socket.onclose = (event) => {
        if (!settled) finish(new Error(socketFailure(server, event)));
      };
      socket.onopen = () => {
        socket?.send("HI " + crypto.randomUUID());
        socket?.send("GETIP");
        socket?.send("CAPABILITIES");
        startPing();
      };

      timeoutId = window.setTimeout(() => {
        finish(new Error("Tempo limite ao conectar ao servidor Ookla via WebSocket."));
      }, PING_TIMEOUT_MS * (PING_SAMPLES + 1));
    } catch (error) {
      finish(error instanceof Error ? error : new Error("Falha ao criar WebSocket."));
    }
  });
}

export async function measureOoklaLatency(server: OoklaCandidate): Promise<OoklaLatencyResult> {
  try {
    const samples = await pingOoklaServer(server);
    const latencyMs = median(samples);
    if (latencyMs === null) throw new Error("Nenhuma resposta de latência.");
    return { ...server, latencyMs, jitterMs: standardDeviation(samples, latencyMs) };
  } catch (error) {
    return {
      ...server,
      latencyMs: null,
      jitterMs: null,
      error: error instanceof Error ? error.message : "Falha desconhecida.",
    };
  }
}

export async function findNearestOoklaServer(candidates: OoklaCandidate[] = OOKLA_CANDIDATES) {
  const results = await Promise.all(candidates.map(measureOoklaLatency));
  const available = results
    .filter((result) => result.latencyMs !== null)
    .sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity));

  if (!available.length) {
    throw new Error("Não foi possível medir nenhum dos três servidores.");
  }

  return { selected: available[0], results };
}

function messageByteLength(data: string) {
  return new TextEncoder().encode(data).byteLength;
}

function downloadOoklaServer(server: OoklaLatencyResult): Promise<number> {
  return new Promise((resolve, reject) => {
    if (server.latencyMs === null || server.jitterMs === null) {
      reject(new Error("Servidor sem latência válida."));
      return;
    }

    const socket = new WebSocket(websocketUrl(server));
    socket.binaryType = "arraybuffer";

    let bytes = 0;
    let settled = false;
    const startedAt = performance.now();
    const timeoutId = window.setTimeout(() => {
      finish(new Error("Tempo limite no download via WebSocket Ookla."));
    }, DOWNLOAD_TIMEOUT_MS);

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);

      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(1000, "download concluído");
      }

      if (error) {
        reject(error);
        return;
      }

      const elapsedSeconds = (performance.now() - startedAt) / 1000;
      resolve(elapsedSeconds > 0 ? (bytes * 8) / elapsedSeconds / 1000000 : 0);
    };

    socket.onerror = () => {
      finish(new Error("Não foi possível abrir o WebSocket para download."));
    };

    socket.onclose = (event) => {
      if (!settled) {
        finish(
          new Error(
            event.code === 1000
              ? "O servidor encerrou o download antes de enviar os dados esperados."
              : "WebSocket de download encerrado (código " + event.code + ").",
          ),
        );
      }
    };

    socket.onmessage = (event) => {
      if (typeof event.data === "string") {
        // Responses to HI/GETIP/CAPABILITIES are textual; only count the data stream.
        return;
      }

      if (event.data instanceof ArrayBuffer) {
        bytes += event.data.byteLength;
      } else if (event.data instanceof Blob) {
        bytes += event.data.size;
      } else {
        bytes += messageByteLength(String(event.data));
      }

      if (bytes >= DOWNLOAD_SIZE_BYTES) finish();
    };

    socket.onopen = () => {
      socket.send("HI " + crypto.randomUUID());
      socket.send("GETIP");
      socket.send("CAPABILITIES");
      socket.send("DOWNLOAD " + DOWNLOAD_SIZE_BYTES);
    };
  });
}

export async function measureOoklaDownload(server: OoklaLatencyResult): Promise<OoklaDownloadResult> {
  if (server.latencyMs === null || server.jitterMs === null) {
    throw new Error("Servidor sem latência válida.");
  }

  const downloadMbps = await downloadOoklaServer(server);
  return {
    server,
    latencyMs: server.latencyMs,
    jitterMs: server.jitterMs,
    downloadMbps,
  };
}
