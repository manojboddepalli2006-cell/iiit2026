import { describe, expect, it } from "vitest";
import { assetEL, conditionalPD, portfolioEL } from "./engine";
import { bisectionVaR, empiricalCdf, empiricalVaR, integratedEL, simulate, summarize } from "./monte-carlo";

const a = (o = {}) => ({ id: "1", asset_code: "A1", borrower_name: "X", exposure: 100_000, pd: 0.1, lgd: 0.5, rho: 0.2, status: "Active", ...o });
const run = (assets: ReturnType<typeof a>[], model: "independent" | "gaussian", samples = 20_000, seed = 7) => {
  const s = simulate(assets, { model, samples, seed });
  return { sim: s, sum: summarize(assets, s.losses, s.defaults, { model, seed, confidence: 0.99, bins: 40 }) };
};
const book = Array.from({ length: 25 }, (_, i) => a({ id: String(i), asset_code: `A${i}`, exposure: 50_000 + i * 10_000, pd: 0.01 + i * 0.002, rho: 0.1 + i * 0.01 }));

describe("A. single asset", () => {
  it("EL = 100,000 × 0.10 × 0.50 = 5,000", () => expect(assetEL(a())).toBe(5000));
  it("simulated mean ≈ 5,000", () => expect(run([a()], "independent", 100_000).sum.meanLoss).toBeGreaterThan(4800));
});

describe("B/C. boundary PDs", () => {
  it("PD 0 → all losses zero", () => {
    for (const m of ["independent", "gaussian"] as const) {
      const { sim, sum } = run([a({ pd: 0 })], m, 5000);
      expect(sum.expectedLoss).toBe(0);
      expect(sim.losses.every((l) => l === 0)).toBe(true);
    }
  });
  it("PD 1 → loss = exposure × LGD in every scenario", () => {
    for (const m of ["independent", "gaussian"] as const)
      expect(run([a({ pd: 1 })], m, 5000).sim.losses.every((l) => l === 50_000)).toBe(true);
  });
});

describe("D. zero correlation", () => {
  it("conditional PD equals PD for any z", () => { for (const z of [-3, 0, 2.5]) expect(conditionalPD(0.07, 0, z)).toBe(0.07); });
  it("integrated EL equals analytical EL", () => expect(integratedEL(book) / portfolioEL(book)).toBeCloseTo(1, 4));
});

describe("E/F. VaR and ECR", () => {
  const { sim, sum } = run(book, "gaussian", 50_000);
  const sorted = Float64Array.from(sim.losses).sort();
  it("VaR is a non-negative loss with CDF(VaR) ≥ α", () => {
    expect(sum.var).toBeGreaterThanOrEqual(0);
    expect(empiricalCdf(sorted, sum.var)).toBeGreaterThanOrEqual(0.99);
  });
  it("bisection agrees with empirical quantile within precision", () => {
    const b = bisectionVaR(sorted, 0.99, 1);
    expect(b.cdf).toBeGreaterThanOrEqual(0.99);
    expect(Math.abs(b.var - empiricalVaR(sorted, 0.99))).toBeLessThanOrEqual(1);
  });
  it("ECR = VaR − E[L]", () => expect(sum.ecr).toBeCloseTo(sum.var - sum.meanLoss, 6));
  it("simulated mean within 3% of analytical EL", () => expect(Math.abs(sum.meanLoss / sum.expectedLoss - 1)).toBeLessThan(0.03));
});

describe("G. reproducibility", () => {
  it("same seed → identical losses; different seed differs", () => {
    const x = run(book, "gaussian", 3000, 11).sim.losses, y = run(book, "gaussian", 3000, 11).sim.losses;
    expect(Array.from(x)).toEqual(Array.from(y));
    expect(Array.from(run(book, "gaussian", 3000, 12).sim.losses)).not.toEqual(Array.from(x));
  });
});

describe("H. probabilities in [0,1]", () => {
  it("conditional PDs stay valid and finite", () => {
    for (const p of [1e-12, 0.01, 0.5, 0.999999]) for (const r of [0, 0.3, 0.99]) for (const z of [-8, 0, 8]) {
      const v = conditionalPD(p, r, z);
      expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
    }
  });
});
