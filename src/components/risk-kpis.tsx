import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/app-shell";
import { analysesQuery } from "@/services/analyses";
import { comparisonsQuery } from "@/services/comparisons";
import { compactMoney, money } from "@/lib/format";

/** Dashboard KPIs from saved results only: latest full-portfolio MC run and latest quantum comparison. */
export function RiskKpiStrip() {
  const a = useQuery(analysesQuery).data?.[0];
  const cmp = useQuery(comparisonsQuery).data?.find((c) => c.quantum);
  const q = cmp?.quantum;
  const k = (l: string, v: string, s?: string) => (
    <div className="rounded-xl bg-accent p-3"><div className="text-xs text-muted-foreground">{l}</div><div className="mt-1 truncate font-semibold">{v}</div>{s && <div className="truncate text-[11px] text-muted-foreground">{s}</div>}</div>
  );
  return (
    <Panel>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Risk overview</h2>
        <Button asChild size="sm" variant="outline" className="rounded-xl"><Link to="/compare">Classical vs quantum <ArrowRight /></Link></Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {k("Total exposure", a ? compactMoney(a.totalExposure) : "—", a?.portfolioName)}
        {k("Expected Loss", a ? money(a.expectedLoss) : "—", "analytic")}
        {k(`Classical VaR${a ? ` ${(a.confidence * 100).toFixed(1)}%` : ""}`, a ? money(a.var) : "—", a ? `${a.samples.toLocaleString()} MC scenarios` : "run analysis below")}
        {k("Classical ECR", a ? money(a.ecr) : "—")}
        {k(`Quantum VaR${cmp ? ` ${(cmp.alpha * 100).toFixed(1)}%` : ""}`, q ? `${q.var} units` : "—", q ? `${money(q.var * cmp!.unit)} · ${cmp!.problemLabel}` : "no quantum run yet")}
        {k("Quantum ECR", q ? `${q.ecr.toFixed(2)} units` : "—", q ? `${money(q.ecr * cmp!.unit)} · QAE simulator` : undefined)}
      </div>
      {a && q && <p className="mt-3 text-xs text-muted-foreground">Classical figures cover the full portfolio; quantum figures cover the small problem that fits the simulator, so they are not directly comparable. Use the comparison page for like-for-like numbers.</p>}
    </Panel>
  );
}
