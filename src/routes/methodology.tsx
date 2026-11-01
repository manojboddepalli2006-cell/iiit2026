import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, StatusPill } from "@/components/app-shell";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Research Methodology — Q-CreditX" },
      { name: "description", content: "Credit risk models, quantum operators U, S, C, amplitude estimation and bisection VaR as used in Q-CreditX." },
      { property: "og:title", content: "Research Methodology — Q-CreditX" },
      { property: "og:description", content: "Paper methodology versus Q-CreditX implementation choices and limitations." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Methodology,
});

const sections: { t: string; f: string; paper: string; impl: string }[] = [
  { t: "Independent default model", f: "X_k ~ Bernoulli(p_k),  L = Σ λ_k X_k,  λ_k = Exposure_k × LGD_k", paper: "Baseline where assets default independently.", impl: "Classical Monte Carlo with a seeded generator; available on the full portfolio and on the quantum-sized problem." },
  { t: "Gaussian conditional independence", f: "p_k(z) = Φ((Φ⁻¹(p_k) − √ρ_k · z) / √(1 − ρ_k)),  Z ~ N(0,1)", paper: "One systematic factor Z drives correlated defaults; given Z, defaults are independent.", impl: "Monte Carlo samples continuous Z. The circuit and the exact reference use Z truncated to [−2, 2] on 2^nZ points." },
  { t: "Uncertainty loading U", f: "U|0⟩ = Σ_i √p_Z(i) |i⟩_Z ⊗ ⊗_k (√(1−p_k(z_i))|0⟩ + √p_k(z_i)|1⟩)", paper: "Loads the discretised Z distribution, then rotates one qubit per asset conditioned on Z.", impl: "Binary tree of (multi-)controlled RY gates for Z; one RY per asset per Z value, controlled on the Z register." },
  { t: "Weighted sum S", f: "|x⟩|0⟩ ↦ |x⟩|Σ λ_k x_k⟩", paper: "Adds each defaulted asset's loss into a sum register.", impl: "Integer λ_k only; portfolio losses are scaled to loss units and rounded, with the rounding shown per asset. Built from controlled adder gates." },
  { t: "Comparator C", f: "|L⟩|0⟩ ↦ |L⟩|1{L ≤ x}⟩", paper: "Flips an objective qubit when the loss is at most x.", impl: "Exact reversible comparator on the sum register against a classical constant x." },
  { t: "Quantum oracle A = C·S·U", f: "A|0⟩ = √(1−a)|ψ₀⟩|0⟩ + √a|ψ₁⟩|1⟩,  a = P[L ≤ x]", paper: "The objective-qubit probability equals the loss CDF at x.", impl: "Verified against exact enumeration in automated tests (difference below 10⁻⁹)." },
  { t: "Quantum Amplitude Estimation", f: "ã = sin²(π y / 2^m),  |ã − a| ≤ 2π√(a(1−a))/2^m + π²/2^(2m)", paper: "Canonical QAE: m evaluation qubits, controlled Grover powers Q^(2^j), inverse QFT. Error O(1/M) versus O(1/√M) for Monte Carlo.", impl: "Implemented gate-for-gate and executed on an in-browser statevector simulator, with finite-shot sampling." },
  { t: "Bisection-based VaR", f: "VaR_α = min{ x : P[L ≤ x] ≥ α }", paper: "Classical bisection over x, with one QAE CDF estimate per step.", impl: "Each step is flagged 'uncertain' when the confidence interval overlaps α; the search still continues on the point estimate." },
  { t: "Economic Capital Requirement", f: "ECR_α = VaR_α − E[L],  E[L] = Σ λ_k p_k", paper: "E[L] is computed classically; QAE is applied to the CDF.", impl: "Expected Loss is analytic and shared by the classical and quantum ECR figures." },
];

function Methodology() {
  return (
    <div className="space-y-6">
      <PageHeader title="Research Methodology" subtitle="Egger, García Gutiérrez, Mestre & Woerner — Credit Risk Analysis using Quantum Computers (IBM Research, 2019)" />
      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((s) => (
          <Panel key={s.t}>
            <h3 className="font-semibold">{s.t}</h3>
            <code className="mt-3 block overflow-x-auto rounded-xl bg-accent px-3 py-2 text-sm text-primary-deep">{s.f}</code>
            <div className="mt-3 space-y-2 text-sm">
              <p><StatusPill tone="pending">Paper</StatusPill> <span className="text-muted-foreground">{s.paper}</span></p>
              <p><StatusPill tone="ok">Q-CreditX</StatusPill> <span className="text-muted-foreground">{s.impl}</span></p>
            </div>
          </Panel>
        ))}
      </div>
      <Panel>
        <h3 className="font-semibold">Prototype limitations</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Quantum circuits run on a classical statevector simulator inside the browser (up to 20 qubits) — not Qiskit Aer, CUDA-Q or quantum hardware. Circuits can be exported as OpenQASM 3 for external execution.</li>
          <li>Only small problems (about 4 assets, ≤ 31 loss units) fit; the full portfolio uses classical Monte Carlo.</li>
          <li>Measured simulator times say nothing about quantum speed-up; none is claimed.</li>
          <li>All portfolio data is synthetic. The demo workspace has no sign-in.</li>
        </ul>
      </Panel>
    </div>
  );
}
