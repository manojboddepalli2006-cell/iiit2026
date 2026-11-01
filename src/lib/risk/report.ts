// Browser-only export helpers (CSV of scenario losses, PDF summary).
import type { StoredAnalysis } from "@/services/analyses";
import { money } from "@/lib/format";

const modelName = (m: string) => (m === "gaussian" ? "Gaussian conditional independence" : "Independent Bernoulli defaults");

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportScenarioCsv(losses: Float64Array, defaults: Uint32Array, name = "scenario-losses.csv") {
  const parts: string[] = ["scenario,defaults,portfolio_loss\n"];
  for (let i = 0; i < losses.length; i++) parts.push(`${i + 1},${defaults[i]},${losses[i]!.toFixed(2)}\n`);
  download(new Blob(parts, { type: "text/csv" }), name);
}

export async function exportPdfReport(a: StoredAnalysis) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 50;
  const line = (t: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
    for (const l of doc.splitTextToSize(t, W - 80) as string[]) { doc.text(l, 40, y); y += size + 5; }
  };
  line("Q-CreditX — Classical Credit Risk Report", 16, true);
  line(`Generated ${new Date(a.createdAt).toLocaleString()} · Synthetic demonstration data · Classical Monte Carlo (not quantum)`, 9);
  y += 6;
  line("Portfolio summary", 12, true);
  line(`Portfolio: ${a.portfolioName}   Assets: ${a.assetCount}   Total exposure: ${money(a.totalExposure)}`);
  line("Model assumptions", 12, true);
  line(`${modelName(a.model)}. Loss L = Σ λk·Xk with λk = Exposure × LGD. ${a.model === "gaussian" ? "One shared systematic factor Z ~ N(0,1) per scenario; pk(z) = Φ((Φ⁻¹(PDk) − √ρk·z)/√(1−ρk))." : "Defaults are independent Bernoulli(PDk)."}`);
  line("Simulation parameters", 12, true);
  line(`Samples: ${a.samples.toLocaleString()}   Seed: ${a.seed}   Confidence: ${(a.confidence * 100).toFixed(1)}%   Bins: ${a.bins}   Runtime: ${(a.executionMs / 1000).toFixed(2)} s`);
  line("Results", 12, true);
  line(`Expected Loss (analytical): ${money(a.expectedLoss)}${a.integratedEL != null ? `   EL by numerical integration: ${money(a.integratedEL)}` : ""}`);
  line(`Mean simulated loss: ${money(a.meanLoss)}   Std dev: ${money(a.stdLoss)}   Min: ${money(a.minLoss)}   Max: ${money(a.maxLoss)}`);
  line(`VaR (empirical quantile): ${money(a.var)}   VaR (bisection, ${a.bisectionIterations} iterations): ${money(a.varBisection)}   CDF at VaR: ${(a.cdfAtVar * 100).toFixed(3)}%`);
  line(`Economic Capital Requirement = VaR − E[L] = ${money(a.ecr)}`);

  const chart = (title: string, pts: { x: number; y: number }[], bars: boolean, marker: number) => {
    if (y > 600) { doc.addPage(); y = 50; }
    y += 8; line(title, 12, true);
    const x0 = 50, w = W - 100, h = 140, top = y;
    const xmin = Math.min(...pts.map((p) => p.x)), xmax = Math.max(...pts.map((p) => p.x)) || 1;
    const ymax = Math.max(...pts.map((p) => p.y)) || 1;
    const sx = (v: number) => x0 + ((v - xmin) / (xmax - xmin || 1)) * w;
    const sy = (v: number) => top + h - (v / ymax) * h;
    doc.setDrawColor(150); doc.line(x0, top + h, x0 + w, top + h); doc.line(x0, top, x0, top + h);
    doc.setFillColor(232, 120, 160); doc.setDrawColor(232, 120, 160);
    if (bars) { const bw = w / pts.length; pts.forEach((p, i) => doc.rect(x0 + i * bw, sy(p.y), Math.max(0.5, bw - 1), top + h - sy(p.y), "F")); }
    else for (let i = 1; i < pts.length; i++) doc.line(sx(pts[i - 1]!.x), sy(pts[i - 1]!.y), sx(pts[i]!.x), sy(pts[i]!.y));
    doc.setDrawColor(120, 30, 70); doc.setLineDashPattern([3, 3], 0); doc.line(sx(marker), top, sx(marker), top + h); doc.setLineDashPattern([], 0);
    doc.setFontSize(8); doc.text(money(xmin), x0, top + h + 12); doc.text(money(xmax), x0 + w - 50, top + h + 12); doc.text("VaR", sx(marker) + 3, top + 10);
    y = top + h + 24;
  };
  chart("Portfolio Loss Distribution", a.histogram.map((b) => ({ x: b.loss, y: b.count })), true, a.var);
  chart("Cumulative Distribution Function", a.cdf.map((c) => ({ x: c.loss, y: c.p })), false, a.var);

  if (y > 680) { doc.addPage(); y = 50; }
  line("Risk interpretation", 12, true);
  line(`With ${(a.confidence * 100).toFixed(1)}% confidence the one-year portfolio loss does not exceed ${money(a.var)}. Beyond the expected loss of ${money(a.meanLoss)}, ${money(a.ecr)} of economic capital is needed to absorb unexpected losses at this level. ECR is not total exposure and not regulatory capital. Results come from synthetic data and a classical simulation; no quantum execution or speed-up is implied.`);
  doc.save(`q-creditx-report-${a.createdAt.slice(0, 10)}.pdf`);
}
