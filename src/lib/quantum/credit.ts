// Quantum credit-risk oracle A = C·S·U (Egger, García Gutiérrez, Mestre, Woerner 2019).
import { Circuit, type Register } from "./circuit";
import { conditionalPD } from "@/lib/risk/engine";
import type { Asset } from "@/lib/risk/types";

export interface QAsset { name: string; lambda: number; lambdaRaw: number; pd: number; rho: number }
export interface QProblem {
  label: string;
  model: "independent" | "gaussian";
  assets: QAsset[];
  nZ: number;          // qubits for latent Z (Gaussian model only)
  zMax: number;        // truncation: Z ∈ [−zMax, zMax]
  unit: number;        // money per integer loss unit (λ_int = λ_raw / unit, rounded)
}

/** Paper Table I: two assets, λ = 1, 2; p = 0.15, 0.25; ρ = 0.1, 0.05; nZ = 2. */
export const PAPER_EXAMPLE: QProblem = {
  label: "Paper Table I (two assets)", model: "gaussian", nZ: 2, zMax: 2, unit: 1,
  assets: [
    { name: "Asset 1", lambda: 1, lambdaRaw: 1, pd: 0.15, rho: 0.1 },
    { name: "Asset 2", lambda: 2, lambdaRaw: 2, pd: 0.25, rho: 0.05 },
  ],
};

export function validateProblem(p: QProblem): string[] {
  const e: string[] = [];
  if (!p.assets.length) e.push("At least one asset is required");
  if (p.assets.length > 6) e.push("At most 6 assets (statevector cost grows as 2^qubits)");
  if (p.model === "gaussian" && !(p.nZ >= 1 && p.nZ <= 4)) e.push("nZ must be between 1 and 4");
  if (!(p.zMax > 0 && p.zMax <= 6)) e.push("Z truncation must be in (0, 6]");
  p.assets.forEach((a, i) => {
    if (!Number.isInteger(a.lambda) || a.lambda < 0) e.push(`Asset ${i + 1}: loss units must be a non-negative integer`);
    if (!(a.pd >= 0 && a.pd <= 1) || !Number.isFinite(a.pd)) e.push(`Asset ${i + 1}: PD must be in [0, 1]`);
    if (!(a.rho >= 0 && a.rho < 1)) e.push(`Asset ${i + 1}: ρ must be in [0, 1)`);
  });
  if (maxLoss(p) > 31) e.push("Total loss units must be ≤ 31 (sum register ≤ 5 qubits)");
  return e;
}

/** Scale the top-K portfolio assets (by λ = Exposure × LGD) to integer loss units with total ≤ maxUnits. */
export function problemFromPortfolio(assets: Asset[], k: number, maxUnits: number, model: QProblem["model"], nZ = 2): QProblem {
  const top = [...assets].sort((a, b) => b.exposure * b.lgd - a.exposure * a.lgd).slice(0, k);
  const total = top.reduce((s, a) => s + a.exposure * a.lgd, 0);
  const unit = total / maxUnits || 1;
  return {
    label: `Top ${top.length} assets by exposure × LGD`, model, nZ, zMax: 2, unit,
    assets: top.map((a) => ({ name: a.asset_code, lambdaRaw: a.exposure * a.lgd, lambda: Math.max(1, Math.round((a.exposure * a.lgd) / unit)), pd: a.pd, rho: Math.min(a.rho, 0.999) })),
  };
}

export const maxLoss = (p: QProblem) => p.assets.reduce((s, a) => s + a.lambda, 0);
export const sumBits = (p: QProblem) => Math.max(1, Math.ceil(Math.log2(maxLoss(p) + 1)));
export const expectedLossUnits = (p: QProblem) => p.assets.reduce((s, a) => s + a.lambda * a.pd, 0);

/** Discretised, truncated standard normal on 2^nZ equally spaced points. */
export function zGrid(nZ: number, zMax: number) {
  const m = 1 << nZ;
  const z = Array.from({ length: m }, (_, i) => (m === 1 ? 0 : -zMax + (2 * zMax * i) / (m - 1)));
  const w = z.map((v) => Math.exp(-v * v / 2));
  const s = w.reduce((a, b) => a + b, 0);
  return { z, p: w.map((v) => v / s) };
}

export const theta = (p: number) => 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, p))));

export interface OracleLayout { z: Register; x: Register; s: Register; obj: Register }

export function allocate(c: Circuit, p: QProblem): OracleLayout {
  return {
    z: c.addRegister("z", "Z (latent factor)", p.model === "gaussian" ? p.nZ : 0),
    x: c.addRegister("x", "X (defaults)", p.assets.length),
    s: c.addRegister("s", "S (loss sum)", sumBits(p)),
    obj: c.addRegister("obj", "Objective", 1),
  };
}

/** Amplitude-encode a probability vector on a register via a binary tree of (multi-)controlled RY. */
export function prepareDistribution(c: Circuit, r: Register, probs: number[]) {
  const n = r.size;
  for (let level = n - 1; level >= 0; level--) {
    const higher = Array.from({ length: n - 1 - level }, (_, i) => r.start + level + 1 + i);
    for (let prefix = 0; prefix < 1 << higher.length; prefix++) {
      let p0 = 0, p1 = 0;
      probs.forEach((pr, idx) => {
        if (idx >> (level + 1) !== prefix) return;
        if ((idx >> level) & 1) p1 += pr; else p0 += pr;
      });
      if (p0 + p1 <= 0) continue;
      const th = 2 * Math.acos(Math.sqrt(p0 / (p0 + p1)));
      if (Math.abs(th) < 1e-15) continue;
      if (!higher.length) c.ry(th, r.start + level);
      else c.onValue(higher, prefix, (ctl) => c.ry(th, r.start + level, ctl));
    }
  }
}

/** U: uncertainty loading. Independent: RY(θ_k). Gaussian: load Z, then RY(θ_k(z_i)) controlled on Z = i. */
export function buildU(c: Circuit, p: QProblem, L: OracleLayout) {
  c.stage = "U";
  if (p.model === "independent") { p.assets.forEach((a, k) => { if (a.pd > 0) c.ry(theta(a.pd), c.q(L.x, k)); }); return; }
  const g = zGrid(p.nZ, p.zMax);
  prepareDistribution(c, L.z, g.p);
  const zq = c.qubits(L.z);
  g.z.forEach((zi, i) => {
    c.onValue(zq, i, (ctl) => p.assets.forEach((a, k) => {
      const th = theta(conditionalPD(a.pd, a.rho, zi));
      if (th > 0) c.ry(th, c.q(L.x, k), ctl);
    }));
  });
}

/** Controlled addition of a classical constant to a register via MCX ripple increments (reversible, no ancilla). */
export function addConstant(c: Circuit, reg: number[], value: number, controls: number[]) {
  for (let j = 0; j < reg.length; j++) {
    if (!((value >> j) & 1)) continue;
    for (let i = reg.length - 1; i >= j; i--) c.x(reg[i]!, [...controls, ...reg.slice(j, i)]);
  }
}

/** S: |x⟩|0⟩ → |x⟩|Σ λ_k x_k⟩. */
export function buildS(c: Circuit, p: QProblem, L: OracleLayout) {
  c.stage = "S";
  const sq = c.qubits(L.s);
  p.assets.forEach((a, k) => addConstant(c, sq, a.lambda, [c.q(L.x, k)]));
}

/** C: flip objective iff L ≤ x (one MCX per admissible loss value; basis states are disjoint). */
export function buildC(c: Circuit, L: OracleLayout, threshold: number) {
  c.stage = "C";
  const sq = c.qubits(L.s), top = (1 << sq.length) - 1;
  const xmax = Math.min(Math.floor(threshold), top);
  if (xmax < 0) return;
  if (xmax === top) { c.x(L.obj.start); return; }
  for (let v = 0; v <= xmax; v++) c.onValue(sq, v, (ctl) => c.x(L.obj.start, ctl));
}

export function buildOracle(p: QProblem, threshold: number, withComparator = true) {
  const c = new Circuit();
  const L = allocate(c, p);
  buildU(c, p, L); buildS(c, p, L);
  if (withComparator) buildC(c, L, threshold);
  return { circuit: c, layout: L };
}

/** Exact classical enumeration of the same discretised model: P(L = l). */
export function exactPmf(p: QProblem): number[] {
  const pmf = new Array<number>(maxLoss(p) + 1).fill(0);
  const scen = p.model === "gaussian" ? zGrid(p.nZ, p.zMax) : { z: [0], p: [1] };
  scen.z.forEach((zi, i) => {
    const pk = p.assets.map((a) => (p.model === "gaussian" ? conditionalPD(a.pd, a.rho, zi) : a.pd));
    for (let mask = 0; mask < 1 << p.assets.length; mask++) {
      let pr = scen.p[i]!, l = 0;
      p.assets.forEach((a, k) => { if ((mask >> k) & 1) { pr *= pk[k]!; l += a.lambda; } else pr *= 1 - pk[k]!; });
      pmf[l]! += pr;
    }
  });
  return pmf;
}
export const exactCdf = (p: QProblem) => { let a = 0; return exactPmf(p).map((v) => (a += v)); };
export function exactVaR(p: QProblem, alpha: number) { const c = exactCdf(p); const i = c.findIndex((v) => v >= alpha - 1e-12); return i < 0 ? c.length - 1 : i; }
