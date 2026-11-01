import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ComposedChart, ErrorBar, Legend, Line, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel, StatusPill } from "@/components/app-shell";
import { PAPER_EXAMPLE, maxLoss, problemFromPortfolio, sumBits, validateProblem, type QProblem } from "@/lib/quantum/credit";
import type { QuantumRunResult } from "@/lib/quantum/workspace";
import { assetsQuery, portfoliosQuery } from "@/services/portfolio";
import { compactMoney, money } from "@/lib/format";
import type { QuantumSetup } from "./use-quantum";

const axis = { fontSize: 11, stroke: "var(--color-muted-foreground)" };
export const qubitEstimate = (p: QProblem, m: number) => (p.model === "gaussian" ? p.nZ : 0) + p.assets.length + sumBits(p) + 1 + m;

export function QuantumSetupForm({ setup, onChange }: { setup: QuantumSetup; onChange: (s: QuantumSetup) => void }) {
  const portfolios = useQuery(portfoliosQuery);
  const pid = portfolios.data?.[0]?.id;
  const assets = useQuery(assetsQuery(pid));
  const p = setup.problem;
  const fromPaper = p.label === PAPER_EXAMPLE.label;
  const k = p.assets.length, units = maxLoss(p);
  const rebuild = (o: { source?: string; k?: number; units?: number; model?: QProblem["model"]; nZ?: number }) => {
    const source = o.source ?? (fromPaper ? "paper" : "portfolio");
    const model = o.model ?? p.model, nZ = o.nZ ?? p.nZ;
    let prob: QProblem;
    if (source === "paper") prob = { ...PAPER_EXAMPLE, model, nZ };
    else {
      if (!assets.data?.length) return;
      const targetUnits = o.units ?? (fromPaper ? 7 : [3, 7, 15].reduce((b, u) => (Math.abs(u - units) < Math.abs(b - units) ? u : b), 7));
      prob = problemFromPortfolio(assets.data, o.k ?? (fromPaper ? 3 : k), targetUnits, model, nZ);
    }
    onChange({ ...setup, problem: prob });
  };
  const qubits = qubitEstimate(p, setup.m);
  const errors = validateProblem(p);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <F label="Problem">
          <Select value={fromPaper ? "paper" : "portfolio"} onValueChange={(v) => rebuild({ source: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="paper">Paper Table I (2 assets)</SelectItem>
              <SelectItem value="portfolio" disabled={!assets.data?.length}>Demo portfolio (top assets)</SelectItem>
            </SelectContent>
          </Select>
        </F>
        <F label="Default model">
          <Select value={p.model} onValueChange={(v) => rebuild({ model: v as QProblem["model"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="independent">Independent</SelectItem><SelectItem value="gaussian">Gaussian conditional independence</SelectItem></SelectContent>
          </Select>
        </F>
        {!fromPaper && (
          <>
            <F label="Assets on circuit">
              <Select value={String(k)} onValueChange={(v) => rebuild({ k: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[2, 3, 4].map((x) => <SelectItem key={x} value={String(x)}>{x}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Max loss units (precision)">
              <Select value={String([3, 7, 15].reduce((b, u) => (Math.abs(u - units) < Math.abs(b - units) ? u : b), 7))} onValueChange={(v) => rebuild({ units: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[3, 7, 15].map((x) => <SelectItem key={x} value={String(x)}>{x} ({Math.log2(x + 1)} sum qubits)</SelectItem>)}</SelectContent>
              </Select>
            </F>
          </>
        )}
        {p.model === "gaussian" && (
          <F label="Z qubits (nZ)">
            <Select value={String(p.nZ)} onValueChange={(v) => rebuild({ nZ: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[1, 2, 3].map((x) => <SelectItem key={x} value={String(x)}>{x} ({1 << x} grid points)</SelectItem>)}</SelectContent>
            </Select>
          </F>
        )}
        <F label="Confidence level α">
          <Select value={String(setup.alpha)} onValueChange={(v) => onChange({ ...setup, alpha: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[0.9, 0.95, 0.99].map((x) => <SelectItem key={x} value={String(x)}>{x * 100}%</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="Evaluation qubits (m)">
          <Select value={String(setup.m)} onValueChange={(v) => onChange({ ...setup, m: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[2, 3, 4, 5, 6].map((x) => <SelectItem key={x} value={String(x)}>{x} (M = {1 << x})</SelectItem>)}</SelectContent>
          </Select>
        </F>
        <F label="Shots">
          <Input type="number" min={0} max={100000} value={setup.shots} onChange={(e) => onChange({ ...setup, shots: Math.max(0, Math.floor(Number(e.target.value))) })} />
        </F>
        <F label="Seed">
          <Input type="number" min={0} value={setup.seed} onChange={(e) => onChange({ ...setup, seed: Math.max(0, Math.floor(Number(e.target.value))) })} />
        </F>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-xs">
          <thead className="bg-accent/50 text-muted-foreground"><tr>
            {["Asset", "λ (money)", "Loss units", "Scaled back", "Rounding error", "PD", "ρ"].map((h) => <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>)}
          </tr></thead>
          <tbody>{p.assets.map((a) => (
            <tr key={a.name} className="border-t">
              <td className="px-3 py-1.5">{a.name}</td><td className="px-3">{fromPaper ? a.lambdaRaw : money(a.lambdaRaw)}</td><td className="px-3 font-semibold">{a.lambda}</td>
              <td className="px-3">{fromPaper ? a.lambda : money(a.lambda * p.unit)}</td>
              <td className="px-3">{a.lambdaRaw ? `${(((a.lambda * p.unit - a.lambdaRaw) / a.lambdaRaw) * 100).toFixed(1)}%` : "—"}</td>
              <td className="px-3">{a.pd}</td><td className="px-3">{p.model === "gaussian" ? a.rho : "—"}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Loss scale: 1 unit = {fromPaper ? "1 (paper units)" : money(p.unit)} · max loss {units} units · {qubits} qubits total
        (2^{qubits} = {(2 ** qubits).toLocaleString()} amplitudes){qubits >= 15 ? " — large: simulation may take tens of seconds" : ""}.
        {errors.length > 0 && <span className="text-destructive"> {errors.join("; ")}</span>}
      </p>
    </div>
  );
}

const unitMoney = (r: QuantumRunResult, v: number) => (r.job.problem.label === PAPER_EXAMPLE.label ? `${v.toFixed(2)} units` : `${v.toFixed(2)} u · ${compactMoney(v * r.job.problem.unit)}`);

export function QuantumKpis({ r }: { r: QuantumRunResult | undefined }) {
  const items = [
    { l: "Quantum VaR", v: r ? `${r.var} units` : "Unavailable", n: r ? `${(r.job.alpha * 100).toFixed(0)}% · QAE bisection${r.job.problem.unit !== 1 ? ` · ${compactMoney(r.var * r.job.problem.unit)}` : ""}` : "Run the quantum simulator" },
    { l: "Quantum ECR", v: r ? unitMoney(r, r.ecr) : "Unavailable", n: r ? "VaR(QAE) − EL(classical)" : "—" },
    { l: "Estimated CDF at VaR", v: r ? `${(r.cdfAtVar * 100).toFixed(2)}%` : "Unavailable", n: r ? `CI [${(r.ciAtVar[0] * 100).toFixed(1)}%, ${(r.ciAtVar[1] * 100).toFixed(1)}%]` : "—" },
    { l: "QAE error estimate", v: r ? `± ${(r.qaeAtVar.epsilon * 100).toFixed(2)}%` : "Unavailable", n: r ? `m = ${r.job.cfg.m}, P(success) ≥ 81%` : "—" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((k) => (
        <Panel key={k.l}>
          <div className="text-sm text-muted-foreground">{k.l}</div>
          <div className="mt-2 font-display text-2xl font-bold">{k.v}</div>
          <div className="mt-1 text-xs text-muted-foreground">{k.n}</div>
        </Panel>
      ))}
    </div>
  );
}

export function QuantumResults({ r }: { r: QuantumRunResult }) {
  const cdf = r.cdf.map((c) => ({ ...c, err: [c.estimate - c.lo, c.hi - c.estimate] as [number, number] }));
  const cmp = [
    { name: "VaR", classical: r.exactVar, quantum: r.var },
    { name: "ECR", classical: r.exactEcr, quantum: r.ecr },
  ];
  const res = [
    ["Logical qubits (QAE circuit)", r.qae.qubits], ["Evaluation qubits", r.job.cfg.m],
    ["Oracle qubits (Z + X + S + objective)", r.oracle.qubits], ["Ancilla qubits", 0],
    ["Circuit depth (logical)", r.qae.depth], ["Gate count (logical)", r.qae.gates],
    ["CNOT (1-control X)", r.qae.cx], ["Toffoli (2-control X)", r.qae.ccx], ["Multi-controlled X (≥3 controls)", r.qae.mcx],
    ["Controlled RY / phase", `${r.qae.controlledRotations} / ${r.qae.controlledPhases}`],
    ["Oracle A gates · depth", `${r.oracle.gates} · ${r.oracle.depth}`],
    ["Grover operator applications", r.qaeAtVar.groverCalls], ["Oracle calls (A and A†)", r.qaeAtVar.oracleCalls],
    ["QAE evaluations in this run", r.qaeEvaluations], ["Shots per QAE", r.job.cfg.shots || "exact distribution"],
    ["Transpiled resources", "Not available — no hardware transpiler in this engine"],
    ["Simulator runtime (whole job)", `${(r.totalMs / 1000).toFixed(2)} s on a classical CPU`],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Chart title="Quantum loss distribution" note="Loss register measured from U·S|0⟩ vs exact enumeration of the same discretised model">
          <BarChart data={r.lossDistribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="loss" {...axis} label={{ value: "Loss (units)", position: "insideBottom", offset: -2, fontSize: 11 }} />
            <YAxis {...axis} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
            <Tooltip formatter={(v) => `${(Number(v) * 100).toFixed(3)}%`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar name="Quantum (statevector)" dataKey="prob" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
            <Bar name="Exact classical" dataKey="exact" fill="var(--color-primary-deep)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </Chart>
        <Chart title="Quantum estimated CDF" note="Each point is one canonical QAE run on the comparator objective qubit; bars show the QAE error bound">
          <ComposedChart data={cdf}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="x" type="number" domain={[0, "dataMax"]} {...axis} />
            <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} {...axis} />
            <Tooltip formatter={(v, n) => [Array.isArray(v) ? "" : `${(Number(v) * 100).toFixed(2)}%`, n]} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line name="Exact CDF" dataKey="exact" type="stepAfter" stroke="var(--color-primary-deep)" dot={false} />
            <Scatter name="QAE estimate" dataKey="estimate" fill="var(--color-primary)"><ErrorBar dataKey="err" direction="y" stroke="var(--color-primary)" /></Scatter>
            <ReferenceLine y={r.job.alpha} stroke="var(--color-destructive)" strokeDasharray="4 4" label={{ value: `α`, fontSize: 11 }} />
            <ReferenceLine x={r.var} stroke="var(--color-destructive)" strokeDasharray="4 4" label={{ value: `VaR ${r.var}`, fontSize: 11, position: "insideTopLeft" }} />
          </ComposedChart>
        </Chart>
        <Chart title="Classical vs quantum VaR and ECR" note="Classical = exact enumeration of the identical discretised problem (loss units)">
          <BarChart data={cmp}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="name" {...axis} /><YAxis {...axis} />
            <Tooltip formatter={(v) => Number(v).toFixed(3)} /><Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar name="Classical (exact)" dataKey="classical" fill="var(--color-primary-deep)" radius={[4, 4, 0, 0]} />
            <Bar name="Quantum (QAE)" dataKey="quantum" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </Chart>
        <Chart title="QAE convergence" note={`CDF(${r.var}) estimate vs evaluation qubits; error bound shrinks ~1/M`}>
          <ComposedChart data={r.convergence.map((c) => ({ ...c, err: [Math.min(c.epsilon, c.estimate), c.epsilon] }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="m" type="number" domain={["dataMin - 0.5", "dataMax + 0.5"]} allowDecimals={false} {...axis} />
            <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} {...axis} />
            <Tooltip formatter={(v) => (Array.isArray(v) ? "" : `${(Number(v) * 100).toFixed(2)}%`)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line name="Exact" dataKey="exact" stroke="var(--color-primary-deep)" strokeDasharray="4 4" dot={false} />
            <Scatter name="QAE estimate" dataKey="estimate" fill="var(--color-primary)"><ErrorBar dataKey="err" direction="y" stroke="var(--color-primary)" /></Scatter>
          </ComposedChart>
        </Chart>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h3 className="mb-1 font-semibold">VaR bisection (QAE per midpoint)</h3>
          <p className="mb-3 text-xs text-muted-foreground">Uncertain = QAE confidence interval contains α, so the decision is not statistically resolved.</p>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr>{["#", "Interval", "x", "CDF est.", "CI", "Decision"].map((h) => <th key={h} className="py-1 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>{r.bisection.map((s) => (
              <tr key={s.iter} className="border-t">
                <td className="py-1.5">{s.iter}</td><td>[{s.lo}, {s.hi}]</td><td>{s.x}</td><td>{(s.estimate * 100).toFixed(2)}%</td>
                <td className="text-xs">[{(s.ci[0] * 100).toFixed(1)}, {(s.ci[1] * 100).toFixed(1)}]</td>
                <td>{s.decision} {s.uncertain && <StatusPill tone="warn">uncertain</StatusPill>}</td>
              </tr>))}
              {!r.bisection.length && <tr><td colSpan={6} className="py-2 text-muted-foreground">Interval collapsed immediately (max loss 0).</td></tr>}
            </tbody>
          </table>
          <p className="mt-3 text-sm">Result: VaR = <b>{r.var}</b> units (exact {r.exactVar}) · EL = {r.expectedLoss.toFixed(3)} · ECR = <b>{r.ecr.toFixed(3)}</b> (exact {r.exactEcr.toFixed(3)})
            {r.varUncertain && <span className="text-destructive"> · at least one threshold decision was statistically uncertain — increase m.</span>}</p>
        </Panel>
        <Panel>
          <h3 className="mb-3 font-semibold">Quantum execution resources</h3>
          <table className="w-full text-sm"><tbody>{res.map(([k, v]) => (
            <tr key={k} className="border-t first:border-0"><td className="py-1.5 text-muted-foreground">{k}</td><td className="text-right font-medium">{v}</td></tr>))}</tbody></table>
        </Panel>
      </div>
    </div>
  );
}

export function MeasurementPanel({ r }: { r: QuantumRunResult }) {
  const data = r.qaeAtVar.outcomes.map((o) => ({ ...o, label: `${o.y.toString(2).padStart(r.job.cfg.m, "0")}` }));
  return (
    <Panel>
      <h3 className="font-semibold">Measurements — evaluation register, QAE for CDF({r.var})</h3>
      <p className="mb-3 text-xs text-muted-foreground">Outcome y maps to ã = sin²(πy/M). {r.job.cfg.shots ? `${r.job.cfg.shots} sampled shots` : "Exact outcome probabilities"} · estimate ã = {(r.qaeAtVar.estimate * 100).toFixed(2)}% · statevector amplitude {(r.qaeAtVar.amplitudeStatevector * 100).toFixed(2)}%</p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" {...axis} /><YAxis {...axis} />
            <Tooltip formatter={(v, n) => [n === "prob" ? `${(Number(v) * 100).toFixed(2)}%` : v, n === "prob" ? "Probability" : "Counts"]} labelFormatter={(l, p) => `|${l}⟩ → ã = ${((p[0]?.payload?.a ?? 0) * 100).toFixed(2)}%`} />
            <Bar dataKey={r.job.cfg.shots ? "count" : "prob"} fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

export function LimitationsPanel() {
  return (
    <Panel>
      <h3 className="mb-2 font-semibold">Research integrity and limitations</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Circuits run on Q-CreditX's own exact statevector simulator in your browser — not Qiskit Aer, not CUDA-Q and not quantum hardware. Circuits export as OpenQASM 3 for execution elsewhere.</li>
        <li>Statevector cost grows as 2^qubits, so only a few assets fit; the paper's large-portfolio scaling refers to future fault-tolerant hardware.</li>
        <li>Simulated runs prove correctness, not speed-up. Runtime shown is classical CPU time.</li>
        <li>Discretising Z (nZ qubits, truncated at ±zMax) and scaling losses to integer units introduce approximation error versus the continuous model.</li>
        <li>Quantum and classical results are compared on the identical discretised problem at the same confidence level.</li>
      </ul>
    </Panel>
  );
}

function F({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
function Chart({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <Panel>
      <h3 className="font-semibold">{title}</h3>
      <p className="mb-3 text-xs text-muted-foreground">{note}</p>
      <div className="h-64"><ResponsiveContainer width="100%" height="100%">{children as React.ReactElement}</ResponsiveContainer></div>
    </Panel>
  );
}
