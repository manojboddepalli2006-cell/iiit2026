// Gate-level quantum circuit IR (little-endian: qubit q ↔ bit q of the basis index, as in Qiskit).
export type GateName = "x" | "h" | "z" | "ry" | "p";
export type Stage = "U" | "S" | "C" | "A†" | "S0" | "Sχ" | "H" | "QFT†";

export interface Gate { name: GateName; target: number; controls: number[]; param?: number; stage: Stage }
export interface Register { name: string; label: string; start: number; size: number }

export class Circuit {
  n = 0;
  regs: Register[] = [];
  gates: Gate[] = [];
  stage: Stage = "U";

  addRegister(name: string, label: string, size: number): Register {
    const r = { name, label, start: this.n, size };
    if (size > 0) { this.regs.push(r); this.n += size; }
    return r;
  }
  q(r: Register, i: number) { return r.start + i; }
  qubits(r: Register) { return Array.from({ length: r.size }, (_, i) => r.start + i); }

  private push(name: GateName, target: number, controls: number[] = [], param?: number) {
    if (controls.includes(target)) throw new Error("Control equals target");
    const g: Gate = { name, target, controls: [...controls], stage: this.stage };
    if (param !== undefined) g.param = param;
    this.gates.push(g);
  }
  x(t: number, c: number[] = []) { this.push("x", t, c); }
  h(t: number, c: number[] = []) { this.push("h", t, c); }
  z(t: number, c: number[] = []) { this.push("z", t, c); }
  ry(theta: number, t: number, c: number[] = []) { this.push("ry", t, c, theta); }
  p(phi: number, t: number, c: number[] = []) { this.push("p", t, c, phi); }

  /** Run `body` with `qubits` as controls that fire when they hold the integer `value` (X-conjugation for 0-bits). */
  onValue(qubits: number[], value: number, body: (controls: number[]) => void) {
    const flips = qubits.filter((_, i) => ((value >> i) & 1) === 0);
    flips.forEach((q) => this.x(q));
    body(qubits);
    flips.forEach((q) => this.x(q));
  }

  append(gates: Gate[], extraControls: number[] = [], stage?: Stage) {
    for (const g of gates) {
      const ng: Gate = { ...g, controls: [...g.controls, ...extraControls], stage: stage ?? g.stage };
      this.gates.push(ng);
    }
  }
}

/** Inverse gate sequence: reversed order, rotation/phase angles negated (X, H, Z are self-inverse). */
export function inverseGates(gates: Gate[]): Gate[] {
  return [...gates].reverse().map((g) => (g.param !== undefined ? { ...g, param: -g.param } : { ...g }));
}

export interface CircuitMetrics {
  qubits: number; gates: number; depth: number;
  cx: number; ccx: number; mcx: number; singleQubit: number; controlledRotations: number; controlledPhases: number;
  byStage: Partial<Record<Stage, number>>;
}

export function metrics(c: { n: number; gates: Gate[] }): CircuitMetrics {
  const level = new Array<number>(c.n).fill(0);
  let depth = 0, cx = 0, ccx = 0, mcx = 0, single = 0, crot = 0, cph = 0;
  const byStage: Partial<Record<Stage, number>> = {};
  for (const g of c.gates) {
    const qs = [g.target, ...g.controls];
    const l = Math.max(...qs.map((q) => level[q]!)) + 1;
    for (const q of qs) level[q] = l;
    if (l > depth) depth = l;
    const k = g.controls.length;
    if (k === 0) single++;
    else if (g.name === "x") { if (k === 1) cx++; else if (k === 2) ccx++; else mcx++; }
    else if (g.name === "ry") crot++;
    else cph++;
    byStage[g.stage] = (byStage[g.stage] ?? 0) + 1;
  }
  return { qubits: c.n, gates: c.gates.length, depth, cx, ccx, mcx, singleQubit: single, controlledRotations: crot, controlledPhases: cph, byStage };
}

/** OpenQASM 3 export using stdgates + ctrl(n) @ modifiers (importable by qiskit.qasm3). */
export function toQasm3(c: { n: number; gates: Gate[]; regs: Register[] }, measure?: Register): string {
  const lines = ["OPENQASM 3.0;", 'include "stdgates.inc";', `qubit[${c.n}] q;`];
  lines.push(`// registers: ${c.regs.map((r) => `${r.name}=q[${r.start}..${r.start + r.size - 1}]`).join(", ")}`);
  if (measure) lines.push(`bit[${measure.size}] c;`);
  for (const g of c.gates) {
    const op = g.param !== undefined ? `${g.name}(${g.param.toPrecision(15)})` : g.name;
    const k = g.controls.length;
    const mod = k === 0 ? "" : `ctrl(${k}) @ `;
    lines.push(`${mod}${op} ${[...g.controls, g.target].map((q) => `q[${q}]`).join(", ")};`);
  }
  if (measure) for (let i = 0; i < measure.size; i++) lines.push(`c[${i}] = measure q[${measure.start + i}];`);
  return lines.join("\n") + "\n";
}
