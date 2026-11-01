import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { QuantumRunResult } from "@/lib/quantum/workspace";

export type StoredQuantumRun = Omit<QuantumRunResult, "qasm"> & { id: string; createdAt: string; qasm?: string };

export const quantumRunsQuery = queryOptions({
  queryKey: ["quantum-runs"],
  queryFn: async () => {
    const { data, error } = await supabase.from("quantum_runs").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data.map((r) => ({ ...(r.result as unknown as Omit<QuantumRunResult, "qasm">), id: r.id, createdAt: r.created_at }) as StoredQuantumRun);
  },
});

export async function saveQuantumRun(r: QuantumRunResult): Promise<{ id: string; createdAt: string }> {
  const { qasm: _q, ...rest } = r;
  const { data, error } = await supabase.from("quantum_runs").insert({
    problem_label: r.job.problem.label, model: r.job.problem.model, n_assets: r.job.problem.assets.length,
    confidence: r.job.alpha, eval_qubits: r.job.cfg.m, shots: r.job.cfg.shots,
    qubits: r.qae.qubits, depth: r.qae.depth, gate_count: r.qae.gates,
    var_units: r.var, ecr_units: r.ecr, unit: r.job.problem.unit, execution_ms: r.totalMs,
    result: rest as unknown as Json,
  }).select("id, created_at").single();
  if (error) throw error;
  return { id: data.id, createdAt: data.created_at };
}

export async function deleteQuantumRun(id: string) {
  const { error } = await supabase.from("quantum_runs").delete().eq("id", id);
  if (error) throw error;
}
