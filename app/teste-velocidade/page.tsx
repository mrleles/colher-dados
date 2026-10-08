"use client";

import { useState } from "react";
import { findNearestOoklaServer, measureOoklaDownload, measureOoklaLatency, OOKLA_CANDIDATES, type OoklaLatencyResult } from "@/lib/telemetry/ookla-browser";

export default function SpeedTestPage() {
  const [results, setResults] = useState<OoklaLatencyResult[]>([]);
  const [selected, setSelected] = useState<OoklaLatencyResult | null>(null);
  const [download, setDownload] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("Pronto para testar.");

  async function runTest() {
    setRunning(true); setResults([]); setSelected(null); setDownload(null);
    setMessage("Medindo latência dos 3 servidores…");

    const measured = await Promise.all(OOKLA_CANDIDATES.map(measureOoklaLatency));
    setResults(measured);

    const available = measured
      .filter((result) => result.latencyMs !== null)
      .sort((a, b) => (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity));

    if (!available.length) {
      setMessage("Nenhum dos 3 servidores respondeu. Os detalhes estão na tabela abaixo.");
      setRunning(false);
      return;
    }

    const nearest = await findNearestOoklaServer(measured.map(({ id, name, city, host }) => ({ id, name, city, host })));
    setSelected(nearest.selected);
    setMessage("Servidor escolhido: " + nearest.selected.name + " — " + nearest.selected.city + ". Medindo download…");

    try {
      const downloadResult = await measureOoklaDownload(nearest.selected);
      setDownload(downloadResult.downloadMbps);
      setMessage("Teste concluído.");
    } catch (error) {
      setMessage("Latência medida, mas o download falhou: " + (error instanceof Error ? error.message : "falha desconhecida."));
    } finally {
      setRunning(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: 24 }}>
      <h1>Teste de servidor mais próximo</h1>
      <p>O navegador testa somente São Mateus, Governador Valadares e Guarapari. Em Guarapari usamos especificamente o servidor SuperNet-ES.</p>
      <button type="button" onClick={runTest} disabled={running}>{running ? "Testando…" : "Iniciar teste"}</button>
      <p>{message}</p>
      {results.length > 0 && (
        <table style={{ width: "100%", marginTop: 24, borderCollapse: "collapse" }}>
          <thead><tr><th align="left">Servidor</th><th align="left">Cidade</th><th align="left">Latência</th><th align="left">Jitter</th><th align="left">Status</th></tr></thead>
          <tbody>{results.map((result) => (
            <tr key={result.id}>
              <td>{result.name}</td><td>{result.city}</td>
              <td>{result.latencyMs === null ? "—" : result.latencyMs.toFixed(1) + " ms"}</td>
              <td>{result.jitterMs === null ? "—" : result.jitterMs.toFixed(1) + " ms"}</td>
              <td>{selected?.id === result.id ? "ESCOLHIDO" : result.error ?? "OK"}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {selected && <p><strong>Download pelo servidor escolhido:</strong> {selected.name} — {selected.city}{download !== null ? " — " + download.toFixed(2) + " Mbps" : ""}</p>}
    </main>
  );
}
