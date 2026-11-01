import { describe, expect, it } from "vitest";
import { assetEL, conditionalPD, portfolioEL, runMonteCarlo } from "./engine";
import { normCdf, normInv } from "./math";
import { parseAssetCsv, validateAsset } from "./validation";

const a = (o = {}) => ({ id: "1", asset_code: "A1", borrower_name: "X", exposure: 1_000_000, pd: 0.02, lgd: 0.45, rho: 0.2, status: "Active", ...o });

describe("expected loss", () => {
  it("EL_k = exposure × PD × LGD", () => expect(assetEL(a())).toBeCloseTo(9000));
  it("portfolio EL sums assets", () => expect(portfolioEL([a(), a({ exposure: 500_000 })])).toBeCloseTo(13500));
  it("Monte Carlo EL converges to analytical EL", () => {
    const assets = Array.from({ length: 20 }, (_, i) => a({ id: String(i), pd: 0.05 }));
    const r = runMonteCarlo(assets, { model: "independent", confidence: 0.99, samples: 50000 });
    expect(r.expectedLoss / portfolioEL(assets)).toBeGreaterThan(0.95);
    expect(r.expectedLoss / portfolioEL(assets)).toBeLessThan(1.05);
  });
});

describe("conditional PD", () => {
  it("rho = 0 returns unconditional PD", () => expect(conditionalPD(0.03, 0, 1.5)).toBe(0.03));
  it("boundaries", () => { expect(conditionalPD(0, 0.3, 0)).toBe(0); expect(conditionalPD(1, 0.3, 0)).toBe(1); });
  it("bad scenario (z negative) raises PD", () => expect(conditionalPD(0.02, 0.2, -2)).toBeGreaterThan(0.02));
  it("Phi and Phi^-1 are inverse", () => expect(normCdf(normInv(0.99))).toBeCloseTo(0.99, 5));
});

describe("validation", () => {
  it("rejects PD outside [0,1]", () => expect(validateAsset(a({ pd: 1.2 }))).toContain("PD must be between 0 and 1"));
  it("rejects LGD outside [0,1]", () => expect(validateAsset(a({ lgd: -0.1 }))).toContain("LGD must be between 0 and 1"));
  it("rejects rho outside [0,1]", () => expect(validateAsset(a({ rho: 2 }))).toContain("Correlation (rho) must be between 0 and 1"));
  it("rejects non-positive exposure", () => expect(validateAsset(a({ exposure: 0 }))).toContain("Exposure must be a positive number"));
  it("CSV rejects duplicate asset IDs", () => {
    const csv = "asset_id,borrower_name,exposure,pd,lgd,rho\nA1,X,100,0.1,0.5,0.1\nA1,Y,100,0.1,0.5,0.1";
    const r = parseAssetCsv(csv);
    expect(r[0]!.errors).toHaveLength(0);
    expect(r[1]!.errors[0]).toMatch(/already exists/);
  });
});
