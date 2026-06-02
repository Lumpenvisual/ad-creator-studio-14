
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============ CUESTIONARIO (plantilla global, editada por admin) ============
CREATE TABLE public.event_questionnaire_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_key text NOT NULL UNIQUE,
  label text NOT NULL,
  hint text DEFAULT '',
  field_type text NOT NULL DEFAULT 'text', -- text | textarea | select | date | number
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  section text NOT NULL DEFAULT 'general',
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_questionnaire_fields TO authenticated;
GRANT ALL ON public.event_questionnaire_fields TO service_role;

ALTER TABLE public.event_questionnaire_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated reads questionnaire" ON public.event_questionnaire_fields
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert questionnaire fields" ON public.event_questionnaire_fields
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update questionnaire fields" ON public.event_questionnaire_fields
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete questionnaire fields" ON public.event_questionnaire_fields
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER event_questionnaire_fields_touch_updated_at
  BEFORE UPDATE ON public.event_questionnaire_fields
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Sembrar plantilla por defecto
INSERT INTO public.event_questionnaire_fields
  (field_key, label, hint, field_type, options, section, required, sort_order) VALUES
  ('event_name',    'Nombre del evento',     'Cómo se llama esta campaña o evento',                                  'text',     '[]', 'general',  true,  10),
  ('event_date',    'Fecha',                 'Cuándo ocurre',                                                        'date',     '[]', 'general',  true,  20),
  ('event_place',   'Lugar',                 'Ciudad, venue o "online"',                                             'text',     '[]', 'general',  false, 30),
  ('audience',      'Audiencia',             'A quién va dirigido este evento concretamente',                        'textarea', '[]', 'context',  true,  40),
  ('key_message',   'Mensaje clave',         'La idea principal en una frase',                                       'textarea', '[]', 'context',  true,  50),
  ('cta',           'Llamada a la acción',   'Ej. Reserva tu plaza, Compra entradas, Inscríbete',                    'text',     '[]', 'context',  true,  60),
  ('format',        'Formato preferido',     'Tamaño del banner principal',                                          'select',
    '["square","vertical","horizontal"]'::jsonb,                                                                                 'output',   true,  70),
  ('mood',          'Mood / atmósfera',      'Adjetivos visuales: épico, sereno, energético…',                       'text',     '[]', 'output',   false, 80),
  ('extra_notes',   'Notas adicionales',     'Cualquier indicación libre que la IA deba considerar',                 'textarea', '[]', 'output',   false, 90);

-- ============ EVENTOS ============
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Nuevo evento',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft', -- draft | generating | ready | failed
  drive_folder_id text,
  drive_folder_url text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own events" ON public.events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own events" ON public.events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own events" ON public.events
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own events" ON public.events
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER events_touch_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ OUTPUTS GENERADOS ============
CREATE TABLE public.event_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  headlines text[] NOT NULL DEFAULT '{}',
  bodies text[] NOT NULL DEFAULT '{}',
  image_url text,
  format text DEFAULT 'square',
  drive_file_id text,
  drive_file_url text,
  validation_warnings text[] NOT NULL DEFAULT '{}',
  passed_validation boolean NOT NULL DEFAULT false,
  attempt_number integer NOT NULL DEFAULT 1,
  prompt_used text,
  model_used text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_outputs TO authenticated;
GRANT ALL ON public.event_outputs TO service_role;

ALTER TABLE public.event_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own outputs" ON public.event_outputs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own outputs" ON public.event_outputs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own outputs" ON public.event_outputs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_event_outputs_event_id ON public.event_outputs(event_id);
CREATE INDEX idx_events_user_id ON public.events(user_id);
