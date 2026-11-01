import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ComparisonResult } from "@/lib/compare";

export type StoredComparison = ComparisonResult & { id: string };

export const comparisonsQuery = queryOptions({
  queryKey: ["comparisons"],
  queryFn: async () => {
    const { data, error } = await supabase.from("comparisons").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data.map((r) => ({ ...(r.result as unknown as ComparisonResult), id: r.id, createdAt: r.created_at }) as StoredComparison);
  },
});

export async function saveComparison(r: ComparisonResult, portfolioId: string | null): Promise<StoredComparison> {
  const { data, error } = await supabase.from("comparisons").insert({
    mode: r.mode, portfolio_id: portfolioId, problem_label: r.problemLabel, confidence: r.alpha,
    classical_var: r.classical?.var ?? null, quantum_var: r.quantum?.var ?? null, exact_var: r.exact.var, unit: r.unit,
    result: r as unknown as Json,
  }).select("id, created_at").single();
  if (error) throw error;
  return { ...r, id: data.id, createdAt: data.created_at };
}

export async function deleteComparison(id: string) {
  const { error } = await supabase.from("comparisons").delete().eq("id", id);
  if (error) throw error;
}
