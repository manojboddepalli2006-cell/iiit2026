import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, StatusPill } from "@/components/app-shell";

export const Route = createFileRoute("/q-circuits")({
  head: () => ({
    meta: [
      { title: "Q-Circuits — Q-CreditX" },
      { name: "description", content: "Planned quantum operators U, S and C for credit risk analysis (Egger et al., 2019)." },
      { property: "og:title", content: "Q-Circuits — Q-CreditX" },
      { property: "og:description", content: "Uncertainty loading, weighted sum and comparator operators." },
    ],
  }),
  component: QCircuits,
});

const ops = [
  { k: "U", name: "Uncertainty loading", desc: "Loads the discretised latent variable Z into n_Z qubits and rotates one qubit per asset so it is |1⟩ with probability p_k(z)." },
  { k: "S", name: "Weighted-sum operator", desc: "Adds λ_k = Exposure_k × LGD_k into a sum register for each defaulted asset, producing the total loss L." },
  { k: "C", name: "Comparator", desc: "Flips an objective qubit when L ≤ x, so its |1⟩ amplitude equals P[L ≤ x] — the loss CDF." },
  { k: "QAE", name: "Quantum amplitude estimation", desc: "Estimates the objective amplitude with O(1/M) error versus O(1/√M) for Monte Carlo; bisection over x yields VaR." },
];

function QCircuits() {
  return (
    <div className="space-y-6">
      <PageHeader title="Q-Circuits" subtitle="Planned circuit architecture following Egger et al. (IBM Research, 2019)" actions={<StatusPill tone="pending">Design stage · not executed</StatusPill>} />
      <Panel>
        <div className="flex items-center gap-2 overflow-x-auto py-4 font-mono text-sm">
          <span className="text-muted-foreground">|0⟩ ⊗ n</span>
          {ops.map((o, i) => (
            <div key={o.k} className="flex items-center gap-2">
              <span className="h-px w-8 bg-border" />
              <span className={`grid h-12 min-w-12 place-items-center rounded-xl px-3 font-semibold ${i === 3 ? "bg-primary-deep text-primary-foreground" : "bg-accent text-primary-deep"}`}>{o.k}</span>
            </div>
          ))}
          <span className="h-px w-8 bg-border" /><span className="text-muted-foreground">→ P[L ≤ x]</span>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-2">
        {ops.map((o) => (
          <Panel key={o.k}>
            <div className="flex items-center justify-between"><h3 className="font-semibold">{o.k} — {o.name}</h3><StatusPill tone="pending">Planned</StatusPill></div>
            <p className="mt-2 text-sm text-muted-foreground">{o.desc}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
