-- Enum de variantes de logo / activo
CREATE TYPE public.brand_asset_kind AS ENUM (
  'logo_vertical', 'logo_horizontal', 'logotipo', 'logotipo_simplificado', 'manual_pdf'
);

-- 1) brand_assets
CREATE TABLE public.brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.brand_asset_kind NOT NULL UNIQUE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_assets TO authenticated;
GRANT ALL ON public.brand_assets TO service_role;
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read brand assets" ON public.brand_assets
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin or dev manage brand assets" ON public.brand_assets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dev'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dev'));

CREATE TRIGGER brand_assets_touch BEFORE UPDATE ON public.brand_assets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) brand_rules (singleton; usamos id fijo)
CREATE TABLE public.brand_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allowed_colors TEXT[] NOT NULL DEFAULT ARRAY['Verde Institucional','Blanco','Negro'],
  no_alteration BOOLEAN NOT NULL DEFAULT true,
  require_trademark BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_rules TO authenticated;
GRANT ALL ON public.brand_rules TO service_role;
ALTER TABLE public.brand_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read brand rules" ON public.brand_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin or dev manage brand rules" ON public.brand_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dev'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dev'));

CREATE TRIGGER brand_rules_touch BEFORE UPDATE ON public.brand_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Sembrar la fila única
INSERT INTO public.brand_rules (id) VALUES (gen_random_uuid());

-- 3) event_category_rules (matriz)
CREATE TABLE public.event_category_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,
  required_logo public.brand_asset_kind NOT NULL,
  require_trademark BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_category_rules TO authenticated;
GRANT ALL ON public.event_category_rules TO service_role;
ALTER TABLE public.event_category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read category rules" ON public.event_category_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin or dev manage category rules" ON public.event_category_rules
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dev'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dev'));

CREATE TRIGGER event_category_rules_touch BEFORE UPDATE ON public.event_category_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Sembrar matriz por defecto del manual
INSERT INTO public.event_category_rules (category, subcategory, required_logo, require_trademark, description, sort_order) VALUES
  ('Rituales de paso', 'Honoris Causa, Diplomas', 'logo_vertical', false, 'Eventos solemnes y de graduación', 10),
  ('Actividades académicas y de docencia', 'Admisiones, Oferta, Certificados', 'logo_horizontal', false, 'Docencia y procesos académicos', 20),
  ('Actividades de Extensión e Investigación', NULL, 'logotipo', false, 'Extensión, investigación y proyección', 30),
  ('Prendas de Vestir / Merchandising', 'Uniformes formativos', 'logotipo', true, 'Uniformes institucionales formativos', 40),
  ('Prendas de Vestir / Merchandising', 'Deporte recreativo', 'logotipo_simplificado', true, 'Indumentaria deportiva recreativa', 50),
  ('Prendas de Vestir / Merchandising', 'Obsequios institucionales', 'logo_horizontal', true, 'Termos, gorras, obsequios y suvenires', 60);

-- 4) Storage policies sobre storage.objects para el bucket 'brand-assets'
CREATE POLICY "Authenticated read brand-assets bucket" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'brand-assets');

CREATE POLICY "Admin or dev upload brand-assets" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dev'))
  );

CREATE POLICY "Admin or dev update brand-assets" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dev'))
  );

CREATE POLICY "Admin or dev delete brand-assets" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'dev'))
  );