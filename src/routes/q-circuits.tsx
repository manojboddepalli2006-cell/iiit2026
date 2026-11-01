import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Download, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, Panel, StatusPill } from "@/components/app-shell";
import { CircuitDiagram } from "@/components/quantum/circuit-diagram";
import { MeasurementPanel, QuantumSetupForm } from "@/components/quantum/quantum-panels";
import { downloadText, useLatestQuantum, useQuantumSetup } from "@/components/quantum/use-quantum";
import { metrics, toQasm3, type Stage } from "@/lib/quantum/circuit";
import { buildOracle, exactVaR, maxLoss, validateProblem } from "@/lib/quantum/credit";
import { buildQae } from "@/lib/quantum/qae";
import type { QuantumRunResult } from "@/lib/quantum/workspace";

export const Route = createFileRoute("/q-circuits")({
  head: () => ({
    meta: [
      { title: "Q-Circuits — Q-CreditX" },
      { name: "description", content: "Generated quantum circuits for credit risk: uncertainty loading U, weighted sum S, comparator C and QAE." },
      { property: "og:title", content: "Q-Circuits — Q-CreditX" },
      { property: "og:description", content: "Live circuit diagrams, gate counts and QASM export for A = C·S·U and QAE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QCircuits,
});

const STAGES: { k: Stage | "QAE"; name: string; desc: string }[] = [
  { k: "U", name: "Uncertainty loading", desc: "Loads discretised Z on nZ qubits, then RY(2·asin√p_k(z_i)) on each default qubit controlled on Z = z_i." },
  { k: "S", name: "Weighted sum", desc: "Adds integer λ_k into the sum register controlled on x_k (reversible ripple increments)." },
  { k: "C", name: "Comparator", desc: "Flips the objective qubit iff L ≤ x, so P(objective = 1) = CDF(x)." },
  { k: "QAE", name: "Amplitude estimation", desc: "H on m evaluation qubits, controlled Q^(2^j) with Q = A·S0·A†·Sχ, then inverse QFT." },
];

function QCircuits() {
  const [setup, setSetup] = useQuantumSetup();
  const latest = useLatestQuantum() as QuantumRunResult | undefined;
  const errors = validateProblem(setup.problem);
  const [x, setX] = useState<number | null>(null);
  const threshold = Math.min(maxLoss(setup.problem), x ?? exactVaR(setup.problem, setup.alpha));
  const svgRef = useRef<SVGSVGElement>(null);

  const data = useMemo(() => {
    if (errors.length) return null;
    const oracle = buildOracle(setup.problem, threshold).circuit;
    const qae = buildQae(setup.problem, threshold, setup.m);
    return { oracle, om: metrics(oracle), qae, qm: metrics(qae.circuit) };
  }, [setup, threshold, errors.length]);

  const downloadSvg = () => {
    if (!svgRef.current) return;
    const css = getComputedStyle(document.documentElement);
    let s = new XMLSerializer().serializeToString(svgRef.current);
    s = s.replace(/var\(--([\w-]+)(?:,\s*([^)]+))?\)/g, (_, v, fb) => css.getPropertyValue(`--${v}`).trim() || fb || "#888");
    downloadText(s, `oracle-A-x${threshold}.svg`, "image/svg+xml");
  };

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="Q-Circuits" subtitle="Circuits generated from the current quantum configuration (Egger et al., 2019)"
        actions={<StatusPill tone="ok">Generated · statevector simulator</StatusPill>} />

      <Panel><QuantumSetupForm setup={setup} onChange={(s) => { setSetup(s); setX(null); }} /></Panel>

      <div className="grid gap-4 md:grid-cols-4">
        {STAGES.map((s) => (
          <Panel key={s.k}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">{s.k} — {s.name}</h3>
              <StatusPill tone="ok">{s.k === "QAE" ? `${data?.qm.byStage["H"] ? "built" : "—"}` : `${data?.om.byStage[s.k as Stage] ?? 0} gates`}</StatusPill></div>
            <p className="mt-2 text-xs text-muted-foreground">{s.desc}</p>
          </Panel>
        ))}
      </div>

      {data && (
        <Panel className="min-w-0 overflow-hidden">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Oracle A = C·S·U</h2>
              <p className="text-xs text-muted-foreground">{data.om.qubits} qubits · depth {data.om.depth} · {data.om.gates} gates ({data.om.cx} CX, {data.om.ccx} CCX, {data.om.mcx} MCX, {data.om.controlledRotations} c-RY). Hover a box for its angle.</p>
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Comparator threshold x</Label>
                <Input type="number" className="w-24" min={0} max={maxLoss(setup.problem)} value={threshold} onChange={(e) => setX(Math.max(0, Math.floor(Number(e.target.value))))} /></div>
              <Button variant="outline" className="rounded-xl" onClick={downloadSvg}><Download /> Diagram (SVG)</Button>
              <Button variant="outline" className="rounded-xl" onClick={() => downloadText(toQasm3(data.qae.circuit, data.qae.evalReg), `q-creditx-qae-x${threshold}-m${setup.m}.qasm`)}><FileCode /> QASM</Button>
            </div>
          </div>
          <div className="overflow-auto rounded-xl border bg-card">
            <CircuitDiagram ref={svgRef} n={data.oracle.n} gates={data.oracle.gates} regs={data.oracle.regs} />
          </div>
        </Panel>
      )}

      {data && (
        <Panel className="min-w-0 overflow-hidden">
          <h2 className="text-lg font-semibold">Full QAE circuit</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            {data.qm.qubits} qubits (registers: {data.qae.circuit.regs.map((r) => `${r.label} ${r.size}`).join(" · ")}) · depth {data.qm.depth.toLocaleString()} · {data.qm.gates.toLocaleString()} gates ·
            {" "}{(1 << setup.m) - 1} controlled Grover applications. Showing the first 1,500 gates; download QASM for the complete circuit.
          </p>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            {Object.entries(data.qm.byStage).map(([k, v]) => <span key={k} className="rounded-full bg-accent px-2.5 py-0.5">{k}: {v.toLocaleString()} gates</span>)}
          </div>
          <div className="max-h-[520px] overflow-auto rounded-xl border bg-card">
            <CircuitDiagram n={data.qae.circuit.n} gates={data.qae.circuit.gates} regs={data.qae.circuit.regs} />
          </div>
        </Panel>
      )}

      {latest ? <MeasurementPanel r={latest} /> : <Panel><p className="text-sm text-muted-foreground">Measurement results unavailable — run the simulator in the Quantum Workspace (CudaQ).</p></Panel>}
    </div>
  );
}
