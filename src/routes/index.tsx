import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Banknote, Gauge, ShieldAlert, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, StatusPill } from "@/components/app-shell";
import { ANALYSIS_KEY, type StoredAnalysis } from "@/components/analysis-panel";
import { assetsQuery, portfoliosQuery } from "@/services/portfolio";
import { analysesQuery } from "@/services/analyses";
import { QuantumKpis } from "@/components/quantum/quantum-panels";
import { useLatestQuantum } from "@/components/quantum/use-quantum";
import type { QuantumRunResult } from "@/lib/quantum/workspace";
import { portfolioEL, totalExposure } from "@/lib/risk/engine";
import { compactMoney, pct } from "@/lib/format";
import chip from "@/assets/quantum-chip.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Q-CreditX — Quantum-Enhanced Credit Risk Analysis" },
      { name: "description", content: "Analyze portfolio credit risk with classical Monte Carlo today and quantum amplitude estimation next." },
      { property: "og:title", content: "Q-CreditX — Quantum-Enhanced Credit Risk Analysis" },
      { property: "og:description", content: "Expected loss, VaR and economic capital for a synthetic loan portfolio." },
    ],
  }),
  component: Index,
});

function Index() {
  const portfolios = useQuery(portfoliosQuery);
  const pid = portfolios.data?.[0]?.id;
  const assets = useQuery(assetsQuery(pid));
  const analysis = useQuery<StoredAnalysis | undefined>({ queryKey: ANALYSIS_KEY, queryFn: () => undefined, enabled: false });
  const list = assets.data ?? [];
  const exp = totalExposure(list);
  const el = portfolioEL(list);
  const history = useQuery(analysesQuery);
  const quantum = useLatestQuantum() as QuantumRunResult | undefined;
  const a = analysis.data?.portfolioId === pid ? analysis.data : history.data?.find((h) => h.portfolioId === pid);
  const stamp = a ? ` · ${a.samples.toLocaleString()} samples · ${new Date(a.createdAt).toLocaleString()}` : "";
  const loading = portfolios.isLoading || assets.isLoading;

  const kpis = [
    { label: "Total Portfolio Exposure", value: compactMoney(exp), note: `${list.length} assets`, icon: Banknote },
    { label: "Expected Loss (EL)", value: compactMoney(el), note: exp ? `${pct(el / exp)} of exposure` : "—", icon: TrendingDown },
    { label: "Value at Risk (VaR)", value: a ? compactMoney(a.var) : "Not computed", note: a ? `${(a.confidence * 100).toFixed(1)}% · Monte Carlo${stamp}` : "Run an analysis", icon: Gauge },
    { label: "Economic Capital (ECR)", value: a ? compactMoney(a.ecr) : "Not computed", note: a ? `VaR − E[L] · synthetic demo result` : "Run an analysis", icon: ShieldAlert },
  ];

  return (
    <div className="space-y-6">
      <section className="grid items-center gap-6 overflow-hidden rounded-3xl border bg-hero p-6 shadow-soft md:grid-cols-2 md:p-10">
        <div>
          <StatusPill tone="pending">Stage 3 · Quantum amplitude estimation (simulator)</StatusPill>
          <h1 className="mt-4 text-3xl font-bold leading-tight md:text-5xl">Quantum-Enhanced Credit Risk Analysis</h1>
          <p className="mt-4 max-w-lg text-muted-foreground">
            Analyze portfolio credit risk using classical Monte Carlo simulation and quantum amplitude estimation.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-xl bg-brand-gradient shadow-lift">
              <Link to="/dashboard">Run Analysis <ArrowRight /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-xl">
              <Link to="/lqm">How it works</Link>
            </Button>
          </div>
        </div>
        <img src={chip} alt="Quantum processor chip with financial elements" width={1024} height={768} className="w-full rounded-2xl" />
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Portfolio overview</h2>
        <StatusPill tone="warn">Demonstration data · synthetic</StatusPill>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <Panel key={k.label} className="transition-shadow hover:shadow-lift">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{k.label}</span>
              <span className="grid size-9 place-items-center rounded-xl bg-accent text-primary-deep"><k.icon className="size-4" strokeWidth={1.75} /></span>
            </div>
            {loading ? <Skeleton className="mt-3 h-8 w-32" /> : <div className="mt-3 font-display text-2xl font-bold">{k.value}</div>}
            <div className="mt-1 text-xs text-muted-foreground">{k.note}</div>
          </Panel>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Quantum results</h2>
        <StatusPill tone="ok">{quantum ? `Statevector simulator · ${quantum.job.problem.label}` : "Simulator ready · no run yet"}</StatusPill>
      </div>
      <QuantumKpis r={quantum} />
    </div>
  );
}
