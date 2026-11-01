import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Asset, AssetInput } from "@/lib/risk/types";

const toAsset = (r: Record<string, unknown>): Asset => ({
  id: r.id as string,
  asset_code: r.asset_code as string,
  borrower_name: r.borrower_name as string,
  exposure: Number(r.exposure),
  pd: Number(r.pd),
  lgd: Number(r.lgd),
  rho: Number(r.rho),
  status: r.status as string,
});

export const portfoliosQuery = queryOptions({
  queryKey: ["portfolios"],
  queryFn: async () => {
    const { data, error } = await supabase.from("portfolios").select("*").order("created_at");
    if (error) throw error;
    return data;
  },
});

export const assetsQuery = (portfolioId: string | undefined) =>
  queryOptions({
    queryKey: ["assets", portfolioId],
    enabled: !!portfolioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assets").select("*").eq("portfolio_id", portfolioId!).order("asset_code");
      if (error) throw error;
      return data.map(toAsset);
    },
  });

export async function createAssets(portfolioId: string, items: AssetInput[]) {
  const { error } = await supabase.from("assets").insert(items.map((a) => ({ ...a, portfolio_id: portfolioId })));
  if (error) throw new Error(error.code === "23505" ? "Asset ID must be unique" : error.message);
}

export async function updateAsset(id: string, a: AssetInput) {
  const { error } = await supabase.from("assets").update(a).eq("id", id);
  if (error) throw new Error(error.code === "23505" ? "Asset ID must be unique" : error.message);
}

export async function deleteAsset(id: string) {
  const { error } = await supabase.from("assets").delete().eq("id", id);
  if (error) throw error;
}
