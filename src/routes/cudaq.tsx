import { createFileRoute } from "@tanstack/react-router";
import { Cpu, Server, BookOpen } from "lucide-react";
import { PageHeader, Panel, StatusPill } from "@/components/app-shell";

export const Route = createFileRoute("/cudaq")({
  head: () => ({
    meta: [
      { title: "CudaQ Workspace — Q-CreditX" },
      { name: "description", content: "Planned CUDA-Q quantum simulator workspace for credit risk amplitude estimation." },
      { property: "og:title", content: "CudaQ Workspace — Q-CreditX" },
      { property: "og:description", content: "Simulator connection status and integration roadmap." },
    ],
  }),
  component: CudaQ,
});

const steps = [
  ["Connect CUDA-Q simulator backend", "Stage 2"],
  ["Build uncertainty loading U for latent Z and defaults", "Stage 2"],
  ["Weighted-sum S and comparator C operators", "Stage 3"],
  ["Run iterative QAE for EL, CDF and VaR bisection", "Stage 3"],
];

function CudaQ() {
  return (
    <div className="space-y-6">
      <PageHeader title="CudaQ Workspace" subtitle="NVIDIA CUDA-Q quantum simulation environment" />
      <div className="grid gap-4 md:grid-cols-3">
        <Panel><Server className="size-5 text-primary-deep" /><div className="mt-3 text-sm text-muted-foreground">Simulator connection</div><div className="mt-1"><StatusPill tone="bad">Not connected</StatusPill></div></Panel>
        <Panel><Cpu className="size-5 text-primary-deep" /><div className="mt-3 text-sm text-muted-foreground">Target backend</div><div className="mt-1 font-semibold">State-vector simulator</div><StatusPill tone="pending">Planned</StatusPill></Panel>
        <Panel><BookOpen className="size-5 text-primary-deep" /><div className="mt-3 text-sm text-muted-foreground">Quantum jobs executed</div><div className="mt-1 font-display text-2xl font-bold">0</div></Panel>
      </div>
      <Panel>
        <h2 className="font-semibold">Integration roadmap</h2>
        <ul className="mt-4 divide-y">
          {steps.map(([s, st]) => (
            <li key={s} className="flex items-center justify-between py-3 text-sm"><span>{s}</span><StatusPill tone="pending">{st} · pending</StatusPill></li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">No quantum execution has been performed. All current results come from classical Monte Carlo on synthetic data.</p>
      </Panel>
    </div>
  );
}
