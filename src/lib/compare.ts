// Classical vs quantum comparison on the SAME reduced problem (pure functions, no React/DB).
// Three references are kept distinct: exact enumeration (discretised Z, same as the circuit),
// classical Monte Carlo (continuous Gaussian Z) and the QAE estimate from the simulator.
import { exactCdf, expectedLossUnits, maxLoss, sumBits, type QProblem } from "@/lib/quantum/credit";
import type { QuantumRunResult } from "@/lib/quantum/workspace";
import { createSimulator, empiricalCdf, summarize, type AnalysisSummary } from "@/lib/risk/monte-carlo";
import type { Asset } from "@/lib/risk/types";

export type RunMode = "classical" | "quantum" | "comparative";

/** The reduced quantum problem as classical assets, in integer loss units (λ_k = exposure, LGD = 1). */
export function assetsFromProblem(p: QProblem): Asset[] {
  return p.assets.map((a, i) => ({
    id: `q${i}`, asset_code: a.name, borrower_name: a.name,
    exposure: a.lambda, pd: a.pd, lgd: 1, rho: a.rho, status: "Active",
  }));
}

/** Classical Monte Carlo on the reduced problem; losses are in loss units. */
export function classicalForProblem(p: QProblem, o: { alpha: number; samples: number; seed: number }) {
  const assets = assetsFromProblem(p);
  const t0 = performance.now();
  const sim = createSimulator(assets, { model: p.model, samples: o.samples, seed: o.seed });
  sim.step(sim.n);
  const summary = summarize(assets, sim.losses, sim.defaults, { model: p.model, seed: o.seed, confidence: o.alpha, bins: Math.max(5, Math.min(60, maxLoss(p) + 1)) });
  const sorted = Float64Array.from(sim.losses).sort();
  const cdfAt = (x: number) => empiricalCdf(sorted, x);
  return { summary, ms: performance.now() - t0, cdfAt };
}

/** |a − b| / |a| × 100, or null when the reference is zero (0 when both are zero). */
export function relativeDiff(ref: number, est: number): number | null {
  const abs = Math.abs(ref - est);
  if (ref === 0) return abs === 0 ? 0 : null;
  return (abs / Math.abs(ref)) * 100;
}

/** Oracle (A or A†) applications in one canonical QAE circuit with m evaluation qubits: A once, then 2^m − 1 Grover operators each holding A and A†. */
export const oracleCallsPerQae = (m: number) => 1 + 2 * (2 ** m - 1);

export interface ComparisonResult {
  mode: RunMode;
  problemLabel: string; unit: number; alpha: number; model: QProblem["model"];
  expectedLoss: number;                 // classical analytic EL (shared by both ECRs, per the paper)
  exact: { var: number; ecr: number; cdf: number[] };
  classical: { var: number; ecr: number; mean: number; samples: number; seed: number; ms: number; cdf: { x: number; p: number }[]; histogram: AnalysisSummary["histogram"] } | null;
  quantum: {
    var: number; ecr: number; cdfAtVar: number; ci: [number, number]; uncertain: boolean; ms: number;
    m: number; shots: number; epsilon: number; qaeEvaluations: number; oracleCalls: number;
    qubits: number; evalQubits: number; ancilla: number; logical: number; depth: number; gates: number; oracleQubits: number; oracleDepth: number; oracleGates: number;
    cdf: { x: number; estimate: number; lo: number; hi: number }[];
    convergence: { m: number; estimate: number; exact: number; error: number; epsilon: number }[];
  } | null;
  metrics: {
    varAbsDiff: number | null; varRelDiff: number | null; ecrAbsDiff: number | null;
    quantumVarVsExact: number | null; classicalVarVsExact: number | null;
    cdfMaxErr: number | null; cdfMeanErr: number | null; mcCdfMaxErr: number | null;
    amplitudeErr: number | null; statevectorErr: number | null;
  };
  createdAt: string;
}

export function compare(
  p: QProblem, alpha: number,
  classical: ReturnType<typeof classicalForProblem> | null,
  q: QuantumRunResult | null,
  mode: RunMode,
  createdAt = new Date().toISOString(),
): ComparisonResult {
  const el = expectedLossUnits(p);
  const ex = exactCdf(p);
  let exVar = ex.findIndex((c) => c >= alpha - 1e-12);
  if (exVar < 0) exVar = ex.length - 1;
  const c = classical ? {
    var: classical.summary.var, ecr: classical.summary.var - el, mean: classical.summary.meanLoss,
    samples: classical.summary.samples, seed: classical.summary.seed, ms: classical.ms,
    cdf: ex.map((_, x) => ({ x, p: classical.cdfAt(x) })), histogram: classical.summary.histogram,
  } : null;
  const nonEval = p.model === "gaussian" ? p.nZ + p.assets.length + sumBits(p) + 1 : p.assets.length + sumBits(p) + 1;
  const qq = q ? {
    var: q.var, ecr: q.var - el, cdfAtVar: q.cdfAtVar, ci: q.ciAtVar, uncertain: q.varUncertain, ms: q.totalMs,
    m: q.job.cfg.m, shots: q.job.cfg.shots, epsilon: q.qaeAtVar.epsilon, qaeEvaluations: q.qaeEvaluations,
    oracleCalls: q.qaeEvaluations * oracleCallsPerQae(q.job.cfg.m),
    qubits: q.qae.qubits, evalQubits: q.job.cfg.m, logical: nonEval,
    ancilla: Math.max(0, q.oracle.qubits - nonEval),
    depth: q.qae.depth, gates: q.qae.gates, oracleQubits: q.oracle.qubits, oracleDepth: q.oracle.depth, oracleGates: q.oracle.gates,
    cdf: q.cdf.map((r) => ({ x: r.x, estimate: r.estimate, lo: r.lo, hi: r.hi })),
    convergence: q.convergence.map((r) => ({ m: r.m, estimate: r.estimate, exact: r.exact, error: Math.abs(r.estimate - r.exact), epsilon: r.epsilon })),
  } : null;
  const errs = q ? q.cdf.map((r) => Math.abs(r.estimate - (ex[r.x] ?? 1))) : [];
  const mcErrs = c ? c.cdf.map((pt) => Math.abs(pt.p - ex[pt.x]!)) : [];
  return {
    mode, problemLabel: p.label, unit: p.unit, alpha, model: p.model,
    expectedLoss: el,
    exact: { var: exVar, ecr: exVar - el, cdf: ex },
    classical: c, quantum: qq,
    metrics: {
      varAbsDiff: c && qq ? Math.abs(c.var - qq.var) : null,
      varRelDiff: c && qq ? relativeDiff(c.var, qq.var) : null,
      ecrAbsDiff: c && qq ? Math.abs(c.ecr - qq.ecr) : null,
      quantumVarVsExact: qq ? Math.abs(qq.var - exVar) : null,
      classicalVarVsExact: c ? Math.abs(c.var - exVar) : null,
      cdfMaxErr: errs.length ? Math.max(...errs) : null,
      cdfMeanErr: errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : null,
      mcCdfMaxErr: mcErrs.length ? Math.max(...mcErrs) : null,
      amplitudeErr: q ? Math.abs(q.qaeAtVar.estimate - (ex[q.var] ?? 1)) : null,
      statevectorErr: q ? Math.abs(q.qaeAtVar.amplitudeStatevector - (ex[q.var] ?? 1)) : null,
    },
    createdAt,
  };
}

export function comparisonCsv(r: ComparisonResult): string {
  const f = (v: number | null | undefined, d = 6) => (v == null ? "" : Number(v.toFixed(d)).toString());
  const rows: [string, string, string, string][] = [
    ["metric", "exact_reference", "classical_monte_carlo", "quantum_qae"],
    ["expected_loss_units", f(r.expectedLoss), f(r.expectedLoss), f(r.expectedLoss)],
    ["var_units", f(r.exact.var), f(r.classical?.var), f(r.quantum?.var)],
    ["ecr_units", f(r.exact.ecr), f(r.classical?.ecr), f(r.quantum?.ecr)],
    ["var_money", f(r.exact.var * r.unit, 2), f(r.classical ? r.classical.var * r.unit : null, 2), f(r.quantum ? r.quantum.var * r.unit : null, 2)],
    ["cdf_at_quantum_var", f(r.quantum ? r.exact.cdf[r.quantum.var] : null), f(r.quantum && r.classical ? r.classical.cdf[r.quantum.var]?.p : null), f(r.quantum?.cdfAtVar)],
    ["execution_ms", "", f(r.classical?.ms, 1), f(r.quantum?.ms, 1)],
    ["var_abs_diff_classical_vs_quantum", "", "", f(r.metrics.varAbsDiff)],
    ["var_rel_diff_pct", "", "", f(r.metrics.varRelDiff, 3)],
    ["ecr_abs_diff", "", "", f(r.metrics.ecrAbsDiff)],
    ["cdf_max_abs_error_vs_exact", "", f(r.metrics.mcCdfMaxErr), f(r.metrics.cdfMaxErr)],
    ["amplitude_error_at_var", "", "", f(r.metrics.amplitudeErr)],
    ["qubits", "", "", f(r.quantum?.qubits, 0)],
    ["eval_qubits", "", "", f(r.quantum?.evalQubits, 0)],
    ["circuit_depth", "", "", f(r.quantum?.depth, 0)],
    ["gate_count", "", "", f(r.quantum?.gates, 0)],
    ["oracle_calls", "", "", f(r.quantum?.oracleCalls, 0)],
    ["samples", "", f(r.classical?.samples, 0), ""],
  ];
  return [`# Q-CreditX comparison · ${r.problemLabel} · alpha=${r.alpha} · unit=${r.unit} · ${r.createdAt}`, ...rows.map((x) => x.join(","))].join("\n") + "\n";
}
