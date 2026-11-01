import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpDown, Download, Pencil, Plus, Trash2, Upload, Search, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PageHeader, Panel, StatusPill } from "@/components/app-shell";
import { AnalysisPanel } from "@/components/analysis-panel";
import { assetsQuery, createAssets, deleteAsset, portfoliosQuery, updateAsset } from "@/services/portfolio";
import { projectsQuery, saveProjectResult } from "@/services/projects";
import { assetEL } from "@/lib/risk/engine";
import { parseAssetCsv, SAMPLE_CSV, validateAsset, type CsvRowResult } from "@/lib/risk/validation";
import { ASSET_STATUSES, type AnalysisConfig, type Asset, type AssetInput } from "@/lib/risk/types";
import { money, pct } from "@/lib/format";

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s: Record<string, unknown>): { q?: string; project?: string } => ({
    ...(typeof s["q"] === "string" ? { q: s["q"] } : {}),
    ...(typeof s["project"] === "string" ? { project: s["project"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Portfolio Dashboard — Q-CreditX" },
      { name: "description", content: "Manage synthetic credit portfolio assets and run classical credit risk analysis." },
      { property: "og:title", content: "Portfolio Dashboard — Q-CreditX" },
      { property: "og:description", content: "Asset table, CSV import and Monte Carlo risk analysis." },
    ],
  }),
  component: Dashboard,
});

type SortKey = keyof Omit<Asset, "id"> | "el";
const PAGE = 10;

function Dashboard() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const portfolios = useQuery(portfoliosQuery);
  const projects = useQuery(projectsQuery);
  const project = projects.data?.find((p) => p.id === search.project);
  const [selected, setSelected] = useState<string>();
  const pid = selected ?? project?.portfolio_id ?? portfolios.data?.[0]?.id;
  const assets = useQuery(assetsQuery(pid));
  const list = assets.data ?? [];

  const [q, setQ] = useState(search.q ?? "");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "asset_code", dir: 1 });
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Asset | "new" | null>(null);
  const [deleting, setDeleting] = useState<Asset | null>(null);
  const [csvReport, setCsvReport] = useState<CsvRowResult[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const needle = q.toLowerCase();
    const f = list.filter((a) =>
      (status === "all" || a.status === status) &&
      (!needle || a.asset_code.toLowerCase().includes(needle) || a.borrower_name.toLowerCase().includes(needle)));
    const val = (a: Asset) => (sort.key === "el" ? assetEL(a) : a[sort.key]);
    return f.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [list, q, status, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);

  const refresh = () => qc.invalidateQueries({ queryKey: ["assets", pid] });
  const initialCfg = useMemo(() => (project?.config ?? undefined) as Partial<AnalysisConfig> | undefined, [project]);

  const onCsv = async (file: File) => {
    const text = await file.text();
    const res = parseAssetCsv(text, list.map((a) => a.asset_code));
    setCsvReport(res);
    const valid = res.filter((r) => r.asset).map((r) => r.asset!);
    if (valid.length && pid) {
      try {
        await createAssets(pid, valid);
        toast.success(`Imported ${valid.length} asset(s)`);
        refresh();
      } catch (e) { toast.error((e as Error).message); }
    }
    const bad = res.filter((r) => r.errors.length).length;
    if (bad) toast.error(`${bad} row(s) rejected — see validation report`);
  };

  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "q-creditx-sample-assets.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const header = (key: SortKey, label: string, right = false) => (
    <th className={`px-3 py-3 font-medium ${right ? "text-right" : "text-left"}`}>
      <button className="inline-flex items-center gap-1 hover:text-primary-deep" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }))}>
        {label}<ArrowUpDown className="size-3" />
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio Manager"
        subtitle={project ? `Project: ${project.name}` : "Synthetic demonstration portfolio — not real banking data"}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl" onClick={downloadSample}><Download /> Sample CSV</Button>
            <Button variant="outline" className="rounded-xl" onClick={() => fileRef.current?.click()}><Upload /> Upload CSV</Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onCsv(f); e.target.value = ""; }} />
            <Button className="rounded-xl bg-brand-gradient" onClick={() => setEditing("new")}><Plus /> Add asset</Button>
          </div>
        }
      />

      {pid && portfolios.data && (
        <AnalysisPanel
          assets={list} portfolios={portfolios.data} portfolioId={pid}
          onPortfolioChange={(id) => { setSelected(id); setPage(0); }}
          initial={initialCfg}
          onComplete={(r) => {
            if (project) saveProjectResult(project.id, { var: r.var, ecr: r.ecr, el: r.expectedLoss, confidence: r.confidence, samples: r.samples })
              .then(() => qc.invalidateQueries({ queryKey: ["projects"] }));
          }}
        />
      )}

      {csvReport && csvReport.some((r) => r.errors.length) && (
        <Panel className="border-destructive/40">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">CSV validation report</h3>
            <Button size="sm" variant="ghost" onClick={() => setCsvReport(null)}>Dismiss</Button>
          </div>
          <ul className="max-h-48 space-y-1 overflow-auto text-sm">
            {csvReport.filter((r) => r.errors.length).map((r) => (
              <li key={r.row}><b>Row {r.row}:</b> <span className="text-destructive">{r.errors.join("; ")}</span></li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search by asset ID or borrower" className="rounded-xl pl-9" />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
            <SelectTrigger className="w-40 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {ASSET_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{rows.length} assets</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-accent/60 text-xs text-muted-foreground">
              <tr>
                {header("asset_code", "Asset ID")}{header("borrower_name", "Borrower")}{header("exposure", "Exposure", true)}
                {header("pd", "PD", true)}{header("lgd", "LGD", true)}{header("rho", "ρ", true)}{header("el", "EL", true)}{header("status", "Status")}
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {assets.isLoading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={9} className="px-3 py-2"><Skeleton className="h-6" /></td></tr>
              ))}
              {!assets.isLoading && view.length === 0 && (
                <tr><td colSpan={9} className="py-14 text-center text-muted-foreground"><Inbox className="mx-auto mb-2 size-6" />No assets match your filters.</td></tr>
              )}
              {view.map((a) => (
                <tr key={a.id} className="border-t transition-colors hover:bg-accent/40">
                  <td className="px-3 py-2.5 font-mono text-xs">{a.asset_code}</td>
                  <td className="px-3 py-2.5">{a.borrower_name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(a.exposure)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{pct(a.pd)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{pct(a.lgd, 1)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{a.rho.toFixed(3)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(assetEL(a))}</td>
                  <td className="px-3 py-2.5"><StatusPill tone={a.status === "Active" ? "ok" : a.status === "Watchlist" ? "warn" : "bad"}>{a.status}</StatusPill></td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" aria-label={`Edit ${a.asset_code}`} onClick={() => setEditing(a)}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${a.asset_code}`} onClick={() => setDeleting(a)}><Trash2 className="size-4 text-destructive" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t p-4 text-sm">
          <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </Panel>

      <AssetDialog
        open={editing !== null} asset={editing === "new" ? null : editing}
        existingCodes={list.filter((a) => editing === "new" || a.id !== (editing as Asset | null)?.id).map((a) => a.asset_code)}
        onClose={() => setEditing(null)}
        onSave={async (input) => {
          if (editing === "new") await createAssets(pid!, [input]);
          else if (editing) await updateAsset(editing.id, input);
          toast.success(editing === "new" ? "Asset added" : "Asset updated");
          setEditing(null); refresh();
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.asset_code}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the asset from the portfolio.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try { await deleteAsset(deleting!.id); toast.success("Asset deleted"); refresh(); } catch (e) { toast.error((e as Error).message); }
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AssetDialog({ open, asset, existingCodes, onClose, onSave }: {
  open: boolean; asset: Asset | null; existingCodes: string[]; onClose: () => void; onSave: (a: AssetInput) => Promise<void>;
}) {
  const blank = { asset_code: "", borrower_name: "", exposure: "", pd: "", lgd: "", rho: "", status: "Active" };
  type Form = typeof blank;
  const [form, setForm] = useState<Form>(blank);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = open ? asset?.id ?? "new" : null;
  if (key !== lastKey) {
    setLastKey(key);
    setErrors([]);
    setForm(asset ? { asset_code: asset.asset_code, borrower_name: asset.borrower_name, exposure: String(asset.exposure), pd: String(asset.pd), lgd: String(asset.lgd), rho: String(asset.rho), status: asset.status } : blank);
  }

  const submit = async () => {
    const input: AssetInput = {
      asset_code: form.asset_code.trim(), borrower_name: form.borrower_name.trim(),
      exposure: form.exposure === "" ? NaN : Number(form.exposure), pd: form.pd === "" ? NaN : Number(form.pd),
      lgd: form.lgd === "" ? NaN : Number(form.lgd), rho: form.rho === "" ? NaN : Number(form.rho), status: form.status,
    };
    const errs = validateAsset(input);
    if (existingCodes.some((c) => c.toUpperCase() === input.asset_code.toUpperCase())) errs.push("Asset ID must be unique");
    setErrors(errs);
    if (errs.length) return;
    setSaving(true);
    try { await onSave(input); } catch (e) { setErrors([(e as Error).message]); } finally { setSaving(false); }
  };

  const field = (k: keyof Form, label: string, type = "text", step?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} type={type} {...(step ? { step } : {})} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>{asset ? "Edit asset" : "Add asset"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("asset_code", "Asset ID")}{field("borrower_name", "Borrower name")}
          {field("exposure", "Exposure amount", "number", "1000")}{field("pd", "Default probability (0–1)", "number", "0.001")}
          {field("lgd", "Loss given default (0–1)", "number", "0.01")}{field("rho", "Correlation sensitivity ρ (0–1)", "number", "0.01")}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ASSET_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {errors.length > 0 && <ul className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-brand-gradient">{saving ? "Saving…" : "Save asset"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
