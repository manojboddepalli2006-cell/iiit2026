import { describe, expect, it } from "vitest";
import { Circuit, inverseGates } from "./circuit";
import { StateVector } from "./statevector";
import { PAPER_EXAMPLE, addConstant, allocate, buildC, buildOracle, exactCdf, exactPmf, exactVaR, theta, validateProblem, zGrid, type QProblem } from "./credit";
import { buildQae, qaeErrorBound, quantumLossDistribution, quantumVaR, runQae } from "./qae";
import { runQuantumJob } from "./workspace";
import { conditionalPD } from "@/lib/risk/engine";

const indep = (assets: [number, number][]): QProblem => ({
  label: "t", model: "independent", nZ: 1, zMax: 2, unit: 1,
  assets: assets.map(([l, pd], i) => ({ name: `A${i}`, lambda: l, lambdaRaw: l, pd, rho: 0 })),
});

describe("A. single-asset default probability", () => {
  it("RY(2 asin √p)|0⟩ gives P(1) = p", () => {
    const { circuit, layout } = buildOracle(indep([[1, 0.15]]), 0, false);
    expect(new StateVector(circuit.n).run(circuit.gates).qubitProb(layout.x.start)).toBeCloseTo(0.15, 12);
  });
});

describe("B. normalisation", () => {
  it("full QAE state has norm 1", () => {
    const { circuit } = buildQae(PAPER_EXAMPLE, 1, 3);
    expect(new StateVector(circuit.n).run(circuit.gates).norm()).toBeCloseTo(1, 10);
  });
});

describe("C. two-asset weighted sum", () => {
  it("S maps |x1 x2⟩ to λ1x1 + λ2x2 = {0,1,2,3}", () => {
    for (let mask = 0; mask < 4; mask++) {
      const c = new Circuit(); const L = allocate(c, { ...PAPER_EXAMPLE, model: "independent" });
      const sv = StateVector.fromBasis(c.n, mask << L.x.start);
      addConstant(c, c.qubits(L.s), 1, [L.x.start]); addConstant(c, c.qubits(L.s), 2, [L.x.start + 1]);
      const probs = sv.run(c.gates).registerProbs(L.s.start, L.s.size);
      expect(probs.indexOf(1)).toBe((mask & 1) + 2 * ((mask >> 1) & 1));
    }
  });
});

describe("D/E/F. comparator", () => {
  const cmp = (loss: number, x: number) => {
    const c = new Circuit(); const L = allocate(c, { ...PAPER_EXAMPLE, model: "independent" });
    buildC(c, L, x);
    return new StateVector(c.n).run([]).n && StateVector.fromBasis(c.n, loss << L.s.start).run(c.gates).qubitProb(L.obj.start);
  };
  it("below threshold flips", () => expect(cmp(1, 2)).toBe(1));
  it("equal flips", () => { expect(cmp(2, 2)).toBe(1); expect(cmp(0, 0)).toBe(1); expect(cmp(3, 3)).toBe(1); });
  it("above does not flip", () => { expect(cmp(3, 2)).toBe(0); expect(cmp(1, 0)).toBe(0); });
});

describe("G. reversibility", () => {
  it("A†A|0⟩ = |0⟩", () => {
    const { circuit } = buildOracle(PAPER_EXAMPLE, 1);
    const sv = new StateVector(circuit.n).run(circuit.gates).run(inverseGates(circuit.gates));
    expect(sv.re[0]).toBeCloseTo(1, 10);
  });
});

describe("H. objective probability = exact enumeration", () => {
  it("P(obj=1) equals exact CDF for every x (paper example)", () => {
    const cdf = exactCdf(PAPER_EXAMPLE);
    for (let x = 0; x <= 3; x++) {
      const { circuit, layout } = buildOracle(PAPER_EXAMPLE, x);
      expect(new StateVector(circuit.n).run(circuit.gates).qubitProb(layout.obj.start)).toBeCloseTo(cdf[x]!, 10);
    }
  });
});

describe("I. QAE amplitude", () => {
  it("estimate lies within the QAE error bound of the true amplitude", () => {
    for (const m of [2, 3, 4, 5]) {
      const r = runQae(PAPER_EXAMPLE, 1, { m, shots: 0, seed: 1 });
      expect(Math.abs(r.estimate - r.amplitudeStatevector)).toBeLessThanOrEqual(qaeErrorBound(r.amplitudeStatevector, 1 << m) + 1e-9);
    }
  });
  it("exactly representable amplitude a = sin²(π/4) = 0.5 is recovered", () => {
    const r = runQae(indep([[1, 0.5]]), 0, { m: 3, shots: 0, seed: 1 });
    expect(r.estimate).toBeCloseTo(0.5, 10);
  });
});

describe("J/K. CDF and VaR vs exact two-asset model", () => {
  const cdf = exactCdf(PAPER_EXAMPLE);
  it("QAE CDF within error bound", () => {
    for (let x = 0; x <= 3; x++) {
      const r = runQae(PAPER_EXAMPLE, x, { m: 5, shots: 0, seed: 3 });
      expect(Math.abs(r.estimate - cdf[x]!)).toBeLessThanOrEqual(r.epsilon + 1e-9);
    }
  });
  it("bisection VaR(95%) matches exact VaR", () => {
    const v = quantumVaR(PAPER_EXAMPLE, 0.95, { m: 5, shots: 0, seed: 3 });
    expect(v.var).toBe(exactVaR(PAPER_EXAMPLE, 0.95));
  });
});

describe("L/M. Gaussian model", () => {
  it("loss register distribution equals exact discretised pmf", () => {
    const d = quantumLossDistribution(PAPER_EXAMPLE, 0, 1), pmf = exactPmf(PAPER_EXAMPLE);
    d.forEach((x, i) => expect(x.prob).toBeCloseTo(pmf[i]!, 10));
  });
  it("defaults are positively correlated (P(both) > p1·p2)", () => {
    const pmf = exactPmf(PAPER_EXAMPLE), g = zGrid(2, 2);
    const p1 = g.z.reduce((s, z, i) => s + g.p[i]! * conditionalPD(0.15, 0.1, z), 0);
    const p2 = g.z.reduce((s, z, i) => s + g.p[i]! * conditionalPD(0.25, 0.05, z), 0);
    expect(pmf[3]!).toBeGreaterThan(p1 * p2);
  });
  it("ρ = 0 reduces to the independent model", () => {
    const g0: QProblem = { ...PAPER_EXAMPLE, assets: PAPER_EXAMPLE.assets.map((a) => ({ ...a, rho: 0 })) };
    const ind: QProblem = { ...g0, model: "independent" };
    exactPmf(g0).forEach((v, i) => expect(v).toBeCloseTo(exactPmf(ind)[i]!, 12));
    quantumLossDistribution(g0, 0, 1).forEach((d, i) => expect(d.prob).toBeCloseTo(exactPmf(ind)[i]!, 10));
  });
});

describe("N. compile and execute", () => {
  it("full job runs and reports resources", () => {
    const r = runQuantumJob({ problem: PAPER_EXAMPLE, alpha: 0.95, cfg: { m: 4, shots: 1000, seed: 7 } });
    expect(r.qae.qubits).toBe(2 + 2 + 2 + 1 + 4);
    expect(r.qae.depth).toBeGreaterThan(0);
    expect(r.qasm).toContain("OPENQASM 3.0");
    expect(r.ecr).toBeCloseTo(r.var - r.expectedLoss, 12);
  });
});

describe("O. invalid input / stability", () => {
  it("rejects bad parameters", () => {
    expect(validateProblem({ ...PAPER_EXAMPLE, assets: [{ name: "a", lambda: 1, lambdaRaw: 1, pd: 1.5, rho: 0 }] }).length).toBeGreaterThan(0);
    expect(validateProblem({ ...PAPER_EXAMPLE, assets: [{ name: "a", lambda: 1.5, lambdaRaw: 1, pd: 0.1, rho: 1 }] }).length).toBe(2);
    expect(() => buildQae(PAPER_EXAMPLE, 1, 0)).toThrow();
  });
  it("θ is finite at PD 0 and 1", () => { expect(theta(0)).toBe(0); expect(theta(1)).toBeCloseTo(Math.PI, 12); });
});
