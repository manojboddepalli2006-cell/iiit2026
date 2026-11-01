import { Bar, BarChart, CartesianGrid, ComposedChart, ErrorBar, Legend, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, Tooltip, XAxis, YAxis } from "recharts";
import type { ComparisonResult } from "@/lib/compare";

const axis = { fontSize: 11, stroke: "var(--color-muted-foreground)" };
const Box = ({ children }: { children: React.ReactElement }) => <div className="h-72"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;

/** Chart 1 — exact PMF (and classical MC histogram) with VaR, tail region and EL marker. */
export function DistributionChart({ r }: { r: ComparisonResult }) {
  const pmf = r.exact.cdf.map((c, x) => ({ x, exact: c - (x ? r.exact.cdf[x - 1]! : 0), mc: r.classical ? r.classical.cdf[x]!.p - (x ? r.classical.cdf[x - 1]!.p : 0) : undefined }));
  const v = r.quantum?.var ?? r.classical?.var ?? r.exact.var;
  return (
    <Box>
      <ComposedChart data={pmf} margin={{ top: 18, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="x" {...axis} label={{ value: "Loss (units)", position: "insideBottom", offset: -2, fontSize: 11 }} />
        <YAxis {...axis} tickFormatter={(t) => `${(t * 100).toFixed(0)}%`} />
        <Tooltip formatter={(val, n) => [`${(Number(val) * 100).toFixed(2)}%`, n === "exact" ? "Exact P(L = x)" : "Monte Carlo"]} labelFormatter={(l) => `Loss = ${l}`} />
        <ReferenceArea x1={v} x2={pmf.length - 1} fill="var(--color-destructive)" fillOpacity={0.08} />
        <Bar dataKey="exact" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
        {r.classical && <Line dataKey="mc" type="monotone" stroke="var(--color-primary-deep)" strokeWidth={2} dot />}
        <ReferenceLine x={v} stroke="var(--color-destructive)" strokeDasharray="5 4" label={{ value: `VaR ${(r.alpha * 100).toFixed(1)}%`, position: "top", fontSize: 11, fill: "var(--color-destructive)" }} />
        <ReferenceLine x={Math.round(r.expectedLoss)} stroke="var(--color-muted-foreground)" strokeDasharray="2 3" label={{ value: `E[L] ${r.expectedLoss.toFixed(2)}`, position: "insideTopLeft", fontSize: 11 }} />
      </ComposedChart>
    </Box>
  );
}

/** Chart 2 — exact CDF, MC empirical CDF, and only the QAE points actually estimated (with CIs). */
export function CdfCompareChart({ r }: { r: ComparisonResult }) {
  const qByX = new Map(r.quantum?.cdf.map((c) => [c.x, c]) ?? []);
  const data = r.exact.cdf.map((c, x) => {
    const q = qByX.get(x);
    return { x, exact: c, mc: r.classical?.cdf[x]?.p, qae: q?.estimate, err: q ? [q.estimate - q.lo, q.hi - q.estimate] : undefined };
  });
  return (
    <Box>
      <ComposedChart data={data} margin={{ top: 18, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="x" {...axis} />
        <YAxis domain={[0, 1]} {...axis} tickFormatter={(t) => `${Math.round(t * 100)}%`} />
        <Tooltip formatter={(val, n) => [Array.isArray(val) ? "" : `${(Number(val) * 100).toFixed(2)}%`, String(n)]} labelFormatter={(l) => `x = ${l}`} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <ReferenceLine y={r.alpha} stroke="var(--color-destructive)" strokeDasharray="5 4" label={{ value: `α = ${r.alpha}`, position: "insideBottomRight", fontSize: 11 }} />
        <Line name="Exact (discretised)" dataKey="exact" type="stepAfter" stroke="var(--color-muted-foreground)" dot={false} />
        {r.classical && <Line name="Monte Carlo" dataKey="mc" type="stepAfter" stroke="var(--color-primary-deep)" dot={false} strokeWidth={2} />}
        {r.quantum && <Scatter name="QAE estimate" dataKey="qae" fill="var(--color-destructive)"><ErrorBar dataKey="err" width={4} stroke="var(--color-destructive)" /></Scatter>}
        {r.quantum && <ReferenceLine x={r.quantum.var} stroke="var(--color-destructive)" />}
      </ComposedChart>
    </Box>
  );
}

/** Chart 3 — QAE convergence over evaluation qubits at the VaR threshold. */
export function ConvergenceChart({ r }: { r: ComparisonResult }) {
  if (!r.quantum) return <Empty />;
  const data = r.quantum.convergence.map((c) => ({ ...c, err: [c.epsilon, c.epsilon] }));
  return (
    <Box>
      <ComposedChart data={data} margin={{ top: 18, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="m" {...axis} label={{ value: "Evaluation qubits m", position: "insideBottom", offset: -2, fontSize: 11 }} />
        <YAxis {...axis} domain={[0, 1]} />
        <Tooltip formatter={(val, n) => [Array.isArray(val) ? "" : Number(val).toFixed(4), String(n)]} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line name="Reference amplitude (exact)" dataKey="exact" stroke="var(--color-muted-foreground)" strokeDasharray="4 3" dot={false} />
        <Line name="QAE estimate ± bound" dataKey="estimate" stroke="var(--color-primary-deep)" strokeWidth={2}><ErrorBar dataKey="err" width={4} stroke="var(--color-primary-deep)" /></Line>
        <Bar name="|error|" dataKey="error" fill="var(--color-primary)" barSize={18} />
      </ComposedChart>
    </Box>
  );
}

/** Chart 4 — logical resources. */
export function ResourceChart({ r }: { r: ComparisonResult }) {
  if (!r.quantum) return <Empty />;
  const q = r.quantum;
  const data = [
    { k: "Logical qubits", v: q.logical }, { k: "Evaluation", v: q.evalQubits }, { k: "Ancilla", v: q.ancilla }, { k: "Total qubits", v: q.qubits },
  ];
  return (
    <Box>
      <BarChart data={data} margin={{ top: 18, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="k" {...axis} /><YAxis allowDecimals={false} {...axis} />
        <Tooltip /><Bar dataKey="v" name="Qubits" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </Box>
  );
}

/** Chart 5 — VaR / ECR across the three references. */
export function VersusChart({ r }: { r: ComparisonResult }) {
  const data = [
    { k: "VaR", exact: r.exact.var, classical: r.classical?.var, quantum: r.quantum?.var },
    { k: "ECR", exact: r.exact.ecr, classical: r.classical?.ecr, quantum: r.quantum?.ecr },
  ];
  return (
    <Box>
      <BarChart data={data} margin={{ top: 18, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="k" {...axis} /><YAxis {...axis} label={{ value: "Loss units", angle: -90, position: "insideLeft", fontSize: 11 }} />
        <Tooltip formatter={(v) => Number(v).toFixed(3)} /><Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar name="Exact reference" dataKey="exact" fill="var(--color-muted-foreground)" radius={[4, 4, 0, 0]} />
        {r.classical && <Bar name="Monte Carlo" dataKey="classical" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />}
        {r.quantum && <Bar name="QAE (simulator)" dataKey="quantum" fill="var(--color-primary-deep)" radius={[4, 4, 0, 0]} />}
      </BarChart>
    </Box>
  );
}

function Empty() { return <div className="grid h-72 place-items-center text-sm text-muted-foreground">Run a quantum or comparative analysis to see this chart.</div>; }
