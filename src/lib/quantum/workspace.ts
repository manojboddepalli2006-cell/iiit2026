// Full quantum credit-risk job: loss distribution, QAE CDF, QAE-bisection VaR, ECR, convergence, resources.
import { metrics, toQasm3, type CircuitMetrics } from "./circuit";
import { buildOracle, exactCdf, exactVaR, expectedLossUnits, maxLoss, validateProblem, type QProblem } from "./credit";
import { buildQae, quantumLossDistribution, quantumVaR, runQae, type BisectionStep, type QaeConfig, type QaeResult } from "./qae";

export interface QuantumJob { problem: QProblem; alpha: number; cfg: QaeConfig }

export interface QuantumRunResult {
  job: QuantumJob;
  backend: "Q-CreditX statevector simulator (in-browser)";
  lossDistribution: { loss: number; prob: number; count: number; exact: number }[];
  cdf: { x: number; estimate: number; lo: number; hi: number; exact: number; statevector: number }[];
  var: number; cdfAtVar: number; ciAtVar: [number, number]; varUncertain: boolean;
  bisection: BisectionStep[]; qaeEvaluations: number;
  expectedLoss: number; ecr: number;
  exactVar: number; exactEcr: number;
  convergence: { m: number; estimate: number; epsilon: number; exact: number }[];
  oracle: CircuitMetrics; qae: CircuitMetrics; qaeAtVar: Omit<QaeResult, "outcomes"> & { outcomes: QaeResult["outcomes"] };
  qasm: string;
  totalMs: number;
}

export function runQuantumJob(job: QuantumJob, progress: (frac: number, msg: string) => void = () => {}): QuantumRunResult {
  const t0 = performance.now();
  const { problem: p, alpha, cfg } = job;
  const errs = validateProblem(p);
  if (errs.length) throw new Error(errs.join("; "));
  if (!(alpha > 0 && alpha < 1)) throw new Error("Confidence level must be in (0, 1)");
  if (!(cfg.shots >= 0 && cfg.shots <= 100_000)) throw new Error("Shots must be between 0 and 100,000");

  const exact = exactCdf(p);
  progress(0.02, "Loading uncertainty and summing losses (U·S)");
  const dist = quantumLossDistribution(p, cfg.shots, cfg.seed);

  const cache = new Map<number, QaeResult>();
  const xs = Array.from({ length: maxLoss(p) + 1 }, (_, i) => i);
  // Keep simulator cost bounded: every CDF point is one full QAE circuit (cost ∝ gates × 2^qubits).
  const budget = buildQae(p, 0, cfg.m).circuit.n >= 15 ? 6 : 16;
  const sampled = xs.length <= budget ? xs : Array.from(new Set(Array.from({ length: budget }, (_, i) => Math.round((i * (xs.length - 1)) / (budget - 1)))));
  sampled.forEach((x, i) => {
    progress(0.05 + 0.6 * (i / sampled.length), `QAE for CDF(${x})`);
    if (!cache.has(x)) cache.set(x, runQae(p, x, cfg));
  });
  progress(0.68, "Bisection search for VaR");
  const v = quantumVaR(p, alpha, cfg, cache);

  progress(0.8, "QAE convergence over evaluation qubits");
  const convergence = [];
  for (let m = Math.max(2, cfg.m - 3); m <= Math.max(2, cfg.m); m++) {
    const r = m === cfg.m ? cache.get(v.var)! : runQae(p, v.var, { ...cfg, m });
    convergence.push({ m, estimate: r.estimate, epsilon: r.epsilon, exact: exact[v.var]! });
  }

  progress(0.92, "Resource metrics and QASM export");
  const qaeCirc = buildQae(p, v.var, cfg.m);
  const atVar = { ...cache.get(v.var)!, metrics: metrics(qaeCirc.circuit) };
  const el = expectedLossUnits(p);
  const exVar = exactVaR(p, alpha);
  const result: QuantumRunResult = {
    job, backend: "Q-CreditX statevector simulator (in-browser)",
    lossDistribution: dist.map((d) => ({ ...d, exact: (exact[d.loss]! - (d.loss ? exact[d.loss - 1]! : 0)) })),
    cdf: [...cache.values()].sort((a, b) => a.threshold - b.threshold).map((r) => ({
      x: r.threshold, estimate: r.estimate, lo: r.ci[0], hi: r.ci[1], exact: exact[r.threshold]!, statevector: r.amplitudeStatevector,
    })),
    var: v.var, cdfAtVar: v.cdfAtVar, ciAtVar: v.ciAtVar, varUncertain: v.uncertain,
    bisection: v.steps, qaeEvaluations: cache.size + convergence.length - 1,
    expectedLoss: el, ecr: v.var - el, exactVar: exVar, exactEcr: exVar - el,
    convergence,
    oracle: metrics(buildOracle(p, v.var).circuit), qae: atVar.metrics!, qaeAtVar: atVar,
    qasm: toQasm3(qaeCirc.circuit, qaeCirc.evalReg),
    totalMs: performance.now() - t0,
  };
  progress(1, "Done");
  return result;
}
