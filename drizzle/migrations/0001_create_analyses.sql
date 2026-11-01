CREATE TABLE public.analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL,
  portfolio_name text NOT NULL,
  model text NOT NULL,
  confidence double precision NOT NULL,
  samples integer NOT NULL,
  seed integer NOT NULL,
  expected_loss double precision NOT NULL,
  var double precision NOT NULL,
  ecr double precision NOT NULL,
  execution_ms double precision NOT NULL,
  summary jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analyses TO anon, authenticated;
GRANT ALL ON public.analyses TO service_role;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo workspace access" ON public.analyses FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);