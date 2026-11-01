import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { QuantumJob, QuantumRunResult } from "@/lib/quantum/workspace";
import { PAPER_EXAMPLE, type QProblem } from "@/lib/quantum/credit";
import { quantumRunsQuery, saveQuantumRun, type StoredQuantumRun } from "@/services/quantum";

export const QUANTUM_RESULT_KEY = ["quantum-result"] as const;
export const QUANTUM_SETUP_KEY = ["quantum-setup"] as const;

export interface QuantumSetup { problem: QProblem; alpha: number; m: number; shots: number; seed: number }
export const DEFAULT_SETUP: QuantumSetup = { problem: PAPER_EXAMPLE, alpha: 0.95, m: 4, shots: 1000, seed: 7 };

/** Shared quantum setup across Workspace and Q-Circuits pages (in-memory cache). */
export function useQuantumSetup() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: QUANTUM_SETUP_KEY, queryFn: () => DEFAULT_SETUP, initialData: DEFAULT_SETUP, staleTime: Infinity });
  const set = useCallback((s: QuantumSetup) => qc.setQueryData(QUANTUM_SETUP_KEY, s), [qc]);
  return [data, set] as const;
}

/** Latest quantum result: this session's run, else the newest saved run. */
export function useLatestQuantum(): StoredQuantumRun | QuantumRunResult | undefined {
  const session = useQuery<QuantumRunResult | undefined>({ queryKey: QUANTUM_RESULT_KEY, queryFn: () => undefined, enabled: false });
  const runs = useQuery(quantumRunsQuery);
  return session.data ?? runs.data?.[0];
}

/** Runs a quantum job in a Web Worker (non-blocking), saves it and publishes it to the cache. */
export function useQuantumRunner() {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<{ frac: number; msg: string } | null>(null);
  const worker = useRef<Worker | null>(null);
  useEffect(() => () => worker.current?.terminate(), []);

  const cancel = () => { worker.current?.terminate(); worker.current = null; setProgress(null); toast.info("Simulation cancelled"); };

  const run = (job: QuantumJob) => new Promise<QuantumRunResult | null>((resolve) => {
    worker.current?.terminate();
    const w = new Worker(new URL("../../lib/quantum/worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    setProgress({ frac: 0, msg: "Starting simulator" });
    const timeout = setTimeout(() => { w.terminate(); setProgress(null); toast.error("Simulation exceeded 5 minutes and was stopped — reduce assets, loss units or evaluation qubits"); resolve(null); }, 300_000);
    w.onmessage = async (e) => {
      const d = e.data;
      if (d.type === "progress") setProgress({ frac: d.frac, msg: d.msg });
      else {
        clearTimeout(timeout); w.terminate(); worker.current = null; setProgress(null);
        if (d.type === "error") { toast.error(`Quantum simulation failed: ${d.message}`); resolve(null); return; }
        const r = d.result as QuantumRunResult;
        qc.setQueryData(QUANTUM_RESULT_KEY, r);
        try { await saveQuantumRun(r); qc.invalidateQueries({ queryKey: ["quantum-runs"] }); }
        catch (err) { toast.error(`Result not saved: ${(err as Error).message}`); }
        toast.success(`QAE complete · ${r.qaeEvaluations} amplitude estimations on the statevector simulator`);
        resolve(r);
      }
    };
    w.onerror = (e) => { clearTimeout(timeout); setProgress(null); toast.error(`Simulator error: ${e.message}`); resolve(null); };
    w.postMessage(job);
  });

  return { run, cancel, progress, running: progress !== null };
}

export function downloadText(text: string, name: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
