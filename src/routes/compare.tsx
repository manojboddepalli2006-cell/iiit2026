import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, FileDown, FileSpreadsheet, Loader2, MinusCircle, Play, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, StatusPill } from "@/components/app-shell";
import { QuantumSetupForm } from "@/components/quantum/quantum-panels";
import { useQuantumSetup } from "@/components/quantum/use-quantum";
import { LATEST_COMPARISON_KEY, STEPS, useUnifiedRun, type StepState } from "@/components/quantum/use-unified-run";
import { CdfCompareChart, ConvergenceChart, DistributionChart, ResourceChart, VersusChart } from "@/components/compare-charts";
import type { ComparisonResult, RunMode } from "@/lib/compare";
import { comparisonsQuery, deleteComparison, type StoredComparison } from "@/services/comparisons";
import { analysesQuery } from "@/services/analyses";
import { portfoliosQuery } from "@/services/portfolio";
import { exportComparisonCsv, exportFullReport, exportQuantumMetricsCsv } from "@/lib/report-full";
import { money } from "@/lib/format";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Classical vs Quantum — Q-CreditX" },
      { name: "description", content: "Run classical, quantum or comparative credit-risk analysis and compare VaR, ECR, CDF error and circuit resources." },
      { property: "og:title", content: "Classical vs Quantum — Q-CreditX" },
      { property: "og:description", content: "Exact reference, Monte Carlo and QAE estimates side by side on the same portfolio problem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Compare,
});

const SAMPLES = [10_000, 50_000, 100_000, 500_000];

function Compare() {
  const qc = useQueryClient();
  const [setup, setSetup] = useQuantumSetup();
  const [mode, setMode] = useState<RunMode>("comparative");
  const [samples, setSamples] = useState(50_000);
  const { run, steps, running, quantumProgress, cancel } = useUnifiedRun();
  const history = useQuery(comparisonsQuery);
  const portfolios = useQuery(portfoliosQuery);
  const analyses = useQuery(analysesQuery);
  const session = useQuery<ComparisonResult | undefined>({ queryKey: LATEST_COMPARISON_KEY, queryFn: () => undefined, enabled: false });
  const [picked, setPicked] = useState<string>();
  const r = (picked ? history.data?.find((h) => h.id === picked) : undefined) ?? session.data ?? history.data?.[0];
  const fromPaper = setup.problem.unit === 1 && setup.problem.label.startsWith("Paper");

  const start = async () => {
    setPicked(undefined);
    await run(mode, setup, { samples, portfolioId: fromPaper ? null : portfolios.data?.[0]?.id ?? null });
  };
  const remove = async (id: string) => {
    try { await deleteComparison(id); qc.invalidateQueries({ queryKey: ["comparisons"] }); toast.success("Comparison deleted"); }
    catch (e) { toast.error((e as Error).message); }
  };
  const done = steps.filter((s) => s === "done" || s === "skipped").length;

  return (
    <div className="space-y-6">
      <PageHeader title="Classical vs Quantum" subtitle="One Run Analysis workflow · exact reference, Monte Carlo and QAE on the same problem"
        actions={<StatusPill tone="ok">QUANTUM SIMULATOR — in-browser statevector</StatusPill>} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Panel className="min-w-0">
          <h2 className="mb-4 text-lg font-semibold">Run Analysis</h2>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Execution mode</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as RunMode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="classical">A · Classical only</SelectItem>
                  <SelectItem value="quantum">B · Quantum only</SelectItem>
                  <SelectItem value="comparative">C · Comparative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Monte Carlo samples</Label>
              <Select value={String(samples)} onValueChange={(v) => setSamples(Number(v))} disabled={mode === "quantum"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SAMPLES.map((s) => <SelectItem key={s} value={String(s)}>{s.toLocaleString()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="min-w-0 overflow-x-auto"><QuantumSetupForm setup={setup} onChange={setSetup} /></div>
          <div className="mt-5 flex gap-2">
            <Button size="lg" className="flex-1 rounded-xl bg-brand-gradient shadow-lift" onClick={start} disabled={running}>
              {running ? <Loader2 className="animate-spin" /> : <Play />} Run Analysis
            </Button>
            {running && quantumProgress && <Button variant="outline" size="lg" className="rounded-xl" onClick={cancel}>Cancel</Button>}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Full 100-asset Monte Carlo stays on the Dashboard. Quantum and comparative runs use this small problem because statevector cost doubles with every qubit.</p>
        </Panel>

        <Panel>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Workflow</h2>
            <span className="text-xs text-muted-foreground">{done}/{STEPS.length}</span>
          </div>
          <ol className="grid gap-2 sm:grid-cols-2">
            {STEPS.map((s, i) => <Step key={s} n={i + 1} label={s} state={steps[i]!} />)}
          </ol>
          {quantumProgress && (
            <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              <Progress value={quantumProgress.frac * 100} className="h-2" />
              <span>{quantumProgress.msg} · {Math.round(quantumProgress.frac * 100)}%</span>
            </div>
          )}
        </Panel>
      </div>

      {!r ? (
        <Panel><p className="py-10 text-center text-sm text-muted-foreground">No comparison yet. Choose a mode and press Run Analysis.</p></Panel>
      ) : <Results r={r} portfolioRun={analyses.data?.[0]} />}

      <Panel>
        <h2 className="mb-3 text-lg font-semibold">Saved analyses</h2>
        {history.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : !history.data?.length ? <p className="text-sm text-muted-foreground">Nothing saved yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="py-2">When</th><th>Mode</th><th>Problem</th><th>α</th><th>Exact VaR</th><th>MC VaR</th><th>QAE VaR</th><th /></tr></thead>
              <tbody>
                {history.data.map((h: StoredComparison) => (
                  <tr key={h.id} className={`border-t ${r && "id" in r && r.id === h.id ? "bg-accent/60" : ""}`}>
                    <td className="py-2">{new Date(h.createdAt).toLocaleString()}</td><td className="capitalize">{h.mode}</td><td>{h.problemLabel}</td><td>{h.alpha}</td>
                    <td>{h.exact.var}</td><td>{h.classical?.var ?? "—"}</td><td>{h.quantum?.var ?? "—"}</td>
                    <td className="space-x-1 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setPicked(h.id)}>View</Button>
                      <Button size="sm" variant="ghost" aria-label="Delete comparison" onClick={() => remove(h.id)}><Trash2 className="text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Step({ n, label, state }: { n: number; label: string; state: StepState }) {
  const icon = { idle: <Circle className="size-4 text-muted-foreground" />, running: <Loader2 className="size-4 animate-spin text-primary-deep" />, done: <CheckCircle2 className="size-4 text-success" />, skipped: <MinusCircle className="size-4 text-muted-foreground" />, error: <XCircle className="size-4 text-destructive" /> }[state];
  return <li className="flex items-center gap-2 rounded-xl bg-accent/50 px-3 py-2 text-sm">{icon}<span className="text-muted-foreground">{n}.</span> {label}{state === "skipped" && <span className="ml-auto text-xs text-muted-foreground">skipped</span>}</li>;
}

function Results({ r, portfolioRun }: { r: ComparisonResult; portfolioRun: Parameters<typeof exportFullReport>[1] }) {
  const q = r.quantum, c = r.classical, m = r.metrics;
  const u = (v: number | null | undefined, d = 3) => (v == null ? "—" : Number(v.toFixed(d)).toString());
  const mon = (v: number | null | undefined) => (v == null ? "" : money(v * r.unit));
  return (
    <>
      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Comparison · {r.problemLabel}</h2>
            <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()} · α = {r.alpha} · {r.model} · 1 loss unit = {money(r.unit)} · mode {r.mode}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => exportFullReport(r, portfolioRun)}><FileDown /> PDF report</Button>
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => exportComparisonCsv(r)}><FileSpreadsheet /> Comparison CSV</Button>
            <Button size="sm" variant="outline" className="rounded-xl" disabled={!q} onClick={() => exportQuantumMetricsCsv(r)}><FileSpreadsheet /> Quantum metrics CSV</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-2">Metric</th><th>Exact reference (discretised Z)</th><th>Classical Monte Carlo</th><th>Quantum estimate (QAE)</th></tr>
            </thead>
            <tbody className="[&_td]:py-2 [&_tr]:border-t">
              <tr><td>Expected Loss (classical, shared)</td><td>{u(r.expectedLoss, 4)}</td><td>{u(r.expectedLoss, 4)} <span className="text-xs text-muted-foreground">(MC mean {u(c?.mean, 4)})</span></td><td>{u(r.expectedLoss, 4)} <span className="text-xs text-muted-foreground">reference, not estimated by QAE</span></td></tr>
              <tr><td>VaR {(r.alpha * 100).toFixed(1)}% (units)</td><td>{r.exact.var} <Sub>{mon(r.exact.var)}</Sub></td><td>{u(c?.var, 0)} <Sub>{mon(c?.var)}</Sub></td><td>{u(q?.var, 0)} <Sub>{mon(q?.var)}</Sub>{q?.uncertain && <StatusPill tone="warn">CI overlaps α</StatusPill>}</td></tr>
              <tr><td>ECR = VaR − E[L]</td><td>{u(r.exact.ecr)}</td><td>{u(c?.ecr)}</td><td>{u(q?.ecr)}</td></tr>
              <tr><td>CDF at quantum VaR</td><td>{q ? u(r.exact.cdf[q.var], 4) : "—"}</td><td>{q && c ? u(c.cdf[q.var]?.p, 4) : "—"}</td><td>{q ? `${u(q.cdfAtVar, 4)} [${u(q.ci[0], 3)}, ${u(q.ci[1], 3)}]` : "—"}</td></tr>
              <tr><td>Execution time (measured)</td><td>—</td><td>{c ? `${c.ms.toFixed(1)} ms` : "—"}</td><td>{q ? `${(q.ms / 1000).toFixed(2)} s on classical simulator` : "—"}</td></tr>
              <tr><td>Work</td><td>enumeration</td><td>{c ? `${c.samples.toLocaleString()} samples` : "—"}</td><td>{q ? `${q.oracleCalls.toLocaleString()} oracle calls · ${q.qaeEvaluations} QAE runs` : "—"}</td></tr>
            </tbody>
          </table>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <Kpi l="|VaR diff| MC vs QAE" v={u(m.varAbsDiff)} />
          <Kpi l="VaR relative diff" v={m.varRelDiff == null ? (c && q ? "undefined (MC VaR = 0)" : "—") : `${u(m.varRelDiff, 2)}%`} />
          <Kpi l="|ECR diff|" v={u(m.ecrAbsDiff)} />
          <Kpi l="Max CDF error · QAE" v={u(m.cdfMaxErr, 4)} />
          <Kpi l="Max CDF error · MC" v={u(m.mcCdfMaxErr, 4)} />
          <Kpi l="Amplitude error at VaR" v={u(m.amplitudeErr, 4)} />
          <Kpi l="QAE bound ε" v={u(q?.epsilon, 4)} />
          <Kpi l="Eval qubits · depth · gates" v={q ? `${q.evalQubits} · ${q.depth} · ${q.gates}` : "—"} />
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Times are measured on this computer; the quantum time is a classical statevector simulation and says nothing about quantum speed-up. Oracle calls versus samples are counts, not runtimes.</p>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Chart t="1 · Portfolio loss distribution" d="Exact P(L = x) bars, Monte Carlo line, VaR, tail region and E[L]."><DistributionChart r={r} /></Chart>
        <Chart t="2 · Cumulative distribution" d="Exact and Monte Carlo CDFs; red points are only the thresholds where QAE was run."><CdfCompareChart r={r} /></Chart>
        <Chart t="3 · QAE convergence" d="Estimate at the VaR threshold versus evaluation qubits."><ConvergenceChart r={r} /></Chart>
        <Chart t="4 · Resource analysis" d={q ? `Depth ${q.depth} · ${q.gates} gates · ${q.oracleCalls.toLocaleString()} oracle calls · oracle A: ${q.oracleQubits} qubits, depth ${q.oracleDepth}` : "Logical, evaluation and ancilla qubits."}><ResourceChart r={r} /></Chart>
        <Chart t="5 · Classical vs quantum" d="VaR and ECR across the three references (loss units)."><VersusChart r={r} /></Chart>
        <Panel>
          <h3 className="font-semibold">Sources of difference</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Gaussian discretisation and truncation of Z (circuit and exact use 2^nZ points; Monte Carlo is continuous).</li>
            <li>Rounding of each asset loss to integer units for the sum register.</li>
            <li>QAE resolution: estimates lie on the grid sin²(πy/2^m).</li>
            <li>Finite shots and Monte Carlo sampling noise.</li>
            <li>Rotations are exact in the simulator; no hardware noise or transpilation.</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}

const Sub = ({ children }: { children: ReactNode }) => <span className="block text-xs text-muted-foreground">{children}</span>;
const Kpi = ({ l, v }: { l: string; v: string }) => <div className="rounded-xl bg-accent p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="mt-1 truncate font-semibold">{v}</div></div>;
function Chart({ t, d, children }: { t: string; d: string; children: ReactNode }) {
  return <Panel><h3 className="font-semibold">{t}</h3><p className="mb-2 text-xs text-muted-foreground">{d}</p>{children}</Panel>;
}
