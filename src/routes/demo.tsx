import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, FileDown, Loader2, Play, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader, Panel, StatusPill } from "@/components/app-shell";
import { useQuantumRunner, useQuantumSetup, DEFAULT_SETUP } from "@/components/quantum/use-quantum";
import { PAPER_EXAMPLE, exactCdf, exactVaR, expectedLossUnits } from "@/lib/quantum/credit";
import { buildQae } from "@/lib/quantum/qae";
import { metrics, type CircuitMetrics } from "@/lib/quantum/circuit";
import type { QuantumRunResult } from "@/lib/quantum/workspace";
import { classicalForProblem, compare, type ComparisonResult } from "@/lib/compare";
import { exportFullReport } from "@/lib/report-full";
import { assetsQuery, portfoliosQuery } from "@/services/portfolio";
import { compactMoney } from "@/lib/format";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Research Demo — Q-CreditX" },
      { name: "description", content: "Guided live demonstration: IBM two-asset example, Monte Carlo, QAE, VaR, ECR and report export." },
      { property: "og:title", content: "Research Demo — Q-CreditX" },
      { property: "og:description", content: "Step-by-step live run of classical and quantum credit risk analysis." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Demo,
});

type S = "idle" | "running" | "done" | "error";
const ALPHA = 0.95, M = 4, SHOTS = 1000, SEED = 7, SAMPLES = 50_000;

function Demo() {
  const portfolios = useQuery(portfoliosQuery);
  const bank = useQuery(assetsQuery(portfolios.data?.[0]?.id));
  const [, setSetup] = useQuantumSetup();
  const runner = useQuantumRunner();
  const [st, setSt] = useState<S[]>(Array(11).fill("idle"));
  const [mc, setMc] = useState<ReturnType<typeof classicalForProblem> | null>(null);
  const [circ, setCirc] = useState<CircuitMetrics | null>(null);
  const [q, setQ] = useState<QuantumRunResult | null>(null);
  const [cmp, setCmp] = useState<ComparisonResult | null>(null);
  const set = (i: number, s: S) => setSt((p) => p.map((v, j) => (j === i ? s : v)));
  const p = PAPER_EXAMPLE;

  const step = async (i: number) => {
    set(i, "running");
    try {
      if (i === 0) { if (portfolios.isError || !portfolios.data) throw new Error("Database not reachable — portfolios could not be loaded"); }
      if (i === 1) setSetup({ ...DEFAULT_SETUP, problem: PAPER_EXAMPLE });
      if (i === 2) setSetup({ problem: PAPER_EXAMPLE, alpha: ALPHA, m: M, shots: SHOTS, seed: SEED });
      if (i === 3) { await new Promise((r) => setTimeout(r, 0)); setMc(classicalForProblem(p, { alpha: ALPHA, samples: SAMPLES, seed: SEED })); }
      if (i === 4) setCirc(metrics(buildQae(p, exactVaR(p, ALPHA), M).circuit));
      if (i === 5) { const r = await runner.run({ problem: p, alpha: ALPHA, cfg: { m: M, shots: SHOTS, seed: SEED } }); if (!r) throw new Error("Simulator did not finish"); setQ(r); }
      if (i >= 6 && i <= 8 && !q) throw new Error("Run step 6 (QAE) first");
      if (i === 9) { if (!mc || !q) throw new Error("Run steps 4 and 6 first"); setCmp(compare(p, ALPHA, mc, q, "comparative")); }
      if (i === 10) { if (!cmp) throw new Error("Run step 10 first"); await exportFullReport(cmp); }
      set(i, "done");
    } catch (e) { set(i, "error"); toast.error((e as Error).message); }
  };
  const runAll = async () => { for (let i = 0; i < 11; i++) { await step(i); } };

  const ex = exactCdf(p);
  const steps: { t: string; body: ReactNode }[] = [
    { t: "Open Dashboard", body: <>Portfolios loaded: {portfolios.data?.length ?? "…"}. <Link to="/dashboard" className="underline">Open Dashboard</Link></> },
    { t: "Load research portfolio", body: <>IBM Table I: λ = 1, 2 · p = 0.15, 0.25 · ρ = 0.10, 0.05. Sample banking portfolio: {bank.data?.length ?? "…"} synthetic assets{bank.data ? `, ${compactMoney(bank.data.reduce((s, a) => s + a.exposure, 0))}` : ""}.</> },
    { t: "Configure credit-risk model", body: <>Gaussian conditional independence · nZ = 2 · α = 95% · m = {M} · {SHOTS} shots · seed {SEED}</> },
    { t: "Run Monte Carlo", body: mc ? <>{SAMPLES.toLocaleString()} scenarios in {mc.ms.toFixed(0)} ms · VaR {mc.summary.var} · mean {mc.summary.meanLoss.toFixed(3)}</> : "Classical reference on the same two assets." },
    { t: "Build quantum circuit", body: circ ? <>{circ.qubits} qubits · {circ.gates.toLocaleString()} gates · depth {circ.depth.toLocaleString()}</> : "A = C·S·U plus QAE (controlled Grover powers, inverse QFT)." },
    { t: "Execute QAE on simulator", body: q ? <>{q.qaeEvaluations} amplitude estimations in {(q.totalMs / 1000).toFixed(2)} s (in-browser statevector simulator)</> : runner.progress ? <span className="flex items-center gap-2"><Progress value={runner.progress.frac * 100} className="h-2 w-40" />{runner.progress.msg}</span> : "Runs in a background worker." },
    { t: "Estimate CDF", body: q ? <>{q.cdf.map((c) => `F(${c.x}) ≈ ${c.estimate.toFixed(3)} (exact ${c.exact.toFixed(3)})`).join(" · ")}</> : "QAE estimate of P[L ≤ x] per threshold." },
    { t: "Calculate VaR", body: q ? <>Quantum VaR = {q.var} (exact {exactVaR(p, ALPHA)}) · {q.bisection.length} bisection steps{q.varUncertain ? " · CI overlaps α" : ""}</> : "Bisection over x." },
    { t: "Calculate ECR", body: q ? <>ECR = {q.var} − {expectedLossUnits(p).toFixed(2)} = {q.ecr.toFixed(2)}</> : "VaR − classical E[L]." },
    { t: "Compare classical and quantum", body: cmp ? <>VaR MC {cmp.classical?.var} · QAE {cmp.quantum?.var} · exact {cmp.exact.var} · max CDF error QAE {cmp.metrics.cdfMaxErr?.toFixed(3)} · MC {cmp.metrics.mcCdfMaxErr?.toFixed(3)}</> : "Same problem, same α." },
    { t: "Export research report", body: "PDF built from this live run only." },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Research Demo Mode" subtitle="Guided live run of the IBM two-asset example — results here come only from this session"
        actions={<div className="flex gap-2"><StatusPill tone="warn">RESEARCH DEMO · synthetic data</StatusPill><Button className="rounded-xl bg-brand-gradient" onClick={runAll} disabled={st.includes("running")}><Play /> Run all steps</Button></div>} />
      <Panel>
        <h2 className="font-semibold">Published reference (paper setup, computed by exact enumeration)</h2>
        <p className="mt-1 text-sm text-muted-foreground">E[L] = {expectedLossUnits(p).toFixed(2)} · VaR 95% = {exactVaR(p, ALPHA)} · ECR = {(exactVaR(p, ALPHA) - expectedLossUnits(p)).toFixed(2)} · CDF = [{ex.map((v) => v.toFixed(4)).join(", ")}]. This is a reference, not a run result.</p>
      </Panel>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={s.t}>
            <Panel className="flex flex-wrap items-center gap-4">
              <Icon s={st[i]!} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">Step {i + 1} · {s.t}</div>
                <div className="mt-1 break-words text-sm text-muted-foreground">{s.body}</div>
              </div>
              <Button variant="outline" className="rounded-xl" disabled={st[i] === "running"} onClick={() => step(i)}>
                {i === 10 ? <FileDown /> : <Play />} {st[i] === "done" ? "Re-run" : "Run"}
              </Button>
            </Panel>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Icon({ s }: { s: S }) {
  if (s === "running") return <Loader2 className="size-5 animate-spin text-primary-deep" />;
  if (s === "done") return <CheckCircle2 className="size-5 text-success" />;
  if (s === "error") return <XCircle className="size-5 text-destructive" />;
  return <Circle className="size-5 text-muted-foreground" />;
}
