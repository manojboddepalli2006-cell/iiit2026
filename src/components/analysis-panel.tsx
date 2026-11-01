import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileDown, FileSpreadsheet, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel, StatusPill } from "@/components/app-shell";
import { LossCdf, LossHistogram } from "@/components/risk-charts";
import { portfolioEL, totalExposure } from "@/lib/risk/engine";
import { CONFIDENCE_OPTIONS, SAMPLE_OPTIONS, createSimulator, summarize } from "@/lib/risk/monte-carlo";
import { exportPdfReport, exportScenarioCsv } from "@/lib/risk/report";
import { saveAnalysis, type StoredAnalysis } from "@/services/analyses";
import type { AnalysisConfig, Asset, RiskModel } from "@/lib/risk/types";
import { compactMoney, money } from "@/lib/format";

export const ANALYSIS_KEY = ["analysis-result"] as const;
export type { StoredAnalysis };

type Cfg = { model: RiskModel; confidence: number; samples: number; seed: number; bins: number };
// Scenario losses of the latest run, kept in memory for CSV export (not sent to the database).
let lastScenarios: { id: string; losses: Float64Array; defaults: Uint32Array } | null = null;

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
  const [cfg, setCfg] = useState<Cfg>({ model: "gaussian", confidence: 0.99, samples: 10_000, seed: 42, bins: 50 });
  useEffect(() => {
    if (!initial) return;
    setCfg((c) => ({
      ...c,
      ...(initial.model ? { model: initial.model } : {}),
      ...(initial.confidence ? { confidence: initial.confidence } : {}),
      ...(initial.samples ? { samples: SAMPLE_OPTIONS.reduce((b, s) => (Math.abs(s - initial.samples!) < Math.abs(b - initial.samples!) ? s : b), 10_000 as number) } : {}),
    }));
  }, [initial]);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<StoredAnalysis | undefined>(() => qc.getQueryData<StoredAnalysis>(ANALYSIS_KEY));
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);

  const run = async () => {
    if (!assets.length) { toast.error("Portfolio has no assets to analyse"); return; }
    if (!Number.isInteger(cfg.seed) || cfg.seed < 0) { toast.error("Seed must be a non-negative integer"); return; }
    if (!(cfg.bins >= 5 && cfg.bins <= 200)) { toast.error("Bins must be between 5 and 200"); return; }
    setProgress(0);
    try {
      const t0 = performance.now();
      const sim = createSimulator(assets, cfg);
      const chunk = Math.max(500, Math.floor(2_000_000 / Math.max(1, assets.length)));
      while (!sim.step(chunk)) {
        setProgress(sim.done / sim.n);
        await new Promise((r) => setTimeout(r, 0));
        if (cancelled.current) return;
      }
      const summary = summarize(assets, sim.losses, sim.defaults, cfg);
      const r: StoredAnalysis = {
        ...summary, portfolioId,
        portfolioName: portfolios.find((p) => p.id === portfolioId)?.name ?? "Portfolio",
        executionMs: performance.now() - t0, createdAt: new Date().toISOString(),
      };
      try { r.id = await saveAnalysis(r); qc.invalidateQueries({ queryKey: ["analyses"] }); }
      catch (e) { toast.error(`Result not saved to history: ${(e as Error).message}`); }
      lastScenarios = { id: r.createdAt, losses: sim.losses, defaults: sim.defaults };
      qc.setQueryData(ANALYSIS_KEY, r);
      setResult(r);
      onComplete?.(r);
      toast.success(`Classical Monte Carlo complete · ${r.samples.toLocaleString()} scenarios`);
    } catch (e) {
      toast.error(`Analysis failed: ${(e as Error).message}`);
    } finally { setProgress(null); }
  };

  const running = progress !== null;
  const shown = result && result.portfolioId === portfolioId ? result : undefined;
  const hasScenarios = shown && lastScenarios?.id === shown.createdAt;

  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Risk analysis configuration</h2>
        <StatusPill tone="pending">Horizon: 1 year · Classical</StatusPill>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <Field label="Portfolio">
          <Select value={portfolioId} onValueChange={onPortfolioChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{portfolios.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Risk model">
          <Select value={cfg.model} onValueChange={(v) => setCfg({ ...cfg, model: v as RiskModel })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="independent">Independent default model</SelectItem>
              <SelectItem value="gaussian">Gaussian conditional independence</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Confidence level">
          <Select value={String(cfg.confidence)} onValueChange={(v) => setCfg({ ...cfg, confidence: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CONFIDENCE_OPTIONS.map((c) => <SelectItem key={c} value={String(c)}>{(c * 100).toFixed(1).replace(/\.0$/, "")}%</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Simulation samples">
          <Select value={String(cfg.samples)} onValueChange={(v) => setCfg({ ...cfg, samples: Number(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{SAMPLE_OPTIONS.map((s) => <SelectItem key={s} value={String(s)}>{s.toLocaleString()}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Random seed">
          <Input type="number" min={0} step={1} value={cfg.seed} onChange={(e) => setCfg({ ...cfg, seed: Math.floor(Number(e.target.value)) })} />
        </Field>
        <Field label="Histogram bins">
          <Input type="number" min={5} max={200} value={cfg.bins} onChange={(e) => setCfg({ ...cfg, bins: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button size="lg" onClick={run} disabled={running} className="rounded-xl bg-brand-gradient shadow-lift">
          {running ? <Loader2 className="animate-spin" /> : <Play />} Run Analysis
        </Button>
        {running ? (
          <div className="flex min-w-60 flex-1 items-center gap-3 text-sm text-muted-foreground">
            <Progress value={(progress ?? 0) * 100} className="h-2" /> {Math.round((progress ?? 0) * 100)}%
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">
            Analytical EL: <b className="text-foreground">{money(portfolioEL(assets))}</b> on {assets.length} assets · exposure {compactMoney(totalExposure(assets))}
          </span>
        )}
      </div>

      {shown && !running && <AnalysisResults a={shown} actions={
        <>
          <Button variant="outline" size="sm" className="rounded-xl" disabled={!hasScenarios}
            title={hasScenarios ? "" : "Scenario losses are only kept for the latest run in this session"}
            onClick={() => lastScenarios && exportScenarioCsv(lastScenarios.losses, lastScenarios.defaults)}>
            <FileSpreadsheet /> Scenario CSV
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => exportPdfReport(shown)}><FileDown /> PDF report</Button>
        </>
      } />}
    </Panel>
  );
}

export function AnalysisResults({ a, actions }: { a: StoredAnalysis; actions?: ReactNode }) {
  return (
    <div className="mt-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-primary-deep" />
          Completed {new Date(a.createdAt).toLocaleString()} · {a.samples.toLocaleString()} scenarios · seed {a.seed} · {(a.executionMs / 1000).toFixed(2)} s ·
          {a.model === "gaussian" ? " Gaussian conditional independence" : " independent defaults"} · synthetic demonstration result
        </p>
        <div className="flex gap-2">{actions}</div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Metric label="Total exposure" value={compactMoney(a.totalExposure)} />
        <Metric label="Assets" value={String(a.assetCount)} />
        <Metric label="Expected Loss (EL)" value={money(a.expectedLoss)} />
        <Metric label="Average simulated loss" value={money(a.meanLoss)} />
        <Metric label={`VaR ${(a.confidence * 100).toFixed(1)}%`} value={money(a.var)} />
        <Metric label="Economic capital (VaR − E[L])" value={money(a.ecr)} />
        <Metric label="Loss std dev" value={money(a.stdLoss)} />
        <Metric label="Min / max loss" value={`${compactMoney(a.minLoss)} / ${compactMoney(a.maxLoss)}`} />
        <Metric label="Avg defaults / scenario" value={a.avgDefaults.toFixed(2)} />
        <Metric label="Max defaults" value={String(a.maxDefaults)} />
        <Metric label="EL by integration" value={a.integratedEL != null ? money(a.integratedEL) : "n/a (independent)"} />
        <Metric label="CDF at VaR" value={`${(a.cdfAtVar * 100).toFixed(3)}%`} />
        <Metric label="VaR method" value="Empirical quantile" />
        <Metric label="Bisection VaR" value={money(a.varBisection)} />
        <Metric label="Bisection iterations" value={String(a.bisectionIterations)} />
        <Metric label="Confidence" value={`${(a.confidence * 100).toFixed(1)}%`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div><h3 className="mb-2 font-semibold">Portfolio Loss Distribution</h3><LossHistogram a={a} /></div>
        <div><h3 className="mb-2 font-semibold">Cumulative Distribution Function</h3><LossCdf a={a} /></div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-accent p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 truncate font-semibold">{value}</div></div>;
}
