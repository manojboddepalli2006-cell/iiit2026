CREATE TABLE public.quantum_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_label text NOT NULL,
  model text NOT NULL,
  n_assets integer NOT NULL,
  confidence double precision NOT NULL,
  eval_qubits integer NOT NULL,
  shots integer NOT NULL,
  qubits integer NOT NULL,
  depth integer NOT NULL,
  gate_count integer NOT NULL,
  var_units integer NOT NULL,
  ecr_units double precision NOT NULL,
  unit double precision NOT NULL,
  execution_ms double precision NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quantum_runs TO anon, authenticated;
GRANT ALL ON public.quantum_runs TO service_role;
ALTER TABLE public.quantum_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo workspace access" ON public.quantum_runs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);