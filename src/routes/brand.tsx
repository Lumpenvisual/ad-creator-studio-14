import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Sparkles, Palette, MessageSquare, ShieldAlert, Type } from "lucide-react";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";

export const Route = createFileRoute("/brand")({
  head: () => ({
    meta: [
      { title: "Brand Profile — Vellum Studio" },
      { name: "description", content: "Define las directrices de tu marca." },
    ],
  }),
  component: BrandProfilePage,
});

type BrandProfile = {
  id?: string;
  brand_name: string;
  industry: string;
  personality: string;
  target_audience: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  heading_font: string;
  body_font: string;
  voice_tone: string;
  writing_style: string;
  forbidden_phrases: string[];
  mandatory_elements: string[];
  restrictions: string[];
  legal_text: string;
  slogan: string;
  completed: boolean;
};

const EMPTY: BrandProfile = {
  brand_name: "",
  industry: "",
  personality: "",
  target_audience: "",
  primary_color: "#171717",
  secondary_color: "#ffffff",
  accent_color: "#9a3412",
  heading_font: "Instrument Serif",
  body_font: "Schibsted Grotesk",
  voice_tone: "",
  writing_style: "",
  forbidden_phrases: [],
  mandatory_elements: [],
  restrictions: [],
  legal_text: "",
  slogan: "",
  completed: false,
};

function BrandProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { lang } = useI18n();
  const es = lang === "es";

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["brand_profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as BrandProfile | null) ?? null;
    },
  });

  const [form, setForm] = useState<BrandProfile>(EMPTY);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (existing) setForm({ ...EMPTY, ...existing });
  }, [existing]);

  const update = <K extends keyof BrandProfile>(k: K, v: BrandProfile[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const saveMut = useMutation({
    mutationFn: async (markComplete: boolean) => {
      const payload = { ...form, user_id: user!.id, completed: markComplete || form.completed };
      const { error } = await supabase
        .from("brand_profiles")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: (_d, markComplete) => {
      qc.invalidateQueries({ queryKey: ["brand_profile"] });
      toast.success(markComplete ? (es ? "Perfil de marca guardado" : "Brand profile saved") : (es ? "Borrador guardado" : "Draft saved"));
      if (markComplete) navigate({ to: "/dashboard" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const STEPS = [
    { key: "identity", icon: Sparkles, label: es ? "Identidad" : "Identity" },
    { key: "visual", icon: Palette, label: es ? "Visual" : "Visual" },
    { key: "voice", icon: MessageSquare, label: es ? "Voz" : "Voice" },
    { key: "rules", icon: ShieldAlert, label: es ? "Reglas" : "Rules" },
  ];

  if (!user || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        {es ? "Cargando…" : "Loading…"}
      </div>
    );
  }

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="size-4" /> {es ? "Panel" : "Dashboard"}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-medium mb-3">
            {es ? "Brand Profile" : "Brand Profile"}
          </p>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight">
            {es ? "Define tu marca" : "Define your brand"}
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            {es
              ? "Estas directrices alimentarán todos tus banners. Cada respuesta se convierte en una regla que la IA respetará."
              : "These guidelines will feed every banner you generate. Each answer becomes a rule the AI will respect."}
          </p>
          <Link
            to="/brand/extract"
            className="inline-flex items-center gap-2 mt-5 text-sm text-accent hover:underline"
          >
            <Sparkles className="size-3.5" />
            {es ? "¿Tienes un PDF de brand guidelines? Extráelo con IA →" : "Have a brand guidelines PDF? Extract with AI →"}
          </Link>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const active = i === step;
              const done = i < step;
              return (
                <button
                  key={s.key}
                  onClick={() => setStep(i)}
                  className={`flex items-center gap-2 text-xs font-medium transition ${
                    active ? "text-foreground" : done ? "text-accent" : "text-muted-foreground/60"
                  }`}
                >
                  <span
                    className={`size-7 rounded-full flex items-center justify-center ring-1 transition ${
                      active
                        ? "bg-foreground text-background ring-foreground"
                        : done
                        ? "bg-accent/10 text-accent ring-accent/30"
                        : "bg-surface-muted ring-border"
                    }`}
                  >
                    {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                  </span>
                  <span className="hidden sm:inline uppercase tracking-wider">{s.label}</span>
                </button>
              );
            })}
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        {/* Step content */}
        <div className="bg-surface-muted/40 ring-1 ring-border rounded-2xl p-6 md:p-10">
          {step === 0 && <IdentityStep form={form} update={update} es={es} />}
          {step === 1 && <VisualStep form={form} update={update} es={es} />}
          {step === 2 && <VoiceStep form={form} update={update} es={es} />}
          {step === 3 && <RulesStep form={form} update={update} es={es} />}
        </div>

        {/* Footer actions */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="size-4" /> {es ? "Atrás" : "Back"}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => saveMut.mutate(false)}
              disabled={saveMut.isPending || !form.brand_name.trim()}
            >
              {es ? "Guardar borrador" : "Save draft"}
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !form.brand_name.trim()}>
                {es ? "Siguiente" : "Next"} <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={() => saveMut.mutate(true)}
                disabled={saveMut.isPending || !form.brand_name.trim()}
              >
                <Check className="size-4" />
                {saveMut.isPending
                  ? es ? "Guardando…" : "Saving…"
                  : es ? "Finalizar" : "Finish"}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- Steps ---------- */

type StepProps = {
  form: BrandProfile;
  update: <K extends keyof BrandProfile>(k: K, v: BrandProfile[K]) => void;
  es: boolean;
};

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

function IdentityStep({ form, update, es }: StepProps) {
  return (
    <Section
      title={es ? "Identidad de marca" : "Brand identity"}
      hint={es ? "Empieza por lo esencial: quién eres y a quién hablas." : "Start with the essentials: who you are and who you talk to."}
    >
      <Field label={es ? "Nombre de marca" : "Brand name"}>
        <Input
          value={form.brand_name}
          onChange={(e) => update("brand_name", e.target.value)}
          placeholder={es ? "Ej. Vellum Studio" : "e.g. Vellum Studio"}
        />
      </Field>
      <Field label={es ? "Industria" : "Industry"}>
        <Input
          value={form.industry}
          onChange={(e) => update("industry", e.target.value)}
          placeholder={es ? "Ej. Software B2B, moda sostenible…" : "e.g. B2B SaaS, sustainable fashion…"}
        />
      </Field>
      <Field
        label={es ? "Personalidad" : "Personality"}
        hint={es ? "3–5 adjetivos. Ej. minimalista, audaz, técnico." : "3–5 adjectives. e.g. minimal, bold, technical."}
      >
        <Input
          value={form.personality}
          onChange={(e) => update("personality", e.target.value)}
          placeholder={es ? "minimalista, audaz, cálida" : "minimal, bold, warm"}
        />
      </Field>
      <Field label={es ? "Audiencia objetivo" : "Target audience"}>
        <Textarea
          value={form.target_audience}
          onChange={(e) => update("target_audience", e.target.value)}
          placeholder={es ? "Diseñadores y marketers en startups…" : "Designers and marketers at startups…"}
          rows={3}
        />
      </Field>
    </Section>
  );
}

function VisualStep({ form, update, es }: StepProps) {
  return (
    <Section
      title={es ? "Sistema visual" : "Visual system"}
      hint={es ? "Los colores y tipografías que la IA aplicará por defecto." : "The colors and typography the AI will apply by default."}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ColorField label={es ? "Primario" : "Primary"} value={form.primary_color} onChange={(v) => update("primary_color", v)} />
        <ColorField label={es ? "Secundario" : "Secondary"} value={form.secondary_color} onChange={(v) => update("secondary_color", v)} />
        <ColorField label={es ? "Acento" : "Accent"} value={form.accent_color} onChange={(v) => update("accent_color", v)} />
      </div>
      <Field label={es ? "Tipografía de titulares" : "Heading font"}>
        <div className="flex items-center gap-3">
          <Type className="size-4 text-muted-foreground" />
          <Input value={form.heading_font} onChange={(e) => update("heading_font", e.target.value)} />
        </div>
      </Field>
      <Field label={es ? "Tipografía de cuerpo" : "Body font"}>
        <div className="flex items-center gap-3">
          <Type className="size-4 text-muted-foreground" />
          <Input value={form.body_font} onChange={(e) => update("body_font", e.target.value)} />
        </div>
      </Field>
    </Section>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2 bg-background ring-1 ring-border rounded-md p-1.5">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 rounded cursor-pointer bg-transparent border-0"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border-0 shadow-none focus-visible:ring-0 font-mono text-xs uppercase px-1"
        />
      </div>
    </div>
  );
}

function VoiceStep({ form, update, es }: StepProps) {
  return (
    <Section
      title={es ? "Voz y tono" : "Voice & tone"}
      hint={es ? "Cómo escribe tu marca. Los titulares generados seguirán estas reglas." : "How your brand writes. Generated headlines will follow these rules."}
    >
      <Field label={es ? "Tono" : "Tone"}>
        <Input
          value={form.voice_tone}
          onChange={(e) => update("voice_tone", e.target.value)}
          placeholder={es ? "Directo, optimista, sin jerga" : "Direct, optimistic, no jargon"}
        />
      </Field>
      <Field label={es ? "Estilo de escritura" : "Writing style"}>
        <Textarea
          value={form.writing_style}
          onChange={(e) => update("writing_style", e.target.value)}
          placeholder={es ? "Frases cortas. Verbos en presente. Nunca usar signos de exclamación." : "Short sentences. Present tense verbs. Never use exclamation marks."}
          rows={4}
        />
      </Field>
      <Field label={es ? "Slogan" : "Slogan"}>
        <Input
          value={form.slogan}
          onChange={(e) => update("slogan", e.target.value)}
          placeholder={es ? "Tu tagline oficial" : "Your official tagline"}
        />
      </Field>
    </Section>
  );
}

function RulesStep({ form, update, es }: StepProps) {
  return (
    <Section
      title={es ? "Reglas y restricciones" : "Rules & restrictions"}
      hint={es ? "Una entrada por línea. Estas reglas bloquearán o forzarán contenido en tus banners." : "One entry per line. These rules will block or force content in your banners."}
    >
      <ListField
        label={es ? "Frases prohibidas" : "Forbidden phrases"}
        hint={es ? "Palabras o frases que nunca deben aparecer." : "Words or phrases that must never appear."}
        value={form.forbidden_phrases}
        onChange={(v) => update("forbidden_phrases", v)}
        placeholder={es ? "barato\ngratis\nrevolucionario" : "cheap\nfree\nrevolutionary"}
      />
      <ListField
        label={es ? "Elementos obligatorios" : "Mandatory elements"}
        hint={es ? "Lo que SIEMPRE debe aparecer (logo, descargo, etc.)." : "Things that must ALWAYS appear (logo, disclaimer, etc.)."}
        value={form.mandatory_elements}
        onChange={(v) => update("mandatory_elements", v)}
        placeholder={es ? "Logo en esquina inferior derecha\nDescargo legal en pie" : "Logo in bottom-right corner\nLegal disclaimer in footer"}
      />
      <ListField
        label={es ? "Restricciones visuales" : "Visual restrictions"}
        hint={es ? "Lo que NO puede aparecer en imágenes generadas." : "What CANNOT appear in generated imagery."}
        value={form.restrictions}
        onChange={(v) => update("restrictions", v)}
        placeholder={es ? "personas\nalcohol\ncompetencia" : "people\nalcohol\ncompetitors"}
      />
      <Field label={es ? "Texto legal" : "Legal text"}>
        <Textarea
          value={form.legal_text}
          onChange={(e) => update("legal_text", e.target.value)}
          placeholder={es ? "© 2026 Tu Marca. Todos los derechos reservados." : "© 2026 Your Brand. All rights reserved."}
          rows={3}
        />
      </Field>
    </Section>
  );
}

function ListField({
  label, hint, value, onChange, placeholder,
}: {
  label: string; hint?: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <Textarea
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
        placeholder={placeholder}
        rows={4}
        className="font-mono text-sm"
      />
    </Field>
  );
}
