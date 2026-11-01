CREATE TABLE public.portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  asset_code text NOT NULL,
  borrower_name text NOT NULL,
  exposure numeric NOT NULL CHECK (exposure > 0),
  pd numeric NOT NULL CHECK (pd >= 0 AND pd <= 1),
  lgd numeric NOT NULL CHECK (lgd >= 0 AND lgd <= 1),
  rho numeric NOT NULL CHECK (rho >= 0 AND rho <= 1),
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (portfolio_id, asset_code)
);
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  portfolio_id uuid REFERENCES public.portfolios(id) ON DELETE SET NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_status text NOT NULL DEFAULT 'Not run',
  last_result jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolios, public.assets, public.projects TO anon, authenticated;
GRANT ALL ON public.portfolios, public.assets, public.projects TO service_role;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo workspace access" ON public.portfolios FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo workspace access" ON public.assets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "demo workspace access" ON public.projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.portfolios (id, name, description) VALUES
 ('00000000-0000-0000-0000-000000000001', 'Demo Corporate Loan Book', 'Synthetic 100-asset demonstration portfolio (not real banking data).');

INSERT INTO public.assets (portfolio_id, asset_code, borrower_name, exposure, pd, lgd, rho, status)
SELECT '00000000-0000-0000-0000-000000000001',
  'QCX-' || lpad(i::text, 4, '0'),
  (ARRAY['Aurora','Belmont','Cedar','Delta','Everest','Falcon','Granite','Harbor','Ivory','Juniper'])[1 + (i*7) % 10] || ' ' ||
  (ARRAY['Holdings','Industries','Logistics','Energy','Retail','Capital','Foods','Systems','Textiles','Pharma'])[1 + (i*3) % 10] || ' Ltd',
  round((50000 + ((i*7919) % 1000) * 950)::numeric, 0),
  round((0.005 + ((i*131) % 100) / 100.0 * 0.075)::numeric, 4),
  round((0.25 + ((i*57) % 100) / 100.0 * 0.5)::numeric, 3),
  round((0.05 + ((i*37) % 100) / 100.0 * 0.3)::numeric, 3),
  CASE WHEN i % 17 = 0 THEN 'Watchlist' WHEN i % 29 = 0 THEN 'Defaulted' ELSE 'Active' END
FROM generate_series(1, 100) AS i;

INSERT INTO public.projects (name, description, portfolio_id, config) VALUES
 ('Baseline Credit Risk Study', 'Classical Monte Carlo baseline on the demo loan book.', '00000000-0000-0000-0000-000000000001',
  '{"model":"gaussian","confidence":0.99,"samples":20000,"algorithm":"classical"}');