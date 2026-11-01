import { Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceArea, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AnalysisSummary } from "@/lib/risk/monte-carlo";
import { compactMoney, money } from "@/lib/format";

const axis = { fontSize: 11, stroke: "var(--color-muted-foreground)" };

export function LossHistogram({ a }: { a: AnalysisSummary }) {
  const last = a.histogram[a.histogram.length - 1];
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={a.histogram} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey="loss" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => compactMoney(v)} {...axis} />
          <YAxis {...axis} label={{ value: "Frequency", angle: -90, position: "insideLeft", fontSize: 11 }} />
          <Tooltip
            formatter={(v, n) => [Math.round(Number(v)).toLocaleString(), n === "count" ? "Scenarios" : "Smoothed"]}
            labelFormatter={(l) => `Loss ≈ ${money(Number(l))}`}
          />
          {last && <ReferenceArea x1={a.var} x2={last.to} fill="var(--color-destructive)" fillOpacity={0.08} />}
          <Bar dataKey="count" barSize={Math.max(2, 600 / a.histogram.length - 2)} radius={[3, 3, 0, 0]}
            fill="var(--color-primary)" shape={(p: any) => <rect x={p.x} y={p.y} width={p.width} height={p.height} rx={2}
              fill={p.payload.tail ? "var(--color-primary-deep)" : "var(--color-primary)"} />} />
          <Line dataKey="smooth" type="monotone" dot={false} stroke="var(--color-primary-deep)" strokeWidth={2} />
          <ReferenceLine x={a.var} stroke="var(--color-destructive)" strokeDasharray="5 4"
            label={{ value: `VaR ${(a.confidence * 100).toFixed(1)}%`, position: "top", fontSize: 11, fill: "var(--color-destructive)" }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LossCdf({ a }: { a: AnalysisSummary }) {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={a.cdf} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="loss" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(v) => compactMoney(v)} {...axis} />
          <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} {...axis} />
          <Tooltip formatter={(v) => [`${(Number(v) * 100).toFixed(2)}%`, "P(L ≤ x)"]} labelFormatter={(l) => `Loss ${money(Number(l))}`} />
          <Line dataKey="p" type="stepAfter" dot={false} stroke="var(--color-primary-deep)" strokeWidth={2} isAnimationActive={false} />
          <ReferenceLine y={a.confidence} stroke="var(--color-muted-foreground)" strokeDasharray="4 4"
            label={{ value: `α = ${(a.confidence * 100).toFixed(1)}%`, position: "insideBottomRight", fontSize: 11 }} />
          <ReferenceLine x={a.var} stroke="var(--color-destructive)" strokeDasharray="5 4"
            label={{ value: `VaR ${compactMoney(a.var)}`, position: "insideTopLeft", fontSize: 11, fill: "var(--color-destructive)" }} />
          <ReferenceDot x={a.var} y={a.cdfAtVar} r={5} fill="var(--color-destructive)" stroke="var(--color-card)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
