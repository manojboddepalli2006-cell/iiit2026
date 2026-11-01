import { forwardRef, useMemo } from "react";
import type { Gate, Register, Stage } from "@/lib/quantum/circuit";

const STAGE_FILL: Record<Stage, string> = {
  U: "var(--color-primary)", S: "var(--color-primary-deep)", C: "var(--color-warning)",
  "A†": "var(--color-muted-foreground)", S0: "var(--color-muted-foreground)", "Sχ": "var(--color-destructive)",
  H: "var(--color-success)", "QFT†": "var(--color-success)",
};
const STAGE_NAME: Partial<Record<Stage, string>> = { U: "U — Uncertainty loading", S: "S — Weighted sum", C: "C — Comparator", H: "QAE", "QFT†": "QFT†" };

const label = (g: Gate) => g.name === "ry" ? `RY` : g.name === "p" ? "P" : g.name.toUpperCase();

/** Renders the actual gate list as an SVG (columns packed by occupied wire span). */
export const CircuitDiagram = forwardRef<SVGSVGElement, { n: number; gates: Gate[]; regs: Register[]; maxGates?: number }>(
  ({ n, gates, regs, maxGates = 1500 }, ref) => {
    const shown = gates.slice(0, maxGates);
    const layout = useMemo(() => {
      const busy = new Array<number>(n).fill(0);
      const cols: number[] = [];
      let lastStage: Stage | null = null; let stageStart = 0;
      const bands: { stage: Stage; from: number; to: number }[] = [];
      let width = 0;
      for (const g of shown) {
        const qs = [g.target, ...g.controls];
        const lo = Math.min(...qs), hi = Math.max(...qs);
        let col = stageStart; for (let q = lo; q <= hi; q++) col = Math.max(col, busy[q]!);
        if (g.stage !== lastStage) { col = Math.max(col, width); if (lastStage) bands.push({ stage: lastStage, from: stageStart, to: col }); lastStage = g.stage; stageStart = col; }
        for (let q = lo; q <= hi; q++) busy[q] = col + 1;
        cols.push(col); width = Math.max(width, col + 1);
      }
      if (lastStage) bands.push({ stage: lastStage, from: stageStart, to: width });
      return { cols, width, bands };
    }, [shown, n]);

    const W = 30, H = 28, left = 120, top = 26;
    const svgW = left + layout.width * W + 20, svgH = top + n * H + 10;
    const y = (q: number) => top + (n - 1 - q) * H + H / 2; // most significant qubit on top
    const regOf = (q: number) => regs.find((r) => q >= r.start && q < r.start + r.size);
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} fontFamily="ui-sans-serif, system-ui" fontSize={10}>
        <rect width={svgW} height={svgH} fill="var(--color-card, #fff)" />
        {layout.bands.map((b, i) => (
          <g key={i}>
            <rect x={left + b.from * W} y={4} width={(b.to - b.from) * W} height={svgH - 8} fill={STAGE_FILL[b.stage]} opacity={0.07} />
            {STAGE_NAME[b.stage] && (b.to - b.from) * W > 110 && <text x={left + b.from * W + 4} y={16} fill="var(--color-foreground, #333)" fontWeight={600}>{STAGE_NAME[b.stage]}</text>}
          </g>
        ))}
        {Array.from({ length: n }, (_, q) => {
          const r = regOf(q);
          return (
            <g key={q}>
              <text x={8} y={y(q) + 3} fill="var(--color-muted-foreground, #666)">{r ? `${r.name}[${q - r.start}]` : `q${q}`}</text>
              <line x1={left - 10} x2={svgW - 10} y1={y(q)} y2={y(q)} stroke="var(--color-border, #ccc)" />
            </g>
          );
        })}
        {shown.map((g, i) => {
          const cx = left + layout.cols[i]! * W + W / 2;
          const qs = [g.target, ...g.controls];
          const fill = STAGE_FILL[g.stage];
          const isNot = g.name === "x" && g.controls.length > 0;
          return (
            <g key={i}>
              {g.controls.length > 0 && <line x1={cx} x2={cx} y1={y(Math.min(...qs))} y2={y(Math.max(...qs))} stroke={fill} />}
              {g.controls.map((c) => <circle key={c} cx={cx} cy={y(c)} r={3.5} fill={fill} />)}
              {isNot ? (
                <g><circle cx={cx} cy={y(g.target)} r={8} fill="none" stroke={fill} strokeWidth={1.5} />
                  <line x1={cx - 8} x2={cx + 8} y1={y(g.target)} y2={y(g.target)} stroke={fill} /><line x1={cx} x2={cx} y1={y(g.target) - 8} y2={y(g.target) + 8} stroke={fill} /></g>
              ) : (
                <g><rect x={cx - 11} y={y(g.target) - 10} width={22} height={20} rx={4} fill={fill} />
                  <text x={cx} y={y(g.target) + 3.5} textAnchor="middle" fill="#fff" fontWeight={600} fontSize={9}>{label(g)}</text>
                  {g.param !== undefined && <title>{`${g.name}(${g.param.toFixed(4)})`}</title>}</g>
              )}
            </g>
          );
        })}
      </svg>
    );
  },
);
CircuitDiagram.displayName = "CircuitDiagram";
