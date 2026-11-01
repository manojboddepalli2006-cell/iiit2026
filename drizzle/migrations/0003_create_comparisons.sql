CREATE TABLE public.comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL DEFAULT 'comparative',
  portfolio_id uuid NULL,
  problem_label text NOT NULL,
  confidence double precision NOT NULL,
  classical_var double precision NULL,
  quantum_var double precision NULL,
  exact_var double precision NULL,
  unit double precision NOT NULL DEFAULT 1,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.comparisons TO anon, authenticated;
GRANT ALL ON public.comparisons TO service_role;
ALTER TABLE public.comparisons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo workspace read comparisons" ON public.comparisons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Demo workspace insert comparisons" ON public.comparisons FOR INSERT TO anon, authenticated WITH CHECK (char_length(problem_label) <= 200 AND confidence > 0 AND confidence < 1);
CREATE POLICY "Demo workspace delete comparisons" ON public.comparisons FOR DELETE TO anon, authenticated USING (true);