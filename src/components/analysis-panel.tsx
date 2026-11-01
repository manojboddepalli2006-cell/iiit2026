import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel, StatusPill } from "@/components/app-shell";
import { portfolioEL, runMonteCarlo, totalExposure, type MonteCarloResult } from "@/lib/risk/engine";
import type { AnalysisConfig, Asset } from "@/lib/risk/types";
import { compactMoney, money } from "@/lib/format";

export const ANALYSIS_KEY = ["analysis-result"] as const;
export type StoredAnalysis = MonteCarloResult & { model: string; portfolioId: string };

export function AnalysisPanel({
  assets, portfolios, portfolioId, onPortfolioChange, initial, onComplete,
}: {
  assets: Asset[];
  portfolios: { id: string; name: string }[];
  portfolioId: string;
  onPortfolioChange: (id: string) => void;
  initial?: Partial<AnalysisConfig> | undefined;
  onComplete?: ((r: StoredAnalysis) => void) | undefined;
}) {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<AnalysisConfig>({ model: "gaussian", confidence: 0.99, samples: 20000, algorithm: "classical", ...initial });
  useEffect(() => { if (initial) setCfg((c) => ({ ...c, ...initial })); }, [initial]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<StoredAnalysis | undefined>(() => qc.getQueryData<StoredAnalysis>(ANALYSIS_KEY));

  const run = (): void => {
    if (!assets.length) { toast.error("Portfolio has no assets to analyse"); return; }
    if (cfg.algorithm === "quantum") { toast.info("Quantum amplitude estimation is planned for Stage 3"); return; }
    if (!(cfg.samples >= 1000 && cfg.samples <= 200000)) { toast.error("Sample count must be between 1,000 and 200,000"); return; }
    setRunning(true);
    setTimeout(() => {
      const r = { ...runMonteCarlo(assets, cfg), model: cfg.model, portfolioId };
      qc.setQueryData(ANALYSIS_KEY, r);
      setResult(r);
      setRunning(false);
      onComplete?.(r);
      toast.success("Classical Monte Carlo analysis complete");
    }, 30);
  };

  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Risk analysis configuration</h2>
        <StatusPill tone="pending">Horizon: 1 year</StatusPill>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="Portfolio">
          <Select value={portfolioId} onValueChange={onPortfolioChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{portfolios.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Risk model">
          <Select value={cfg.model} onValueChange={(v) => setCfg({ ...cfg, model: v as AnalysisConfig["model"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="independent">Independent defaults</SelectItem>
              <SelectItem value="gaussian">Gaussian conditional independence</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Confidence level">
          <Select value={String(cfg.confidence)} onValueChange={(v) => setCfg({ ...cfg, confidence: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0.95">95%</SelectItem>
              <SelectItem value="0.99">99%</SelectItem>
              <SelectItem value="0.999">99.9%</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Monte Carlo samples">
          <Input type="number" min={1000} max={200000} step={1000} value={cfg.samples}
            onChange={(e) => setCfg({ ...cfg, samples: Number(e.target.value) })} />
        </Field>
        <Field label="Algorithm">
          <Select value={cfg.algorithm} onValueChange={(v) => setCfg({ ...cfg, algorithm: v as AnalysisConfig["algorithm"] })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="classical">Classical Monte Carlo</SelectItem>
              <SelectItem value="quantum">Quantum QAE (planned – Stage 3)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button size="lg" onClick={run} disabled={running} className="rounded-xl bg-brand-gradient shadow-lift">
          {running ? <Loader2 className="animate-spin" /> : <Play />} Run Analysis
        </Button>
        <span className="text-sm text-muted-foreground">
          Analytical EL: <b className="text-foreground">{money(portfolioEL(assets))}</b> on {assets.length} assets · exposure {compactMoney(totalExposure(assets))}
        </span>
      </div>

      {result && result.portfolioId === portfolioId && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_2fr]">
          <div className="grid grid-cols-2 gap-3 self-start">
            <Metric label="Simulated EL" value={money(result.expectedLoss)} />
            <Metric label={`VaR ${(result.confidence * 100).toFixed(1)}%`} value={money(result.var)} />
            <Metric label="Economic capital" value={money(result.ecr)} />
            <Metric label="Samples" value={result.samples.toLocaleString()} />
            <p className="col-span-2 text-xs text-muted-foreground">Classical Monte Carlo · {result.model === "gaussian" ? "Gaussian conditional independence" : "independent defaults"} · seed 42 · synthetic data.</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={result.histogram}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="loss" tickFormatter={(v) => compactMoney(v)} fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--color-muted-foreground)" />
                <Tooltip formatter={(v) => [v, "Scenarios"]} labelFormatter={(l) => `Loss ≈ ${money(Number(l))}`} />
                <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                <ReferenceLine x={result.histogram.reduce((b, h) => (Math.abs(h.loss - result.var) < Math.abs(b - result.var) ? h.loss : b), 0)} stroke="var(--color-primary-deep)" strokeDasharray="4 4" label={{ value: "VaR", fontSize: 11, fill: "var(--color-primary-deep)" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Panel>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-accent p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-semibold">{value}</div></div>;
}
