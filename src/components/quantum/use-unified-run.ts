import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { classicalForProblem, compare, type ComparisonResult, type RunMode } from "@/lib/compare";
import { validateProblem } from "@/lib/quantum/credit";
import { saveComparison } from "@/services/comparisons";
import { useQuantumRunner, type QuantumSetup } from "./use-quantum";

export const STEPS = [
  "Validate portfolio", "Validate PD, LGD, exposure, ρ", "Read configuration", "Classical Monte Carlo",
  "Quantum engine (QAE)", "Expected Loss", "CDF and VaR", "Economic capital", "Compare results",
  "Save results", "Update charts and KPIs", "Report ready",
] as const;
export type StepState = "idle" | "running" | "done" | "skipped" | "error";
export const LATEST_COMPARISON_KEY = ["latest-comparison"] as const;

const tick = () => new Promise((r) => setTimeout(r, 0));

/** One central Run Analysis workflow: classical only, quantum only, or both on the same reduced problem. */
export function useUnifiedRun() {
  const qc = useQueryClient();
  const quantum = useQuantumRunner();
  const [steps, setSteps] = useState<StepState[]>(STEPS.map(() => "idle"));
  const [running, setRunning] = useState(false);

  const mark = (i: number, s: StepState) => setSteps((prev) => prev.map((v, j) => (j === i ? s : v)));

  const run = async (mode: RunMode, setup: QuantumSetup, opts: { samples: number; portfolioId: string | null }): Promise<ComparisonResult | null> => {
    setRunning(true); setSteps(STEPS.map(() => "idle"));
    let at = 0;
    try {
      const p = setup.problem;
      at = 0; mark(0, "running");
      if (!p.assets.length) throw new Error("Selected portfolio has no assets");
      mark(0, "done"); at = 1; mark(1, "running");
      const errs = validateProblem(p);
      if (errs.length) throw new Error(errs.join("; "));
      mark(1, "done"); at = 2; mark(2, "running");
      if (!(setup.alpha > 0 && setup.alpha < 1)) throw new Error("Confidence must be between 0 and 1");
      if (!(opts.samples >= 1000 && opts.samples <= 1_000_000)) throw new Error("Samples must be between 1,000 and 1,000,000");
      mark(2, "done");

      at = 3;
      let classical = null;
      if (mode !== "quantum") { mark(3, "running"); await tick(); classical = classicalForProblem(p, { alpha: setup.alpha, samples: opts.samples, seed: setup.seed }); mark(3, "done"); }
      else mark(3, "skipped");

      at = 4;
      let q = null;
      if (mode !== "classical") {
        mark(4, "running");
        q = await quantum.run({ problem: p, alpha: setup.alpha, cfg: { m: setup.m, shots: setup.shots, seed: setup.seed } });
        if (!q) throw new Error("Quantum simulation did not finish");
        mark(4, "done");
      } else mark(4, "skipped");

      for (at = 5; at <= 8; at++) mark(at, "done"); // computed from the finished engine outputs below
      const r = compare(p, setup.alpha, classical, q, mode);

      at = 9; mark(9, "running");
      let saved: ComparisonResult = r;
      try { saved = await saveComparison(r, opts.portfolioId); qc.invalidateQueries({ queryKey: ["comparisons"] }); mark(9, "done"); }
      catch (e) { mark(9, "error"); toast.error(`Result not saved: ${(e as Error).message}`); }
      qc.setQueryData(LATEST_COMPARISON_KEY, saved);
      mark(10, "done"); mark(11, "done");
      toast.success(mode === "comparative" ? "Comparative analysis complete" : mode === "quantum" ? "Quantum analysis complete" : "Classical analysis complete");
      return saved;
    } catch (e) {
      mark(at, "error");
      toast.error((e as Error).message);
      return null;
    } finally { setRunning(false); }
  };

  return { run, steps, running, quantumProgress: quantum.progress, cancel: quantum.cancel };
}
