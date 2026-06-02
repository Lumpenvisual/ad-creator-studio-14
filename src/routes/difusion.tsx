import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, type DragEvent, type ChangeEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Calendar, Clock, Mail, MapPin, Users, Image as ImageIcon,
  Upload, FileCheck2, Megaphone, Mail as MailIcon, GraduationCap, Instagram, Linkedin,
  Facebook, Twitter, MessageCircle, Sparkles, Mic2, Loader2,
  Newspaper, ShieldAlert, Tag, Award, BookOpen, Lightbulb, ShoppingBag, Lock, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { createEvent, generateEventContent } from "@/lib/events.functions";
import { listCategoryRules } from "@/lib/governance.functions";

export const Route = createFileRoute("/difusion")({
  head: () => ({ meta: [{ title: "Solicitud de Difusión para Eventos" }] }),
  component: DifusionPage,
});

type Audience = "Estudiantes" | "Docentes" | "Egresados" | "Público general / Externo";
type Tone = "academico" | "formativo" | "networking";

type FormState = {
  email: string;
  eventName: string;
  category: string;
  date: string;
  time: string;
  location: string;
  audience: Audience | "";
  imageStatus: "need" | "have" | "";
  file: File | null;
  channels: string[];
  tone: Tone | "";
  speaker: string;
};

const INITIAL: FormState = {
  email: "", eventName: "", category: "", date: "", time: "", location: "", audience: "",
  imageStatus: "", file: null, channels: [], tone: "", speaker: "",
};

const STEPS = ["Lo Esencial", "Visuales", "Canales", "IA"];

const CATEGORIES = [
  { value: "rituales", label: "Rituales de paso (Honoris Causa, Homenajes, Diplomas)", icon: Award },
  { value: "academicas", label: "Actividades académicas y de docencia (Admisiones, Ofertas, Certificados)", icon: BookOpen },
  { value: "extension", label: "Actividades de Extensión e Investigación (Congresos, Seminarios, Foros)", icon: Lightbulb },
  { value: "promocionales", label: "Prendas de vestir y productos promocionales (Gorra, Termo, Uniformes)", icon: ShoppingBag },
];

const LOGO_KIND_LABEL: Record<string, string> = {
  logo_vertical: "Logosímbolo Vertical",
  logo_horizontal: "Logosímbolo Horizontal",
  logotipo: "Logotipo",
  logotipo_simplificado: "Logotipo Simplificado",
};

// Map UI category to DB row (best-effort by string match)
function findCategoryRule(rows: Array<{ category: string; required_logo: string; require_trademark: boolean; description: string | null }>, ui: string) {
  if (!ui) return null;
  const tests: Record<string, RegExp> = {
    rituales: /ritual/i,
    academicas: /acad[eé]mic/i,
    extension: /extensi[oó]n|investig/i,
    promocionales: /prenda|merchand|promocional/i,
  };
  const re = tests[ui];
  if (!re) return null;
  return rows.find((r) => re.test(r.category)) ?? null;
}

function DifusionPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const createFn = useServerFn(createEvent);
  const genFn = useServerFn(generateEventContent);
  const listCats = useServerFn(listCategoryRules);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const { data: catData } = useQuery({
    queryKey: ["category-rules"],
    queryFn: () => listCats(),
    enabled: !!user,
  });
  const categoryRows = catData?.rows ?? [];

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);

  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v })), []);

  const toggleChannel = (c: string) =>
    set("channels", form.channels.includes(c) ? form.channels.filter((x) => x !== c) : [...form.channels, c]);

  const stepValid = useMemo(() => {
    if (step === 0) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
      return emailOk && form.eventName.trim() && form.category && form.date && form.time && form.location.trim() && form.audience;
    }
    if (step === 1) return form.imageStatus === "need" || (form.imageStatus === "have" && form.file);
    if (step === 2) return form.channels.length > 0;
    if (step === 3) return !!form.tone;
    return false;
  }, [step, form]);

  const next = () => stepValid && setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const activeRule = useMemo(() => findCategoryRule(categoryRows as any, form.category), [categoryRows, form.category]);

  const submitMut = useMutation({
    mutationFn: async () => {
      // Sanitization: trim whitespace so live canvas alignment is preserved
      const cleanName = form.eventName.trim().replace(/\s+/g, " ");
      const cleanLocation = form.location.trim();
      const cleanSpeaker = form.speaker.trim();
      const cleanEmail = form.email.trim();
      const answers = {
        email: cleanEmail,
        category: form.category,
        category_label: CATEGORIES.find((c) => c.value === form.category)?.label ?? "",
        required_logo: activeRule?.required_logo ?? null,
        require_trademark: activeRule?.require_trademark ? "sí" : "no",
        date: form.date,
        time: form.time,
        location: cleanLocation,
        audience: form.audience,
        image_status: form.imageStatus,
        attached_file: form.file?.name ?? null,
        channels: form.channels.join(", "),
        tone: form.tone,
        speaker: cleanSpeaker || null,
      };
      const { id } = await createFn({ data: { name: cleanName, answers } });
      genFn({ data: { eventId: id } }).catch((e) => console.warn("Generación falló:", e));
      return { id, cleanName, cleanLocation };
    },
    onSuccess: ({ id, cleanName, cleanLocation }) => {
      toast.success("Solicitud creada — abriendo generador de banner");
      const map: Record<string, "rituales" | "academico" | "merchandising"> = {
        rituales: "rituales",
        academicas: "academico",
        extension: "academico",
        promocionales: "merchandising",
      };
      const eventType = map[form.category] ?? "rituales";
      const dateLabel = [form.date, form.time].filter(Boolean).join(" · ");
      navigate({
        to: "/banner-studio",
        search: {
          eventId: id,
          title: cleanName,
          date: dateLabel || undefined,
          place: cleanLocation || undefined,
          eventType,
          view: "creator",
        },
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error al enviar"),
  });

  const submitting = submitMut.isPending;
  const submit = () => submitMut.mutate();

  if (!user) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div
        className="min-h-screen relative overflow-hidden bg-[#fafaf7] text-neutral-900"
        style={{
          // Scope: institutional green palette for accent classes inside this page
          ["--accent" as any]: "0.42 0.10 161",
          ["--accent-foreground" as any]: "1 0 0",
        }}
      >
        {/* Top brand bar */}
        <div className="h-1.5 w-full bg-[#006547]" />

        <main className="max-w-7xl mx-auto px-5 sm:px-8 py-10 md:py-14">
          {/* Header */}
          <header className="mb-10 animate-fade-in max-w-3xl">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#006547] font-semibold mb-3">Difusión institucional</p>
            <h1 className="font-serif text-4xl md:text-5xl leading-[1.05] text-neutral-900">
              Solicitud de Difusión para Eventos
            </h1>
            <p className="mt-4 text-base text-neutral-600">
              ¡Hola! Completa este breve formulario para programar la difusión de tu evento.
            </p>

            <Card className="mt-6 p-5 md:p-6 border-l-4 border-l-[#006547] border-t border-r border-b border-emerald-900/10 bg-white shadow-sm rounded-lg">
              <div className="flex gap-4">
                <div className="shrink-0 size-10 rounded-full bg-[#006547]/10 grid place-content-center">
                  <Sparkles className="size-5 text-[#006547]" />
                </div>
                <p className="text-sm leading-relaxed text-neutral-700">
                  Al finalizar tu solicitud, nuestro sistema generará y te entregará los primeros insumos:
                  las <strong>piezas gráficas</strong> adaptadas a los canales que elijas y los <strong>textos (copys)</strong> listos
                  para cada publicación. <span className="text-[#006547] font-medium">¡Te tomará menos de 2 minutos!</span>
                </p>
              </div>
            </Card>
          </header>

          <div className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
            {/* Form column */}
            <div>
              {/* Progress */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="uppercase tracking-wider text-neutral-500">Paso {step + 1} de {STEPS.length}</span>
                  <span className="font-semibold text-[#006547]">{STEPS[step]}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-emerald-900/10 overflow-hidden">
                  <div
                    className="h-full bg-[#006547] transition-all duration-500 ease-out"
                    style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                  />
                </div>
                <div className="mt-4 hidden sm:flex justify-between">
                  {STEPS.map((s, i) => (
                    <div key={s} className={cn("text-[11px] uppercase tracking-wider transition-colors",
                      i <= step ? "text-neutral-900 font-semibold" : "text-neutral-400")}>
                      {i + 1}. {s}
                    </div>
                  ))}
                </div>
              </div>

              {/* Form card */}
              <Card className="p-7 md:p-10 glass-card-strong rounded-2xl overflow-hidden">
                <div key={step} className="step-slide-in">
                  {step === 0 && <Step1 form={form} set={set} />}
                  {step === 1 && <Step2 form={form} set={set} />}
                  {step === 2 && <Step3 form={form} toggle={toggleChannel} />}
                  {step === 3 && <Step4 form={form} set={set} />}
                </div>

                <div className="mt-10 pt-6 border-t border-neutral-100/80 flex items-center justify-between">
                  <Button variant="ghost" onClick={back} disabled={step === 0 || submitting} className="text-neutral-600 hover:text-neutral-900">
                    <ArrowLeft className="size-4" /> Atrás
                  </Button>
                  {step < STEPS.length - 1 ? (
                    <Button
                      onClick={next}
                      disabled={!stepValid}
                      className="bg-[#006547] hover:bg-[#004d34] text-white transition-transform hover:scale-[1.02]"
                    >
                      Siguiente <ArrowRight className="size-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={submit}
                      disabled={!stepValid || submitting}
                      className="bg-[#006547] hover:bg-[#004d34] text-white transition-transform hover:scale-[1.02]"
                    >
                      {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                      {submitting ? "Generando…" : "Generar Difusión"}
                    </Button>
                  )}
                </div>
              </Card>
            </div>

            {/* Live brand validation sidebar */}
            <aside className="lg:sticky lg:top-8">
              <BrandValidationPanel form={form} rule={activeRule} />
            </aside>
          </div>

          {submitting && <LoadingOverlay />}
        </main>
      </div>
    </TooltipProvider>
  );
}

/* ───────── Brand Validation Sidebar ───────── */

function BrandValidationPanel({
  form,
  rule,
}: {
  form: FormState;
  rule: { required_logo: string; require_trademark: boolean; description: string | null } | null;
}) {
  const cat = CATEGORIES.find((c) => c.value === form.category);
  const logoLabel = rule ? LOGO_KIND_LABEL[rule.required_logo] ?? rule.required_logo : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#006547] font-semibold">
        <ShieldAlert className="size-3.5" /> Validación de Marca
      </div>

      {/* Dynamic logo indicator */}
      <Card className="p-5 bg-white border border-neutral-200/80 rounded-xl shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs uppercase tracking-wider text-neutral-500">Logo designado</div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-neutral-400 hover:text-neutral-700">
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              Regla institucional: la categoría del evento determina automáticamente qué variante del logo se debe usar.
            </TooltipContent>
          </Tooltip>
        </div>

        {!cat ? (
          <p className="mt-3 text-sm text-neutral-500">
            Selecciona una categoría en el Paso 1 para ver la regla de marca aplicable.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Lock className="size-3.5 text-[#006547]" />
              {logoLabel ?? "Logo institucional"}
              {rule?.require_trademark && (
                <span className="ml-1 inline-flex items-center text-[10px] font-bold text-[#006547]">®</span>
              )}
            </div>

            {/* Inline rule text */}
            <p className="text-xs leading-relaxed text-neutral-600">
              {form.category === "rituales" && "Logosímbolo Vertical requerido de forma obligatoria."}
              {form.category === "academicas" && "Logosímbolo Horizontal requerido."}
              {form.category === "extension" && "Logotipo requerido de forma obligatoria."}
              {form.category === "promocionales" && "Logotipo / Logosímbolo Horizontal ® (requiere Marca Registrada)."}
            </p>

            {/* Mock placeholder using only allowed colors: verde institucional, blanco, negro */}
            <div className="mt-2 rounded-lg overflow-hidden border border-neutral-200">
              <div className="aspect-[4/3] bg-[#006547] relative">
                <div className="absolute inset-0 grid place-content-center text-center px-4">
                  <div className="text-white font-serif text-xl leading-tight">
                    {form.eventName || "Tu evento"}
                  </div>
                  <div className="text-[#006547] text-[10px] mt-3 inline-block bg-white px-2 py-1 rounded font-semibold tracking-wider uppercase mx-auto">
                    {logoLabel ?? "Logo"}
                    {rule?.require_trademark && <span className="ml-1">®</span>}
                  </div>
                </div>
                {/* Corner brand mark */}
                <div className="absolute top-2 right-2 size-6 rounded bg-white grid place-content-center">
                  <div className="size-3 rounded-sm bg-[#006547]" />
                </div>
              </div>
              <div className="bg-white px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500 flex items-center justify-between">
                <span>Preview · Solo colores permitidos</span>
                <div className="flex gap-1">
                  <span className="size-2.5 rounded-full bg-[#006547] border border-neutral-200" title="Verde Institucional" />
                  <span className="size-2.5 rounded-full bg-white border border-neutral-300" title="Blanco" />
                  <span className="size-2.5 rounded-full bg-black border border-neutral-200" title="Negro" />
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Rules checklist */}
      <Card className="p-5 bg-white border border-neutral-200/80 rounded-xl shadow-sm">
        <div className="text-xs uppercase tracking-wider text-neutral-500 mb-3">Reglas activas</div>
        <ul className="space-y-2 text-xs text-neutral-700">
          <li className="flex gap-2"><span className="text-[#006547]">•</span> Solo colores: Verde Institucional, Blanco, Negro.</li>
          <li className="flex gap-2"><span className="text-[#006547]">•</span> No alterar proporciones del logosímbolo.</li>
          <li className="flex gap-2"><span className="text-[#006547]">•</span> Conservar área de protección del logo.</li>
          {rule?.require_trademark && (
            <li className="flex gap-2 text-[#006547] font-medium"><span>•</span> Incluir símbolo ® obligatorio.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

/* ───────── Shared atoms ───────── */

function SectionTitle({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-[#006547]" />
        <h2 className="font-serif text-2xl text-neutral-900">{title}</h2>
      </div>
      {hint && <p className="text-sm text-neutral-500 mt-1">{hint}</p>}
    </div>
  );
}

function Field({ label, icon: Icon, children, required }: { label: string; icon?: React.ElementType; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5" />} {label}
        {required && <span className="text-[#006547]">*</span>}
      </Label>
      {children}
    </div>
  );
}

/* ───────── Steps ───────── */

function Step1({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <SectionTitle icon={Sparkles} title="Lo esencial del evento" hint="Información básica para coordinar la difusión." />

      <Field label="Email de contacto" icon={Mail} required>
        <Input type="email" placeholder="tu@correo.edu" value={form.email} onChange={(e) => set("email", e.target.value)} />
      </Field>

      <Field label="Nombre del evento" required>
        <Input placeholder="Ej. Conferencia Innovación 2026" value={form.eventName} onChange={(e) => set("eventName", e.target.value)} />
      </Field>

      <Field label="Categoría del evento" icon={Tag} required>
        <Select value={form.category} onValueChange={(v) => set("category", v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecciona la categoría que mejor describe tu evento" />
          </SelectTrigger>
          <SelectContent className="max-w-[var(--radix-select-trigger-width)]">
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                <div className="flex items-start gap-2 py-0.5">
                  <c.icon className="size-4 mt-0.5 text-[#006547] shrink-0" />
                  <span className="text-sm leading-snug">{c.label}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.category && (
          <p className="text-[11px] text-[#006547] mt-1 flex items-center gap-1.5">
            <Lock className="size-3" /> Esta categoría define automáticamente el logo institucional aplicable.
          </p>
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Fecha" icon={Calendar} required>
          <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="Hora de inicio" icon={Clock} required>
          <Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
        </Field>
      </div>

      <Field label="Ubicación o enlace de conexión" icon={MapPin} required>
        <Input placeholder="Aula 301 · o https://meet…" value={form.location} onChange={(e) => set("location", e.target.value)} />
      </Field>

      <Field label="Público objetivo" icon={Users} required>
        <RadioGroup value={form.audience} onValueChange={(v) => set("audience", v as Audience)} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(["Estudiantes", "Docentes", "Egresados", "Público general / Externo"] as Audience[]).map((a) => (
            <Label key={a} htmlFor={`a-${a}`}
              className={cn("flex items-center gap-3 rounded-lg border border-neutral-200 p-3 cursor-pointer transition-all hover:border-[#006547]/40 bg-white",
                form.audience === a && "border-[#006547] bg-[#006547]/5 ring-1 ring-[#006547]")}>
              <RadioGroupItem id={`a-${a}`} value={a} />
              <span className="text-sm">{a}</span>
            </Label>
          ))}
        </RadioGroup>
      </Field>
    </div>
  );
}

function Step2({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  const onFile = (f: File | null) => {
    if (f && f.size > 15 * 1024 * 1024) {
      toast.error("El archivo supera los 15 MB");
      return;
    }
    set("file", f);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    onFile(e.dataTransfer.files?.[0] ?? null);
  };
  return (
    <div className="space-y-6 animate-fade-in">
      <SectionTitle icon={ImageIcon} title="Necesidades visuales" hint="¿Necesitas que creemos la pieza o ya la tienes lista?" />

      {/* Brand manual warning */}
      <Card className="p-4 bg-amber-50/60 border border-amber-200 rounded-lg">
        <div className="flex gap-3">
          <ShieldAlert className="size-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 leading-relaxed">
            <strong>Recuerde:</strong> No está permitido alterar, distorsionar o modificar las proporciones
            del logosímbolo institucional. Toda pieza adjuntada será validada contra el manual de marca.
          </div>
        </div>
      </Card>

      <RadioGroup value={form.imageStatus} onValueChange={(v) => set("imageStatus", v as "need" | "have")} className="grid gap-3">
        {[
          { v: "need", t: "Necesito que elaboren la pieza gráfica.", d: "Nuestro agente IA generará las piezas para los canales seleccionados, cumpliendo el manual de marca." },
          { v: "have", t: "Ya tengo la pieza gráfica.", d: "La adjuntaré en el siguiente campo." },
        ].map((o) => (
          <Label key={o.v} htmlFor={`is-${o.v}`}
            className={cn("flex gap-3 rounded-xl border border-neutral-200 p-4 cursor-pointer transition-all hover:border-[#006547]/40 bg-white",
              form.imageStatus === o.v && "border-[#006547] bg-[#006547]/5 ring-1 ring-[#006547]")}>
            <RadioGroupItem id={`is-${o.v}`} value={o.v} className="mt-1" />
            <div>
              <div className="text-sm font-medium">{o.t}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{o.d}</div>
            </div>
          </Label>
        ))}
      </RadioGroup>

      {form.imageStatus === "have" && (
        <div className="animate-fade-in">
          <Field label="Adjunta tu pieza gráfica" icon={Upload}>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="relative rounded-xl border-2 border-dashed border-neutral-300 hover:border-[#006547]/60 transition-colors p-8 text-center bg-neutral-50/60"
            >
              {form.file ? (
                <div className="flex items-center justify-center gap-3 text-sm flex-wrap">
                  <FileCheck2 className="size-5 text-[#006547]" />
                  <span className="font-medium">{form.file.name}</span>
                  <span className="text-neutral-500">({(form.file.size / 1024 / 1024).toFixed(1)} MB)</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => set("file", null)}>Quitar</Button>
                </div>
              ) : (
                <>
                  <Upload className="size-8 mx-auto text-neutral-400 mb-2" />
                  <p className="text-sm text-neutral-700">Arrastra tu archivo aquí o</p>
                  <label className="inline-block mt-2 text-sm text-[#006547] font-medium cursor-pointer hover:underline">
                    selecciona desde tu equipo
                    <input type="file" className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => onFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <p className="text-xs text-neutral-500 mt-2">PNG, JPG o PDF · máx. 15 MB</p>
                </>
              )}
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}

const CHANNEL_GROUPS = [
  {
    label: "Canales tradicionales",
    icon: Newspaper,
    items: [
      { id: "boletin", label: "Boletín de la Facultad", icon: MailIcon },
      { id: "egresados", label: "Canales de Egresados", icon: GraduationCap },
    ],
  },
  {
    label: "Redes sociales",
    icon: Megaphone,
    items: [
      { id: "instagram", label: "Instagram", icon: Instagram },
      { id: "linkedin", label: "LinkedIn", icon: Linkedin },
      { id: "facebook", label: "Facebook", icon: Facebook },
      { id: "x", label: "X (antes Twitter)", icon: Twitter },
    ],
  },
  {
    label: "Mensajería directa",
    icon: MessageCircle,
    items: [{ id: "whatsapp", label: "Difusión por WhatsApp", icon: MessageCircle }],
  },
];

function Step3({ form, toggle }: { form: FormState; toggle: (c: string) => void }) {
  return (
    <div className="space-y-8 animate-fade-in">
      <SectionTitle icon={Megaphone} title="Canales de difusión" hint="Selecciona todos los que quieras activar." />
      {CHANNEL_GROUPS.map((g) => (
        <div key={g.label}>
          <div className="text-xs uppercase tracking-wider text-neutral-500 mb-3 flex items-center gap-2">
            <g.icon className="size-3.5" /> {g.label}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
            {g.items.map((it) => {
              const active = form.channels.includes(it.id);
              return (
                <Label key={it.id} htmlFor={`c-${it.id}`}
                  className={cn("flex items-center gap-3 rounded-lg border border-neutral-200 p-3 cursor-pointer transition-all hover:border-[#006547]/40 bg-white",
                    active && "border-[#006547] bg-[#006547]/5 ring-1 ring-[#006547]")}>
                  <Checkbox id={`c-${it.id}`} checked={active} onCheckedChange={() => toggle(it.id)} />
                  <it.icon className={cn("size-4", active ? "text-[#006547]" : "text-neutral-500")} />
                  <span className="text-sm">{it.label}</span>
                </Label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const TONES: { v: Tone; t: string; d: string; icon: React.ElementType }[] = [
  { v: "academico", t: "Académico / Magistral", d: "Formal y riguroso. Ideal para LinkedIn y boletines institucionales.", icon: BookOpen },
  { v: "formativo", t: "Formativo / Taller práctico", d: "Educativo y equilibrado. Resalta lo que se aprenderá.", icon: Lightbulb },
  { v: "networking", t: "Integración / Networking", d: "Cercano y dinámico. Genera comunidad y asistencia, con emojis.", icon: Sparkles },
];

function Step4({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <SectionTitle icon={Sparkles} title="Datos para el agente de IA" hint="Esto define el tono de los copys generados." />
      <Field label="Tono y objetivo" required>
        <RadioGroup value={form.tone} onValueChange={(v) => set("tone", v as Tone)} className="grid gap-3">
          {TONES.map((o) => (
            <Label key={o.v} htmlFor={`t-${o.v}`}
              className={cn("flex gap-3 rounded-xl border border-neutral-200 p-4 cursor-pointer transition-all hover:border-[#006547]/40 bg-white",
                form.tone === o.v && "border-[#006547] bg-[#006547]/5 ring-1 ring-[#006547]")}>
              <RadioGroupItem id={`t-${o.v}`} value={o.v} className="mt-1" />
              <o.icon className="size-4 mt-1 text-[#006547]" />
              <div>
                <div className="text-sm font-medium">{o.t}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{o.d}</div>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </Field>
      <Field label="Ponente o invitado especial" icon={Mic2}>
        <Input placeholder="Opcional · Ej. Dra. María Fernández" value={form.speaker} onChange={(e) => set("speaker", e.target.value)} />
      </Field>
    </div>
  );
}

/* ───────── Loading overlay ───────── */

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 grid place-content-center bg-white/70 backdrop-blur-md animate-fade-in">
      <Card className="px-10 py-12 max-w-md text-center glass-card-strong rounded-2xl">
        <div className="relative size-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-[#006547]/15" />
          <div className="absolute inset-0 rounded-full border-2 border-[#006547] border-t-transparent animate-spin" />
          <Sparkles className="absolute inset-0 m-auto size-6 text-[#006547]" />
        </div>
        <h3 className="font-serif text-2xl mb-2 text-neutral-900">Procesando…</h3>
        <p className="text-sm text-neutral-600 leading-relaxed mb-4">
          El Agente de IA está maquetando tus piezas según el manual de marca…
        </p>
        <div className="h-[2px] w-full rounded-full overflow-hidden bg-emerald-100/70 mt-2">
          <div className="sync-line h-full w-full" />
        </div>
        <p className="text-[11px] text-neutral-500 mt-3">Sincronizando con los activos del Manual de Marca</p>
      </Card>
    </div>
  );
}
