// Canonical Quantum Amplitude Estimation (Brassard et al.; paper Sec. III / App. B), executed on the statevector simulator.
import { Circuit, inverseGates, metrics, type CircuitMetrics, type Gate, type Register } from "./circuit";
import { allocate, buildC, buildS, buildU, maxLoss, sumBits, type OracleLayout, type QProblem } from "./credit";
import { StateVector, sampleCounts } from "./statevector";

export interface QaeConfig { m: number; shots: number; seed: number }

/** A|0⟩ gates for the problem with comparator threshold x. */
export function oracleGates(p: QProblem, threshold: number): { gates: Gate[]; layout: OracleLayout; n: number } {
  const a = new Circuit();
  const L = allocate(a, p);
  buildU(a, p, L); buildS(a, p, L); buildC(a, L, threshold);
  return { gates: a.gates, layout: L, n: a.n };
}

/** Builds  H^⊗m · Π_j c-Q^(2^j) · QFT†  with  Q = A·S0·A†·Sχ  (S0 includes the −1 so Q has eigenphases ±2θ). */
export function buildQae(p: QProblem, threshold: number, m: number) {
  if (!(Number.isInteger(m) && m >= 1 && m <= 7)) throw new Error("Evaluation qubits m must be an integer in [1, 7]");
  const c = new Circuit();
  const L = allocate(c, p);
  const evalReg = c.addRegister("eval", "Evaluation (QAE)", m);
  const A = oracleGates(p, threshold).gates;
  const Ainv = inverseGates(A).map((g) => ({ ...g, stage: "A†" as const }));
  const prob = Array.from({ length: L.obj.start + 1 }, (_, i) => i);
  const objQ = L.obj.start;

  // S0 = I − 2|0⟩⟨0| on all problem qubits
  const s0 = new Circuit(); s0.n = c.n; s0.stage = "S0";
  prob.forEach((q) => s0.x(q));
  const last = prob[prob.length - 1]!;
  if (prob.length === 1) s0.z(last); else { s0.h(last); s0.x(last, prob.slice(0, -1)); s0.h(last); }
  prob.forEach((q) => s0.x(q));

  c.append(A);
  c.stage = "H"; for (let j = 0; j < m; j++) c.h(evalReg.start + j);
  for (let j = 0; j < m; j++) {
    const ctl = evalReg.start + j;
    for (let r = 0; r < 1 << j; r++) {
      c.stage = "Sχ"; c.z(objQ, [ctl]);
      c.append(Ainv, [ctl]);
      c.append(s0.gates, [ctl]);
      c.stage = "S0"; c.z(ctl); // controlled global phase −1
      c.append(A, [ctl]);
    }
  }
  inverseQft(c, evalReg);
  return { circuit: c, layout: L, evalReg, oracleSize: A.length };
}

export function inverseQft(c: Circuit, r: Register) {
  c.stage = "QFT†";
  const q = c.qubits(r), m = q.length;
  for (let i = 0; i < Math.floor(m / 2); i++) { const a = q[i]!, b = q[m - 1 - i]!; c.x(b, [a]); c.x(a, [b]); c.x(b, [a]); }
  for (let j = 0; j < m; j++) {
    for (let k = 0; k < j; k++) c.p(-Math.PI / (1 << (j - k)), q[j]!, [q[k]!]);
    c.h(q[j]!);
  }
}

/** Conventional QAE error bound (success prob ≥ 8/π²): |a − ã| ≤ 2π√(a(1−a))/M + π²/M². */
export const qaeErrorBound = (a: number, M: number) => (2 * Math.PI * Math.sqrt(Math.max(0, a * (1 - a)))) / M + (Math.PI ** 2) / (M * M);

export interface QaeResult {
  threshold: number; m: number; shots: number;
  estimate: number;            // ã from the most frequent measured outcome (finite shots) or most likely outcome (shots = 0)
  estimateMostLikely: number;  // ã from the exact most-likely outcome of the measurement distribution
  amplitudeStatevector: number; // P(obj = 1) read from A|0⟩ statevector (verification only)
  epsilon: number; ci: [number, number];
  outcomes: { y: number; a: number; prob: number; count: number }[];
  gateCount: number; depth: number; qubits: number; groverCalls: number; oracleCalls: number; ms: number;
}

export function runQae(p: QProblem, threshold: number, cfg: QaeConfig, withMetrics = false): QaeResult & { metrics?: CircuitMetrics } {
  const t0 = performance.now();
  const { circuit, layout, evalReg } = buildQae(p, threshold, cfg.m);
  const sv = new StateVector(circuit.n).run(circuit.gates);
  const probs = sv.registerProbs(evalReg.start, evalReg.size);
  const M = 1 << cfg.m;
  const counts = cfg.shots > 0 ? sampleCounts(probs, cfg.shots, cfg.seed + Math.round(threshold * 7919)) : probs.map(() => 0);
  const aOf = (y: number) => Math.sin((Math.PI * y) / M) ** 2;
  const yML = probs.indexOf(Math.max(...probs));
  const yShot = cfg.shots > 0 ? counts.indexOf(Math.max(...counts)) : yML;
  const est = aOf(yShot);
  const eps = qaeErrorBound(est, M);
  const A = new StateVector(circuit.n).run(oracleGates(p, threshold).gates);
  const met = metrics(circuit);
  return {
    threshold, m: cfg.m, shots: cfg.shots,
    estimate: est, estimateMostLikely: aOf(yML), amplitudeStatevector: A.qubitProb(layout.obj.start),
    epsilon: eps, ci: [Math.max(0, est - eps), Math.min(1, est + eps)],
    outcomes: probs.map((pr, y) => ({ y, a: aOf(y), prob: pr, count: counts[y]! })),
    gateCount: met.gates, depth: met.depth, qubits: circuit.n, groverCalls: M - 1, oracleCalls: 2 * (M - 1) + 1,
    ms: performance.now() - t0,
    ...(withMetrics ? { metrics: met } : {}),
  };
}

export interface BisectionStep { iter: number; lo: number; hi: number; x: number; estimate: number; ci: [number, number]; decision: "≥ α" | "< α"; uncertain: boolean }

/** VaR_α = min{x : CDF(x) ≥ α}, classical bisection over integer loss levels with a QAE CDF estimate per midpoint. */
export function quantumVaR(p: QProblem, alpha: number, cfg: QaeConfig, cache = new Map<number, QaeResult>()) {
  const est = (x: number) => { if (!cache.has(x)) cache.set(x, runQae(p, x, cfg)); return cache.get(x)!; };
  let lo = 0, hi = maxLoss(p);
  const steps: BisectionStep[] = [];
  while (lo < hi) {
    const x = Math.floor((lo + hi) / 2);
    const r = est(x);
    const ok = r.estimate >= alpha;
    steps.push({ iter: steps.length + 1, lo, hi, x, estimate: r.estimate, ci: r.ci, decision: ok ? "≥ α" : "< α", uncertain: r.ci[0] < alpha && r.ci[1] >= alpha });
    if (ok) hi = x; else lo = x + 1;
  }
  const atVar = est(lo);
  return { var: lo, cdfAtVar: atVar.estimate, ciAtVar: atVar.ci, steps, evaluations: cache.size, uncertain: steps.some((s) => s.uncertain) };
}

/** Loss-register distribution measured from U·S|0⟩ (no comparator). */
export function quantumLossDistribution(p: QProblem, shots: number, seed: number) {
  const c = new Circuit(); const L = allocate(c, p); buildU(c, p, L); buildS(c, p, L);
  const probs = new StateVector(c.n).run(c.gates).registerProbs(L.s.start, sumBits(p));
  const counts = shots > 0 ? sampleCounts(probs, shots, seed) : probs.map(() => 0);
  return probs.slice(0, maxLoss(p) + 1).map((pr, l) => ({ loss: l, prob: pr, count: counts[l]! }));
}
