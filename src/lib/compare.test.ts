import { describe, expect, it } from "vitest";
import { PAPER_EXAMPLE } from "@/lib/quantum/credit";
import { runQuantumJob } from "@/lib/quantum/workspace";
import { classicalForProblem, compare, comparisonCsv, oracleCallsPerQae, relativeDiff } from "./compare";

describe("comparison metrics", () => {
  it("relative difference = |ref − est| / |ref| × 100", () => {
    expect(relativeDiff(4, 3)).toBeCloseTo(25);
  });
  it("relative difference handles a zero reference", () => {
    expect(relativeDiff(0, 0)).toBe(0);
    expect(relativeDiff(0, 2)).toBeNull();
  });
  it("canonical QAE with m=4 calls the oracle 31 times", () => {
    expect(oracleCallsPerQae(4)).toBe(31);
  });

  it("paper example: exact, Monte Carlo and QAE all compare on the same problem", () => {
    const q = runQuantumJob({ problem: PAPER_EXAMPLE, alpha: 0.95, cfg: { m: 5, shots: 0, seed: 1 } });
    const c = classicalForProblem(PAPER_EXAMPLE, { alpha: 0.95, samples: 50_000, seed: 3 });
    const r = compare(PAPER_EXAMPLE, 0.95, c, q, "comparative");
    expect(r.expectedLoss).toBeCloseTo(0.65, 10); // 1×0.15 + 2×0.25, computed classically
    expect(r.exact.var).toBe(2);
    expect(r.quantum!.var).toBe(r.exact.var);
    expect(r.quantum!.ecr).toBeCloseTo(1.35, 10);
    expect(r.metrics.statevectorErr!).toBeLessThan(1e-9);
    expect(r.metrics.varAbsDiff).toBe(Math.abs(r.classical!.var - r.quantum!.var));
    expect(r.metrics.cdfMaxErr!).toBeLessThan(0.2);
    expect(comparisonCsv(r)).toContain("var_units,2,");
  });
});
