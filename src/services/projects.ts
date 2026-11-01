import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const projectsQuery = queryOptions({
  queryKey: ["projects"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("projects").select("*, portfolios(name)").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export async function createProject(p: { name: string; description: string; portfolio_id: string; config: Json }) {
  const { error } = await supabase.from("projects").insert(p);
  if (error) throw error;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export async function saveProjectResult(id: string, result: Json) {
  const { error } = await supabase.from("projects").update({ last_status: "Completed (classical)", last_result: result }).eq("id", id);
  if (error) throw error;
}
