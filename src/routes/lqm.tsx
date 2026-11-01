import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader, Panel, StatusPill } from "@/components/app-shell";
import { RiskKpiStrip } from "@/components/risk-kpis";
import { LossCdf, LossHistogram } from "@/components/risk-charts";
import { analysesQuery } from "@/services/analyses";

export const Route = createFileRoute("/lqm")({
  head: () => ({
    meta: [
      { title: "Loss Quantification Model — Q-CreditX" },
      { name: "description", content: "Expected loss, loss distribution, Value at Risk and economic capital explained." },
      { property: "og:title", content: "Loss Quantification Model — Q-CreditX" },
      { property: "og:description", content: "How Q-CreditX quantifies portfolio credit loss." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LQM,
});

const items = [
  { t: "Expected Loss", f: "EL = Σ Exposure_k × PD_k × LGD_k", d: "The average loss over the horizon. Computed analytically for every asset and summed.", s: "Implemented" },
  { t: "Loss distribution", f: "L = Σ λ_k · 1{default_k},  λ_k = Exposure_k × LGD_k", d: "Defaults are either independent, or conditionally independent given a shared factor Z with p_k(z) = Φ((Φ⁻¹(p_k) − √ρ_k z)/√(1−ρ_k)).", s: "Implemented (classical MC)" },
  { t: "Value at Risk", f: "VaR_α = inf{ x : P[L ≤ x] ≥ α }", d: "The loss threshold not exceeded with confidence α (95%, 99%, 99.9%). Estimated from Monte Carlo samples (Dashboard) and by QAE with bisection on the statevector simulator (Quantum Workspace).", s: "Classical + QAE (simulator)" },
  { t: "Economic Capital", f: "ECR_α = VaR_α − EL", d: "Capital a bank holds to absorb unexpected losses beyond the expected level.", s: "Classical + QAE (simulator)" },
];

function LQM() {
  const latest = useQuery(analysesQuery).data?.[0];
  return (
    <div className="space-y-6">
      <PageHeader title="Loss Quantification Model" subtitle="The risk measures computed by Q-CreditX" />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((i) => (
          <Panel key={i.t}>
            <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{i.t}</h3><StatusPill tone={i.s === "Implemented" ? "ok" : "pending"}>{i.s}</StatusPill></div>
            <code className="mt-3 block rounded-xl bg-accent px-3 py-2 text-sm text-primary-deep">{i.f}</code>
            <p className="mt-3 text-sm text-muted-foreground">{i.d}</p>
          </Panel>
        ))}
      </div>
      <RiskKpiStrip />
      {latest ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel><h3 className="mb-2 font-semibold">Loss distribution · {latest.portfolioName}</h3><LossHistogram a={latest} /></Panel>
          <Panel><h3 className="mb-2 font-semibold">Cumulative distribution</h3><LossCdf a={latest} /></Panel>
        </div>
      ) : <Panel className="text-sm text-muted-foreground">Run an analysis on the Dashboard to see the live loss distribution here.</Panel>}
      <Panel className="text-sm text-muted-foreground">Quantum CDF, VaR and ECR come from QAE on the in-browser statevector simulator (see Compare). Expected Loss is always computed classically. No quantum speed-up is claimed.</Panel>
    </div>
  );
}
