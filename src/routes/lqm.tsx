import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, StatusPill } from "@/components/app-shell";

export const Route = createFileRoute("/lqm")({
  head: () => ({
    meta: [
      { title: "Loss Quantification Model — Q-CreditX" },
      { name: "description", content: "Expected loss, loss distribution, Value at Risk and economic capital explained." },
      { property: "og:title", content: "Loss Quantification Model — Q-CreditX" },
      { property: "og:description", content: "How Q-CreditX quantifies portfolio credit loss." },
    ],
  }),
  component: LQM,
});

const items = [
  { t: "Expected Loss", f: "EL = Σ Exposure_k × PD_k × LGD_k", d: "The average loss over the horizon. Computed analytically for every asset and summed.", s: "Implemented" },
  { t: "Loss distribution", f: "L = Σ λ_k · 1{default_k},  λ_k = Exposure_k × LGD_k", d: "Defaults are either independent, or conditionally independent given a shared factor Z with p_k(z) = Φ((Φ⁻¹(p_k) − √ρ_k z)/√(1−ρ_k)).", s: "Implemented (classical MC)" },
  { t: "Value at Risk", f: "VaR_α = inf{ x : P[L ≤ x] ≥ α }", d: "The loss threshold not exceeded with confidence α (95%, 99%, 99.9%). Estimated from Monte Carlo samples; QAE estimation is planned.", s: "Classical only" },
  { t: "Economic Capital", f: "ECR_α = VaR_α − EL", d: "Capital a bank holds to absorb unexpected losses beyond the expected level.", s: "Classical only" },
];

function LQM() {
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
      <Panel className="text-sm text-muted-foreground">Quantum amplitude estimation of the CDF, VaR and ECR is <b className="text-foreground">pending</b> (Stage 3). No quantum speedup is claimed in this prototype.</Panel>
    </div>
  );
}
