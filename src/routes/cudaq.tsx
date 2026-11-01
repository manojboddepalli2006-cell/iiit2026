import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cpu, Download, Eye, Hammer, Loader2, Play, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader, Panel, StatusPill } from "@/components/app-shell";
import { LimitationsPanel, MeasurementPanel, QuantumKpis, QuantumResults, QuantumSetupForm, qubitEstimate } from "@/components/quantum/quantum-panels";
import { QUANTUM_RESULT_KEY, downloadText, useLatestQuantum, useQuantumRunner, useQuantumSetup } from "@/components/quantum/use-quantum";
import { metrics, toQasm3, type CircuitMetrics } from "@/lib/quantum/circuit";
import { exactVaR, validateProblem } from "@/lib/quantum/credit";
import { buildQae } from "@/lib/quantum/qae";
import { MAX_QUBITS } from "@/lib/quantum/statevector";
import type { QuantumRunResult } from "@/lib/quantum/workspace";
import { deleteQuantumRun, quantumRunsQuery } from "@/services/quantum";

export const Route = createFileRoute("/cudaq")({
  head: () => ({
    meta: [
      { title: "Quantum Workspace — Q-CreditX" },
      { name: "description", content: "Build, compile and run quantum amplitude estimation circuits for credit VaR on a statevector simulator." },
      { property: "og:title", content: "Quantum Workspace — Q-CreditX" },
      { property: "og:description", content: "QAE-based credit VaR and economic capital on a quantum circuit simulator." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Workspace,
});

type Built = { metrics: CircuitMetrics; threshold: number; compiled: boolean; qasm: string };

const backends = [
  { name: "Q-CreditX statevector simulator", detail: `In-browser, exact amplitudes, ≤ ${MAX_QUBITS} qubits, runs in a background worker`, status: "QUANTUM SIMULATOR — ACTIVE", tone: "ok" as const },
  { name: "Qiskit Aer", detail: "Python runtime is not available in this web app; export QASM to run there", status: "Not available", tone: "bad" as const },
  { name: "NVIDIA CUDA-Q", detail: "Not installed or connected", status: "Not connected", tone: "bad" as const },
  { name: "IBM Quantum hardware", detail: "No authenticated provider connection", status: "Not connected", tone: "bad" as const },
];

function Workspace() {
  const qc = useQueryClient();
  const [setup, setSetup] = useQuantumSetup();
  const { run, cancel, progress, running } = useQuantumRunner();
  const latest = useLatestQuantum();
  const runs = useQuery(quantumRunsQuery);
  const [built, setBuilt] = useState<Built | null>(null);
  const [showMeasure, setShowMeasure] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);
  const errors = useMemo(() => validateProblem(setup.problem), [setup.problem]);
  const change = (s: typeof setup) => { setSetup(s); setBuilt(null); };

  const build = () => {
    if (errors.length) { toast.error(errors[0]!); return; }
    const x = exactVaR(setup.problem, setup.alpha);
    const { circuit, evalReg } = buildQae(setup.problem, x, setup.m);
    setBuilt({ metrics: metrics(circuit), threshold: x, compiled: false, qasm: toQasm3(circuit, evalReg) });
    toast.success(`Built QAE circuit: ${circuit.n} qubits, ${circuit.gates.length.toLocaleString()} gates`);
  };
  const compile = () => {
    if (!built) { toast.error("Build the circuit first"); return; }
    if (built.metrics.qubits > MAX_QUBITS) { toast.error(`Needs ${built.metrics.qubits} qubits; simulator limit is ${MAX_QUBITS}`); return; }
    setBuilt({ ...built, compiled: true });
    toast.success("Compiled for the statevector simulator (native gate set: X, H, Z, RY, P with controls)");
  };
  const simulate = async () => {
    if (errors.length) { toast.error(errors[0]!); return; }
    const r = await run({ problem: setup.problem, alpha: setup.alpha, cfg: { m: setup.m, shots: setup.shots, seed: setup.seed } });
    if (r) setShowMeasure(true);
  };
  const viewMeasurements = () => {
    if (!latest) { toast.error("Run the simulator first"); return; }
    setShowMeasure(true);
    setTimeout(() => measureRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };
  const exportCircuit = () => {
    const qasm = built?.qasm ?? (() => { const x = exactVaR(setup.problem, setup.alpha); const b = buildQae(setup.problem, x, setup.m); return toQasm3(b.circuit, b.evalReg); })();
    downloadText(qasm, `q-creditx-qae-m${setup.m}.qasm`);
  };
  const remove = async (id: string) => {
    try { await deleteQuantumRun(id); qc.invalidateQueries({ queryKey: ["quantum-runs"] }); qc.setQueryData(QUANTUM_RESULT_KEY, undefined); toast.success("Run deleted"); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Quantum Workspace" subtitle="Canonical QAE for credit VaR (Egger et al., 2019) on a gate-level statevector simulator" actions={<StatusPill tone="ok">QUANTUM SIMULATOR — ACTIVE</StatusPill>} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {backends.map((b) => (
          <Panel key={b.name}>
            <div className="flex items-center gap-2"><Cpu className="size-4 text-primary-deep" /><span className="font-semibold">{b.name}</span></div>
            <p className="mt-2 text-xs text-muted-foreground">{b.detail}</p>
            <div className="mt-3"><StatusPill tone={b.tone}>{b.status}</StatusPill></div>
          </Panel>
        ))}
      </div>

      <Panel>
        <h2 className="mb-4 text-lg font-semibold">QAE configuration</h2>
        <QuantumSetupForm setup={setup} onChange={change} />
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button variant="outline" className="rounded-xl" onClick={build} disabled={running}><Hammer /> Build Circuit</Button>
          <Button variant="outline" className="rounded-xl" onClick={compile} disabled={running}><ShieldCheck /> Compile Circuit</Button>
          <Button className="rounded-xl bg-brand-gradient shadow-lift" onClick={simulate} disabled={running}>{running ? <Loader2 className="animate-spin" /> : <Play />} Run Simulator</Button>
          <Button variant="outline" className="rounded-xl" onClick={viewMeasurements}><Eye /> View Measurements</Button>
          <Button variant="outline" className="rounded-xl" onClick={exportCircuit}><Download /> Export Circuit</Button>
          {running && <Button variant="ghost" onClick={cancel}><X /> Cancel</Button>}
        </div>
        {running && progress && (
          <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground"><Progress value={progress.frac * 100} className="h-2 max-w-md" /> {progress.msg}</div>
        )}
        <div className="mt-4 text-sm">
          {built ? (
            <p>
              <StatusPill tone={built.compiled ? "ok" : "pending"}>{built.compiled ? "Compiled" : "Built"}</StatusPill>{" "}
              QAE circuit at threshold x = {built.threshold}: {built.metrics.qubits} qubits · depth {built.metrics.depth.toLocaleString()} · {built.metrics.gates.toLocaleString()} gates
              ({built.metrics.cx} CX, {built.metrics.ccx} CCX, {built.metrics.mcx} MCX, {built.metrics.controlledRotations} c-RY, {built.metrics.controlledPhases} c-P)
            </p>
          ) : <p className="text-muted-foreground">Circuit not built yet · estimated {qubitEstimate(setup.problem, setup.m)} qubits.</p>}
        </div>
      </Panel>

      <QuantumKpis r={latest} />
      {latest ? <QuantumResults r={latest as QuantumRunResult} /> : <Panel><p className="text-sm text-muted-foreground">No quantum result available yet. Press Run Simulator.</p></Panel>}
      {showMeasure && latest && <div ref={measureRef}><MeasurementPanel r={latest as QuantumRunResult} /></div>}

      <Panel className="overflow-x-auto">
        <h3 className="mb-3 font-semibold">Execution history</h3>
        {!runs.data?.length ? <p className="text-sm text-muted-foreground">No saved runs.</p> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr>{["Created", "Problem", "Model", "α", "m", "Shots", "Qubits", "Depth", "Gates", "VaR", "ECR", "Time", ""].map((h) => <th key={h} className="py-2 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>{runs.data.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-1.5 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td><td>{r.job.problem.label}</td><td>{r.job.problem.model}</td>
                <td>{r.job.alpha * 100}%</td><td>{r.job.cfg.m}</td><td>{r.job.cfg.shots}</td><td>{r.qae.qubits}</td><td>{r.qae.depth}</td><td>{r.qae.gates}</td>
                <td>{r.var}</td><td>{r.ecr.toFixed(2)}</td><td>{(r.totalMs / 1000).toFixed(1)} s</td>
                <td className="text-right">
                  <Button size="icon" variant="ghost" aria-label="View" onClick={() => { qc.setQueryData(QUANTUM_RESULT_KEY, r); toast.info("Loaded run into the results view"); }}><Eye /></Button>
                  <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(r.id)}><Trash2 /></Button>
                </td>
              </tr>))}</tbody>
          </table>
        )}
      </Panel>

      <LimitationsPanel />
    </div>
  );
}
