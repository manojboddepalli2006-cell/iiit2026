// Full Q-CreditX research report (PDF) and CSV exports built only from saved results.
import type { ComparisonResult } from "@/lib/compare";
import { comparisonCsv } from "@/lib/compare";
import type { StoredAnalysis } from "@/services/analyses";
import type { Asset } from "@/lib/risk/types";
import { money } from "@/lib/format";

function download(text: string, name: string, type = "text/csv") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
// Neutralise spreadsheet formula injection and quote fields.
const cell = (v: unknown) => { let s = String(v ?? ""); if (/^[=+\-@]/.test(s)) s = `'${s}`; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rows: unknown[][]) => rows.map((r) => r.map(cell).join(",")).join("\n") + "\n";

export const exportAssetsCsv = (assets: Asset[]) => download(csv([["asset_code", "borrower_name", "exposure", "pd", "lgd", "rho", "status"], ...assets.map((a) => [a.asset_code, a.borrower_name, a.exposure, a.pd, a.lgd, a.rho, a.status])]), "portfolio-assets.csv");
export const exportAnalysesCsv = (list: StoredAnalysis[]) => download(csv([["created_at", "portfolio", "model", "confidence", "samples", "seed", "expected_loss", "mean_loss", "var", "ecr", "execution_ms"], ...list.map((a) => [a.createdAt, a.portfolioName, a.model, a.confidence, a.samples, a.seed, a.expectedLoss, a.meanLoss, a.var, a.ecr, a.executionMs.toFixed(1)])]), "analysis-summaries.csv");
export const exportClassicalCsv = (a: StoredAnalysis) => download(csv([["bin_from", "bin_to", "count", "in_tail"], ...a.histogram.map((b) => [b.from, b.to, b.count, b.tail])]) + csv([["loss", "cdf"], ...a.cdf.map((c) => [c.loss, c.p])]), "classical-simulation.csv");
export const exportComparisonCsv = (r: ComparisonResult) => download(comparisonCsv(r), "classical-vs-quantum.csv");
export function exportQuantumMetricsCsv(r: ComparisonResult) {
  const q = r.quantum; if (!q) return;
  download(csv([
    ["metric", "value"], ["created_at", r.createdAt], ["backend", "Q-CreditX statevector simulator (in-browser)"],
    ["qubits", q.qubits], ["logical_qubits", q.logical], ["evaluation_qubits", q.evalQubits], ["ancilla_qubits", q.ancilla],
    ["depth", q.depth], ["gates", q.gates], ["oracle_qubits", q.oracleQubits], ["oracle_depth", q.oracleDepth], ["oracle_gates", q.oracleGates],
    ["qae_evaluations", q.qaeEvaluations], ["oracle_calls", q.oracleCalls], ["shots", q.shots], ["epsilon_at_var", q.epsilon],
    ["var_units", q.var], ["ecr_units", q.ecr], ["cdf_at_var", q.cdfAtVar], ["ci_lo", q.ci[0]], ["ci_hi", q.ci[1]], ["simulator_ms", q.ms.toFixed(1)],
    [], ["x", "qae_estimate", "ci_lo", "ci_hi", "exact"], ...q.cdf.map((c) => [c.x, c.estimate, c.lo, c.hi, r.exact.cdf[c.x]]),
  ]), "quantum-metrics.csv");
}

export async function exportFullReport(r: ComparisonResult, portfolio?: StoredAnalysis) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  let y = 0;
  const ensure = (h: number) => { if (y + h > H - 50) { doc.addPage(); y = 56; } };
  const line = (t: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(40, 30, 40);
    for (const l of doc.splitTextToSize(t, W - 80) as string[]) { ensure(size + 6); doc.text(l, 40, y); y += size + 5; }
  };
  let n = 0;
  const h = (t: string) => { y += 8; ensure(40); doc.setFillColor(248, 220, 232); doc.rect(40, y - 12, W - 80, 20, "F"); line(`${++n}. ${t}`, 12, true); y += 2; };
  const u = (v: number | null | undefined, d = 3) => (v == null ? "—" : `${Number(v.toFixed(d))} units (${money(v * r.unit)})`);
  const q = r.quantum, c = r.classical;

  doc.setFillColor(232, 120, 160); doc.rect(0, 0, W, 90, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.text("Q-CreditX", 40, 42);
  doc.setFontSize(13); doc.text("Quantum Credit Risk Analysis Report", 40, 64);
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text(`Analysis run ${new Date(r.createdAt).toLocaleString()} · report generated ${new Date().toLocaleString()}`, 40, 80);
  y = 116;

  h("Executive Summary");
  line(`Mode: ${r.mode}. Problem: ${r.problemLabel}; ${r.model === "gaussian" ? "Gaussian conditional independence" : "independent defaults"}; confidence ${(r.alpha * 100).toFixed(1)}%.`);
  line(`Exact VaR ${u(r.exact.var, 0)}${c ? `; Monte Carlo VaR ${u(c.var, 0)}` : ""}${q ? `; QAE VaR ${u(q.var, 0)}${q.uncertain ? " (decision at VaR uncertain: CI overlaps α)" : ""}` : ""}. Expected Loss ${u(r.expectedLoss)} is computed classically and shared by both ECR figures.`);
  h("Portfolio Information");
  if (portfolio) line(`Source portfolio: ${portfolio.portfolioName} — ${portfolio.assetCount} assets, total exposure ${money(portfolio.totalExposure)}.`);
  line(`Quantum-sized problem: ${r.problemLabel}; one loss unit = ${money(r.unit)}. Integer loss units are required by the weighted-sum register; rounding of each asset's λ is shown on the Quantum Workspace.`);
  h("Research Methodology");
  line("Egger, García Gutiérrez, Mestre and Woerner (IBM Research, 2019). Oracle A = C·S·U: U loads the discretised latent factor Z and conditional default probabilities, S sums the integer losses, C flips an objective qubit when L ≤ x. Canonical QAE estimates P[L ≤ x]; classical bisection over x finds VaR. Classical Monte Carlo and exact enumeration are computed on the same problem for reference.");
  h("Model Assumptions");
  line(`Z ~ N(0,1) truncated and discretised on 2^nZ points for the circuit and exact reference; Monte Carlo uses continuous Z. p_k(z) = Φ((Φ⁻¹(p_k) − √ρ_k·z)/√(1−ρ_k)). One-year horizon. Synthetic demonstration data.`);
  h("Expected Loss");
  line(`E[L] = Σ λ_k·p_k = ${u(r.expectedLoss, 4)} (analytic, classical). QAE does not estimate E[L] in this implementation.`);
  h("Classical Monte Carlo Results");
  if (c) line(`${c.samples.toLocaleString()} scenarios, seed ${c.seed}, ${c.ms.toFixed(1)} ms. Mean loss ${u(c.mean, 4)}. VaR ${u(c.var, 0)}. ECR ${u(c.ecr)}.`); else line("Not run in this analysis mode.");
  if (portfolio) line(`Full-portfolio run (${new Date(portfolio.createdAt).toLocaleString()}): ${portfolio.samples.toLocaleString()} scenarios, EL ${money(portfolio.expectedLoss)}, VaR ${money(portfolio.var)}, ECR ${money(portfolio.ecr)}.`);
  h("Quantum Algorithm Results");
  if (q) line(`QAE with m = ${q.m} evaluation qubits, ${q.shots ? `${q.shots} shots` : "exact outcome distribution"}; ${q.qaeEvaluations} amplitude estimations; CDF at VaR ${(q.cdfAtVar * 100).toFixed(2)}% (CI ${(q.ci[0] * 100).toFixed(1)}–${(q.ci[1] * 100).toFixed(1)}%); simulator time ${(q.ms / 1000).toFixed(2)} s.`); else line("Not run in this analysis mode.");
  h("Value at Risk");
  line(`Exact: ${u(r.exact.var, 0)}. Monte Carlo: ${u(c?.var, 0)}. QAE: ${u(q?.var, 0)}.`);
  h("Economic Capital Requirement");
  line(`ECR = VaR − E[L]. Exact: ${u(r.exact.ecr)}. Monte Carlo: ${u(c?.ecr)}. QAE: ${u(q?.ecr)}.`);
  h("Classical vs Quantum Comparison");
  const m = r.metrics, f = (v: number | null, s = "") => (v == null ? "n/a" : `${Number(v.toFixed(4))}${s}`);
  line(`|VaR_MC − VaR_QAE| = ${f(m.varAbsDiff)} units; relative ${f(m.varRelDiff, "%")}; |ECR diff| = ${f(m.ecrAbsDiff)}. VaR error vs exact — QAE ${f(m.quantumVarVsExact)}, MC ${f(m.classicalVarVsExact)}. Max CDF error vs exact — QAE ${f(m.cdfMaxErr)}, MC ${f(m.mcCdfMaxErr)}. Amplitude error at VaR ${f(m.amplitudeErr)}.`);
  line(`Measured times are not comparable as a speed-up: the quantum figure is a classical statevector simulation. Oracle calls (${q?.oracleCalls ?? "n/a"}) vs Monte Carlo samples (${c?.samples.toLocaleString() ?? "n/a"}) are counts, not runtimes.`);

  const chart = (title: string, ys: number[], bars: boolean, marker: number, pts?: { x: number; y: number }[]) => {
    h(title); ensure(170);
    const x0 = 50, w = W - 100, ht = 130, top = y;
    const ymax = Math.max(...ys, ...(pts?.map((p) => p.y) ?? []), 1e-9);
    const sx = (i: number) => x0 + (ys.length > 1 ? (i / (ys.length - 1)) : 0.5) * w;
    const sy = (v: number) => top + ht - (v / ymax) * ht;
    doc.setDrawColor(150); doc.line(x0, top + ht, x0 + w, top + ht); doc.line(x0, top, x0, top + ht);
    doc.setFillColor(232, 120, 160); doc.setDrawColor(232, 120, 160);
    const bw = w / Math.max(1, ys.length);
    if (bars) ys.forEach((v, i) => doc.rect(x0 + i * bw, sy(v), Math.max(1, bw - 2), top + ht - sy(v), "F"));
    else for (let i = 1; i < ys.length; i++) doc.line(sx(i - 1), sy(ys[i - 1]!), sx(i), sy(ys[i]!));
    doc.setFillColor(120, 30, 70); pts?.forEach((p) => doc.circle(sx(p.x), sy(p.y), 2.5, "F"));
    const mx = bars ? x0 + (marker + 0.5) * bw : sx(marker);
    doc.setDrawColor(120, 30, 70); doc.setLineDashPattern([3, 3], 0); doc.line(mx, top, mx, top + ht); doc.setLineDashPattern([], 0);
    doc.setFontSize(8); doc.text("0", x0, top + ht + 12); doc.text(String(ys.length - 1), x0 + w - 10, top + ht + 12); doc.text("VaR", mx + 3, top + 10);
    y = top + ht + 22;
  };
  const v = q?.var ?? c?.var ?? r.exact.var;
  chart("Loss Distribution (exact P(L = x), loss units)", r.exact.cdf.map((p, x) => p - (x ? r.exact.cdf[x - 1]! : 0)), true, v);
  chart("Cumulative Distribution (exact line, QAE points)", r.exact.cdf, false, v, q?.cdf.map((p) => ({ x: p.x, y: p.estimate })));
  line("Dots are only the thresholds where QAE was actually run; no continuous quantum curve is interpolated.", 8);
  h("Quantum Circuit Details");
  if (q) line(`Oracle A: ${q.oracleQubits} qubits, ${q.oracleGates} gates, depth ${q.oracleDepth}. QAE circuit: ${q.qubits} qubits, ${q.gates} gates, depth ${q.depth}. Gate set: X, H, RY, phase with multi-controls; no hardware transpilation was performed.`); else line("No quantum circuit in this run.");
  h("Resource Analysis");
  if (q) line(`Logical (Z, X, S, objective) ${q.logical}; evaluation ${q.evalQubits}; ancilla ${q.ancilla}; total ${q.qubits}. Oracle calls ${q.oracleCalls} across ${q.qaeEvaluations} QAE circuits.`); else line("n/a");
  h("Validation Results");
  line(`Statevector objective probability vs exact CDF at VaR: |Δ| = ${f(m.statevectorErr)} — verifies U, S and C. QAE error at VaR ${f(m.amplitudeErr)} with bound ε = ${f(q?.epsilon ?? null)}. Paper Table I validation is part of the automated test suite.`);
  h("Limitations");
  line("In-browser statevector simulation (≤ 20 qubits) — not Qiskit Aer, CUDA-Q or quantum hardware. Small problems only; losses scaled to integer units; Z truncated and discretised; finite shots and evaluation qubits limit precision. No quantum speed-up is claimed. Synthetic data.");
  h("Conclusion");
  line(q ? `The QAE pipeline ${q.var === r.exact.var ? "reproduced" : "did not exactly reproduce"} the exact VaR for this discretised problem (QAE ${q.var} vs exact ${r.exact.var} units). Classical Monte Carlo remains the practical engine for the full portfolio.` : "Classical results only in this run.");
  doc.save(`q-creditx-quantum-report-${r.createdAt.slice(0, 10)}.pdf`);
}
