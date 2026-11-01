// Exact statevector simulator for the gate IR (complex amplitudes as separate re/im arrays).
import type { Gate } from "./circuit";
import { mulberry32 } from "@/lib/risk/math";

export const MAX_QUBITS = 20;

export class StateVector {
  re: Float64Array; im: Float64Array;
  constructor(public n: number) {
    if (n > MAX_QUBITS) throw new Error(`Statevector limited to ${MAX_QUBITS} qubits (requested ${n}); cost grows as 2^n`);
    this.re = new Float64Array(1 << n); this.im = new Float64Array(1 << n);
    this.re[0] = 1;
  }
  static fromBasis(n: number, index: number) { const s = new StateVector(n); s.re[0] = 0; s.re[index] = 1; return s; }

  apply(g: Gate) {
    const N = this.re.length, t = 1 << g.target;
    let cmask = 0; for (const c of g.controls) cmask |= 1 << c;
    const { re, im } = this;
    const c = g.name === "ry" ? Math.cos(g.param! / 2) : 0, s = g.name === "ry" ? Math.sin(g.param! / 2) : 0;
    const pc = g.name === "p" ? Math.cos(g.param!) : 0, ps = g.name === "p" ? Math.sin(g.param!) : 0;
    const r2 = Math.SQRT1_2;
    const skip = cmask | t;
    for (let i = 0; i < N; i++) {
      if ((i & skip) !== cmask) continue;
      const j = i | t;
      const ar = re[i]!, ai = im[i]!, br = re[j]!, bi = im[j]!;
      switch (g.name) {
        case "x": re[i] = br; im[i] = bi; re[j] = ar; im[j] = ai; break;
        case "z": re[j] = -br; im[j] = -bi; break;
        case "h": re[i] = (ar + br) * r2; im[i] = (ai + bi) * r2; re[j] = (ar - br) * r2; im[j] = (ai - bi) * r2; break;
        case "ry": re[i] = c * ar - s * br; im[i] = c * ai - s * bi; re[j] = s * ar + c * br; im[j] = s * ai + c * bi; break;
        case "p": re[j] = pc * br - ps * bi; im[j] = pc * bi + ps * br; break;
      }
    }
  }
  run(gates: Gate[]) { for (const g of gates) this.apply(g); return this; }

  norm() { let s = 0; for (let i = 0; i < this.re.length; i++) s += this.re[i]! ** 2 + this.im[i]! ** 2; return s; }

  /** Marginal probability distribution of a contiguous register. */
  registerProbs(start: number, size: number): number[] {
    const out = new Array<number>(1 << size).fill(0), mask = (1 << size) - 1;
    for (let i = 0; i < this.re.length; i++) {
      const p = this.re[i]! ** 2 + this.im[i]! ** 2;
      if (p) out[(i >> start) & mask]! += p;
    }
    return out;
  }
  /** Probability that qubit q reads |1>. */
  qubitProb(q: number) { return this.registerProbs(q, 1)[1]!; }
}

/** Sample `shots` measurement outcomes from a probability vector (seeded, reproducible). */
export function sampleCounts(probs: number[], shots: number, seed: number): number[] {
  const rand = mulberry32(seed), counts = new Array<number>(probs.length).fill(0);
  const cum: number[] = []; let acc = 0; for (const p of probs) { acc += p; cum.push(acc); }
  for (let s = 0; s < shots; s++) {
    const u = rand() * acc; let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m]! >= u) hi = m; else lo = m + 1; }
    counts[lo]!++;
  }
  return counts;
}
