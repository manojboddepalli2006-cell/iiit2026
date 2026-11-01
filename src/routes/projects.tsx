import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, FolderPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Panel, StatusPill } from "@/components/app-shell";
import { createProject, deleteProject, projectsQuery } from "@/services/projects";
import { portfoliosQuery } from "@/services/portfolio";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Analysis Projects — Q-CreditX" },
      { name: "description", content: "Save and reopen credit risk analysis projects." },
      { property: "og:title", content: "Analysis Projects — Q-CreditX" },
      { property: "og:description", content: "Saved credit risk analysis projects and their latest status." },
    ],
  }),
  component: Projects,
});

function Projects() {
  const qc = useQueryClient();
  const projects = useQuery(projectsQuery);
  const portfolios = useQuery(portfoliosQuery);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", portfolio_id: "" });

  const save = async (): Promise<void> => {
    const pid = form.portfolio_id || portfolios.data?.[0]?.id;
    if (!form.name.trim()) { toast.error("Project name is required"); return; }
    if (!pid) { toast.error("Select a portfolio"); return; }
    try {
      await createProject({ name: form.name.trim(), description: form.description, portfolio_id: pid, config: { model: "gaussian", confidence: 0.99, samples: 20000, algorithm: "classical" } });
      toast.success("Project created");
      setOpen(false); setForm({ name: "", description: "", portfolio_id: "" });
      qc.invalidateQueries({ queryKey: ["projects"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  const remove = async (id: string) => {
    try { await deleteProject(id); toast.success("Project deleted"); qc.invalidateQueries({ queryKey: ["projects"] }); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <PageHeader title="Projects" subtitle="Saved credit risk analysis projects"
        actions={<Button className="rounded-xl bg-brand-gradient" onClick={() => setOpen(true)}><FolderPlus /> New project</Button>} />
      {projects.isLoading && <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>}
      {projects.data?.length === 0 && (
        <Panel className="py-14 text-center text-muted-foreground">No projects yet. Create one to save an analysis configuration.</Panel>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.data?.map((p) => (
          <Panel key={p.id} className="flex flex-col transition-shadow hover:shadow-lift">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{p.name}</h3>
              <StatusPill tone={p.last_status.startsWith("Completed") ? "ok" : "pending"}>{p.last_status}</StatusPill>
            </div>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.description || "No description"}</p>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div><dt className="text-muted-foreground">Portfolio</dt><dd className="font-medium">{p.portfolios?.name ?? "—"}</dd></div>
              <div><dt className="text-muted-foreground">Created</dt><dd className="font-medium">{new Date(p.created_at).toLocaleDateString()}</dd></div>
            </dl>
            <div className="mt-4 flex gap-2">
              <Button asChild size="sm" className="flex-1 rounded-xl"><Link to="/dashboard" search={{ project: p.id }}><FolderOpen /> Open</Link></Button>
              <Button size="sm" variant="outline" className="rounded-xl" aria-label={`Delete ${p.name}`} onClick={() => remove(p.id)}><Trash2 className="text-destructive" /></Button>
            </div>
          </Panel>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>New project</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="pname">Project name</Label><Input id="pname" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label htmlFor="pdesc">Description</Label><Textarea id="pdesc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Portfolio</Label>
              <Select value={form.portfolio_id || portfolios.data?.[0]?.id || ""} onValueChange={(v) => setForm({ ...form, portfolio_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select portfolio" /></SelectTrigger>
                <SelectContent>{portfolios.data?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button className="bg-brand-gradient" onClick={save}>Create project</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
