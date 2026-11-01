import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AnalysisSummary } from "@/lib/risk/monte-carlo";

export type StoredAnalysis = AnalysisSummary & {
  id?: string; portfolioId: string; portfolioName: string; executionMs: number; createdAt: string;
};

export interface AnalysisRow {
  id: string; portfolio_id: string | null; portfolio_name: string; model: string; confidence: number;
  samples: number; seed: number; expected_loss: number; var: number; ecr: number; execution_ms: number;
  summary: Json; created_at: string;
}

export const rowToAnalysis = (r: AnalysisRow): StoredAnalysis => ({
  ...(r.summary as unknown as AnalysisSummary),
  id: r.id, portfolioId: r.portfolio_id ?? "", portfolioName: r.portfolio_name,
  executionMs: Number(r.execution_ms), createdAt: r.created_at,
});

export const analysesQuery = queryOptions({
  queryKey: ["analyses"],
  queryFn: async () => {
    const { data, error } = await supabase.from("analyses").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) throw error;
    return (data as AnalysisRow[]).map(rowToAnalysis);
  },
});

export async function saveAnalysis(a: StoredAnalysis): Promise<string> {
  const { portfolioId, portfolioName, executionMs, createdAt: _c, id: _i, ...summary } = a;
  const { data, error } = await supabase.from("analyses").insert({
    portfolio_id: portfolioId, portfolio_name: portfolioName, model: a.model, confidence: a.confidence,
    samples: a.samples, seed: a.seed, expected_loss: a.expectedLoss, var: a.var, ecr: a.ecr,
    execution_ms: executionMs, summary: summary as unknown as Json,
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function deleteAnalysis(id: string) {
  const { error } = await supabase.from("analyses").delete().eq("id", id);
  if (error) throw error;
}
