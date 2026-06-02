
CREATE TABLE public.brand_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  brand_name text NOT NULL DEFAULT '',
  industry text DEFAULT '',
  personality text DEFAULT '',
  target_audience text DEFAULT '',
  primary_color text DEFAULT '#171717',
  secondary_color text DEFAULT '#ffffff',
  accent_color text DEFAULT '#9a3412',
  heading_font text DEFAULT 'Instrument Serif',
  body_font text DEFAULT 'Schibsted Grotesk',
  voice_tone text DEFAULT '',
  writing_style text DEFAULT '',
  forbidden_phrases text[] NOT NULL DEFAULT '{}',
  mandatory_elements text[] NOT NULL DEFAULT '{}',
  restrictions text[] NOT NULL DEFAULT '{}',
  legal_text text DEFAULT '',
  slogan text DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_profiles TO authenticated;
GRANT ALL ON public.brand_profiles TO service_role;

ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own brand profile" ON public.brand_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own brand profile" ON public.brand_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own brand profile" ON public.brand_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own brand profile" ON public.brand_profiles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER brand_profiles_touch_updated_at
  BEFORE UPDATE ON public.brand_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
