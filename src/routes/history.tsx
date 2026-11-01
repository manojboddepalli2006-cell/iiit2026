import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileDown, GitCompare, Inbox, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Panel, StatusPill } from "@/components/app-shell";
import { AnalysisResults } from "@/components/analysis-panel";
import { analysesQuery, deleteAnalysis, type StoredAnalysis } from "@/services/analyses";
import { exportPdfReport } from "@/lib/risk/report";
import { money } from "@/lib/format";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Analysis History — Q-CreditX" },
      { name: "description", content: "Saved classical Monte Carlo credit risk analyses: view, compare and delete." },
      { property: "og:title", content: "Analysis History — Q-CreditX" },
      { property: "og:description", content: "Review and compare past EL, VaR and economic capital runs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

const modelLabel = (m: string) => (m === "gaussian" ? "Gaussian" : "Independent");

function HistoryPage() {
  const qc = useQueryClient();
  const q = useQuery(analysesQuery);
  const [viewing, setViewing] = useState<StoredAnalysis | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const list = q.data ?? [];
  const compare = picked.length === 2 ? picked.map((id) => list.find((a) => a.id === id)!).filter(Boolean) : [];

  const remove = async (id: string) => {
    try {
      await deleteAnalysis(id);
      setPicked((p) => p.filter((x) => x !== id));
      if (viewing?.id === id) setViewing(null);
      qc.invalidateQueries({ queryKey: ["analyses"] });
      toast.success("Analysis deleted");
    } catch (e) { toast.error((e as Error).message); }
  };
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.slice(-1), id]));

  return (
    <div className="space-y-6">
      <PageHeader title="Analysis History" subtitle="Classical Monte Carlo runs on synthetic data. Tick two rows to compare." />
      <Panel className="overflow-x-auto p-0">
        {q.isLoading ? <div className="space-y-2 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}</div>
          : !list.length ? <div className="flex flex-col items-center gap-2 p-10 text-muted-foreground"><Inbox /> No analyses yet — run one from the Dashboard.</div>
          : (
            <table className="w-full text-sm">
              <thead className="border-b bg-accent/50 text-xs text-muted-foreground">
                <tr>{["", "Created", "Portfolio", "Model", "Conf.", "Samples", "EL", "VaR", "ECR", "Time", ""].map((h, i) =>
                  <th key={i} className={`px-3 py-3 font-medium ${i >= 5 && i <= 9 ? "text-right" : "text-left"}`}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-3 py-2"><Checkbox checked={picked.includes(a.id!)} onCheckedChange={() => toggle(a.id!)} aria-label="Select for comparison" /></td>
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{a.portfolioName}</td>
                    <td className="px-3 py-2">{modelLabel(a.model)}</td>
                    <td className="px-3 py-2">{(a.confidence * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2 text-right">{a.samples.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{money(a.expectedLoss)}</td>
                    <td className="px-3 py-2 text-right">{money(a.var)}</td>
                    <td className="px-3 py-2 text-right">{money(a.ecr)}</td>
                    <td className="px-3 py-2 text-right">{(a.executionMs / 1000).toFixed(2)} s</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" aria-label="View" onClick={() => setViewing(a)}><Eye /></Button>
                        <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => remove(a.id!)}><Trash2 /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </Panel>

      {compare.length === 2 && (
        <Panel>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><GitCompare className="size-5" /> Comparison</h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground"><tr><th className="py-2 text-left">Metric</th><th className="text-right">A</th><th className="text-right">B</th><th className="text-right">B − A</th></tr></thead>
            <tbody>
              {([
                ["Model", (x: StoredAnalysis) => modelLabel(x.model)],
                ["Confidence", (x: StoredAnalysis) => `${(x.confidence * 100).toFixed(1)}%`],
                ["Samples", (x: StoredAnalysis) => x.samples.toLocaleString()],
                ["Seed", (x: StoredAnalysis) => String(x.seed)],
              ] as const).map(([l, f]) => (
                <tr key={l} className="border-t"><td className="py-2">{l}</td><td className="text-right">{f(compare[0]!)}</td><td className="text-right">{f(compare[1]!)}</td><td /></tr>
              ))}
              {([
                ["Expected Loss", (x: StoredAnalysis) => x.expectedLoss],
                ["Mean simulated loss", (x: StoredAnalysis) => x.meanLoss],
                ["VaR", (x: StoredAnalysis) => x.var],
                ["Economic capital", (x: StoredAnalysis) => x.ecr],
                ["Loss std dev", (x: StoredAnalysis) => x.stdLoss],
                ["Max loss", (x: StoredAnalysis) => x.maxLoss],
              ] as const).map(([l, f]) => (
                <tr key={l} className="border-t"><td className="py-2">{l}</td><td className="text-right">{money(f(compare[0]!))}</td><td className="text-right">{money(f(compare[1]!))}</td><td className="text-right font-medium">{money(f(compare[1]!) - f(compare[0]!))}</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}

      {viewing && (
        <Panel>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{viewing.portfolioName}</h2>
            <div className="flex gap-2"><StatusPill tone="warn">Synthetic · classical</StatusPill><Button size="sm" variant="ghost" onClick={() => setViewing(null)}>Close</Button></div>
          </div>
          <AnalysisResults a={viewing} actions={<Button variant="outline" size="sm" className="rounded-xl" onClick={() => exportPdfReport(viewing)}><FileDown /> PDF report</Button>} />
        </Panel>
      )}
    </div>
  );
}
