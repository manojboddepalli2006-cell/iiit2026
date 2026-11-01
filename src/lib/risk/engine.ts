import { gaussian, mulberry32, normCdf, normInv } from "./math";
import type { Asset, RiskModel } from "./types";

export const assetEL = (a: Pick<Asset, "exposure" | "pd" | "lgd">) => a.exposure * a.pd * a.lgd;
export const lossGivenDefault = (a: Pick<Asset, "exposure" | "lgd">) => a.exposure * a.lgd;
export const portfolioEL = (assets: Asset[]) => assets.reduce((s, a) => s + assetEL(a), 0);
export const totalExposure = (assets: Asset[]) => assets.reduce((s, a) => s + a.exposure, 0);

/** p_k(z) = Phi((Phi^-1(p) - sqrt(rho) z) / sqrt(1 - rho)), with boundary handling. */
export function conditionalPD(p: number, rho: number, z: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  if (rho <= 0) return p;
  if (rho >= 1) {
    // Fully systematic: default iff Phi^-1(p) - z > 0 (limit of the formula).
    return normInv(p) - z > 0 ? 1 : 0;
  }
  return normCdf((normInv(p) - Math.sqrt(rho) * z) / Math.sqrt(1 - rho));
}

export interface MonteCarloResult {
  samples: number;
  expectedLoss: number;
  var: number;
  ecr: number;
  confidence: number;
  histogram: { loss: number; count: number }[];
}

export function runMonteCarlo(
  assets: Asset[],
  opts: { model: RiskModel; confidence: number; samples: number; seed?: number },
): MonteCarloResult {
  const rand = mulberry32(opts.seed ?? 42);
  const n = Math.max(1, Math.floor(opts.samples));
  const losses = new Float64Array(n);
  const lam = assets.map(lossGivenDefault);
  for (let s = 0; s < n; s++) {
    const z = opts.model === "gaussian" ? gaussian(rand) : 0;
    let L = 0;
    for (let k = 0; k < assets.length; k++) {
      const a = assets[k];
      const p = opts.model === "gaussian" ? conditionalPD(a.pd, a.rho, z) : a.pd;
      if (rand() < p) L += lam[k];
    }
    losses[s] = L;
  }
  let sum = 0;
  for (const l of losses) sum += l;
  const mean = sum / n;
  const sorted = Array.from(losses).sort((x, y) => x - y);
  const idx = Math.min(n - 1, Math.ceil(opts.confidence * n) - 1);
  const v = sorted[Math.max(0, idx)];
  const bins = 40;
  const max = sorted[n - 1] || 1;
  const width = max / bins;
  const hist = Array.from({ length: bins }, (_, i) => ({ loss: Math.round((i + 0.5) * width), count: 0 }));
  for (const l of sorted) hist[Math.min(bins - 1, Math.floor(l / width))].count++;
  return { samples: n, expectedLoss: mean, var: v, ecr: v - mean, confidence: opts.confidence, histogram: hist };
}
