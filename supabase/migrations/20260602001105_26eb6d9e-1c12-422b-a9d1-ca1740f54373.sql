
CREATE TABLE public.google_connections (
  user_id uuid PRIMARY KEY,
  access_token text NOT NULL,
  refresh_token text,
  expiry_at timestamptz NOT NULL,
  scope text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_connections TO authenticated;
GRANT ALL ON public.google_connections TO service_role;

ALTER TABLE public.google_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own google connection" ON public.google_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own google connection" ON public.google_connections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own google connection" ON public.google_connections
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own google connection" ON public.google_connections
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER touch_google_connections_updated_at
  BEFORE UPDATE ON public.google_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
