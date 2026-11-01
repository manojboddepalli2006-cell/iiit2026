// Stage 2 — classical Monte Carlo reference engine (Egger et al., 2019).
// Pure functions: no React, no database.
import { gaussian, mulberry32, normCdf } from "./math";
import { conditionalPD, lossGivenDefault, portfolioEL, totalExposure } from "./engine";
import type { Asset, RiskModel } from "./types";

export const SAMPLE_OPTIONS = [1_000, 10_000, 50_000, 100_000, 500_000, 1_000_000] as const;
export const CONFIDENCE_OPTIONS = [0.95, 0.99, 0.999] as const;

export interface SimOptions { model: RiskModel; samples: number; seed: number }

/** Incremental simulator: identical results whatever chunk sizes are used (one RNG stream). */
export function createSimulator(assets: Asset[], opts: SimOptions) {
  const n = Math.max(1, Math.floor(opts.samples));
  const rand = mulberry32(opts.seed);
  const lam = Float64Array.from(assets.map(lossGivenDefault));
  const pd = Float64Array.from(assets.map((a) => Math.min(1, Math.max(0, a.pd))));
  const rho = Float64Array.from(assets.map((a) => Math.min(0.999999, Math.max(0, a.rho))));
  const losses = new Float64Array(n);
  const defaults = new Uint32Array(n);
  const condP = new Float64Array(assets.length);
  let done = 0;
  return {
    n, losses, defaults,
    get done() { return done; },
    /** Simulate up to `count` more scenarios; returns true when finished. */
    step(count: number): boolean {
      const end = Math.min(n, done + count);
      for (let s = done; s < end; s++) {
        if (opts.model === "gaussian") {
          const z = gaussian(rand); // one shared systematic factor per scenario
          for (let k = 0; k < pd.length; k++) condP[k] = conditionalPD(pd[k]!, rho[k]!, z);
        } else condP.set(pd);
        let L = 0, d = 0;
        for (let k = 0; k < pd.length; k++) if (rand() < condP[k]!) { L += lam[k]!; d++; }
        losses[s] = L; defaults[s] = d;
      }
      done = end;
      return done >= n;
    },
  };
}

export function simulate(assets: Asset[], opts: SimOptions) {
  const sim = createSimulator(assets, opts);
  sim.step(sim.n);
  return sim;
}

/** Empirical CDF on sorted losses: P(L <= x). */
export function empiricalCdf(sorted: Float64Array, x: number): number {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m]! <= x) lo = m + 1; else hi = m; }
  return lo / sorted.length;
}

/** VaR_α = inf{x : P(L ≤ x) ≥ α} — empirical quantile, sorted[ceil(αn) − 1]. */
export function empiricalVaR(sorted: Float64Array, alpha: number): number {
  const n = sorted.length;
  const idx = Math.min(n - 1, Math.max(0, Math.ceil(alpha * n - 1e-9) - 1));
  return sorted[idx]!;
}

/** Bisection search on the empirical CDF (paper methodology). Returns smallest x with CDF(x) ≥ α within `precision`. */
export function bisectionVaR(sorted: Float64Array, alpha: number, precision = 1) {
  let lo = sorted[0]!, hi = sorted[sorted.length - 1]!;
  let iterations = 0;
  if (empiricalCdf(sorted, lo) >= alpha) return { var: lo, iterations, cdf: empiricalCdf(sorted, lo) };
  while (hi - lo > precision && iterations < 200) {
    const mid = (lo + hi) / 2;
    if (empiricalCdf(sorted, mid) >= alpha) hi = mid; else lo = mid;
    iterations++;
  }
  return { var: hi, iterations, cdf: empiricalCdf(sorted, hi) };
}

/** EL for the Gaussian model via trapezoidal integration of p_k(z)·φ(z) over z ∈ [−8, 8]. */
export function integratedEL(assets: Asset[], steps = 2000): number {
  const a = -8, b = 8, h = (b - a) / steps;
  let total = 0;
  for (const asset of assets) {
    let s = 0;
    for (let i = 0; i <= steps; i++) {
      const z = a + i * h;
      const w = i === 0 || i === steps ? 0.5 : 1;
      s += w * conditionalPD(asset.pd, asset.rho, z) * Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
    }
    total += lossGivenDefault(asset) * s * h;
  }
  return total;
}

export interface HistogramBin { loss: number; from: number; to: number; count: number; smooth: number; tail: boolean }
export interface CdfPoint { loss: number; p: number }

export interface AnalysisSummary {
  model: RiskModel; samples: number; seed: number; confidence: number; bins: number;
  assetCount: number; totalExposure: number;
  expectedLoss: number; integratedEL: number | null; meanLoss: number; stdLoss: number;
  minLoss: number; maxLoss: number; avgDefaults: number; maxDefaults: number;
  var: number; varBisection: number; bisectionIterations: number; cdfAtVar: number; ecr: number;
  histogram: HistogramBin[]; cdf: CdfPoint[];
}

export function summarize(
  assets: Asset[], losses: Float64Array, defaults: Uint32Array,
  o: { model: RiskModel; seed: number; confidence: number; bins: number },
): AnalysisSummary {
  const n = losses.length;
  const sorted = Float64Array.from(losses).sort();
  let sum = 0, sq = 0, dsum = 0, dmax = 0;
  for (let i = 0; i < n; i++) { sum += losses[i]!; sq += losses[i]! * losses[i]!; dsum += defaults[i]!; if (defaults[i]! > dmax) dmax = defaults[i]!; }
  const mean = sum / n;
  const std = Math.sqrt(Math.max(0, sq / n - mean * mean));
  const v = empiricalVaR(sorted, o.confidence);
  const bis = bisectionVaR(sorted, o.confidence, Math.max(1, (sorted[n - 1]! - sorted[0]!) * 1e-6));
  const el = portfolioEL(assets);

  // Histogram + gaussian-kernel smoothed overlay
  const bins = Math.max(5, Math.min(200, Math.floor(o.bins)));
  const min = sorted[0]!, max = sorted[n - 1]!;
  const width = (max - min) / bins || 1;
  const counts = new Array<number>(bins).fill(0);
  for (let i = 0; i < n; i++) counts[Math.min(bins - 1, Math.floor((sorted[i]! - min) / width))]!++;
  const bw = Math.max(1, bins / 30);
  const histogram: HistogramBin[] = counts.map((c, i) => {
    let s = 0, w = 0;
    for (let j = 0; j < bins; j++) { const k = Math.exp(-((i - j) ** 2) / (2 * bw * bw)); s += k * counts[j]!; w += k; }
    const from = min + i * width;
    return { loss: from + width / 2, from, to: from + width, count: c, smooth: s / w, tail: from + width > v };
  });

  // Down-sampled empirical CDF (≤ 300 points)
  const step = Math.max(1, Math.floor(n / 300));
  const cdf: CdfPoint[] = [];
  for (let i = 0; i < n; i += step) cdf.push({ loss: sorted[i]!, p: (i + 1) / n });
  cdf.push({ loss: sorted[n - 1]!, p: 1 });

  return {
    model: o.model, samples: n, seed: o.seed, confidence: o.confidence, bins,
    assetCount: assets.length, totalExposure: totalExposure(assets),
    expectedLoss: el, integratedEL: o.model === "gaussian" ? integratedEL(assets) : null,
    meanLoss: mean, stdLoss: std, minLoss: min, maxLoss: max,
    avgDefaults: dsum / n, maxDefaults: dmax,
    var: v, varBisection: bis.var, bisectionIterations: bis.iterations, cdfAtVar: empiricalCdf(sorted, v),
    ecr: v - mean,
    histogram, cdf,
  };
}

export { normCdf };
