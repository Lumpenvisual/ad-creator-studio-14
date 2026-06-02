import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useCallback, type DragEvent, type ChangeEvent } from "react";
import {
  ArrowLeft, ArrowRight, Calendar, Clock, Mail, MapPin, Users, Image as ImageIcon,
  Upload, FileCheck2, Megaphone, Mail as MailIcon, GraduationCap, Instagram, Linkedin,
  Facebook, Twitter, MessageCircle, Sparkles, Mic2, CheckCircle2, Download, Loader2,
  PartyPopper, Newspaper,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/difusion")({
  head: () => ({ meta: [{ title: "Solicitud de Difusión para Eventos" }] }),
  component: DifusionPage,
});

type Audience = "Estudiantes" | "Docentes" | "Egresados" | "Público general / Externo";
type Tone = "academico" | "formativo" | "networking";

type FormState = {
  email: string;
  eventName: string;
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
  email: "", eventName: "", date: "", time: "", location: "", audience: "",
  imageStatus: "", file: null, channels: [], tone: "", speaker: "",
};

const STEPS = ["Lo Esencial", "Visuales", "Canales", "IA"];

function DifusionPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v })), []);

  const toggleChannel = (c: string) =>
    set("channels", form.channels.includes(c) ? form.channels.filter((x) => x !== c) : [...form.channels, c]);

  const stepValid = useMemo(() => {
    if (step === 0) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
      return emailOk && form.eventName.trim() && form.date && form.time && form.location.trim() && form.audience;
    }
    if (step === 1) return form.imageStatus === "need" || (form.imageStatus === "have" && form.file);
    if (step === 2) return form.channels.length > 0;
    if (step === 3) return !!form.tone;
    return false;
  }, [step, form]);

  const next = () => stepValid && setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 3000));
    setSubmitting(false);
    setDone(true);
  };

  if (done) return <ResultsDashboard form={form} onReset={() => { setForm(INITIAL); setStep(0); setDone(false); }} />;

  return (
    <div className="min-h-screen relative overflow-hidden bg-background text-foreground">
      {/* Ambient gradient */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 size-[520px] rounded-full blur-3xl opacity-40"
          style={{ background: "radial-gradient(circle, oklch(0.62 0.18 38 / 0.5), transparent 70%)" }} />
        <div className="absolute top-1/3 -right-40 size-[520px] rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle, oklch(0.55 0.14 250 / 0.5), transparent 70%)" }} />
      </div>

      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-12 md:py-16">
        {/* Header */}
        <header className="mb-10 animate-fade-in">
          <p className="text-[11px] uppercase tracking-[0.25em] text-accent font-medium mb-3">Difusión · Eventos</p>
          <h1 className="font-serif text-4xl md:text-5xl leading-[1.05]">Solicitud de Difusión para Eventos</h1>
          <p className="mt-4 text-base text-muted-foreground max-w-2xl">
            ¡Hola! Completa este breve formulario para programar la difusión de tu evento.
          </p>

          <Card className="mt-6 p-5 md:p-6 border-accent/20 bg-gradient-to-br from-accent/10 via-card to-card backdrop-blur-md shadow-sm">
            <div className="flex gap-4">
              <div className="shrink-0 size-10 rounded-full bg-accent/15 grid place-content-center">
                <Sparkles className="size-5 text-accent" />
              </div>
              <p className="text-sm leading-relaxed">
                Al finalizar tu solicitud, nuestro sistema generará y te entregará los primeros insumos:
                las <strong>piezas gráficas</strong> adaptadas a los canales que elijas y los <strong>textos (copys)</strong> listos
                para cada publicación. <span className="text-accent font-medium">¡Te tomará menos de 2 minutos!</span>
              </p>
            </div>
          </Card>
        </header>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="uppercase tracking-wider text-muted-foreground">Paso {step + 1} de {STEPS.length}</span>
            <span className="font-medium">{STEPS[step]}</span>
          </div>
          <Progress value={((step + 1) / STEPS.length) * 100} />
          <div className="mt-4 hidden sm:flex justify-between">
            {STEPS.map((s, i) => (
              <div key={s} className={cn("text-[11px] uppercase tracking-wider transition-colors",
                i <= step ? "text-foreground font-medium" : "text-muted-foreground/50")}>
                {i + 1}. {s}
              </div>
            ))}
          </div>
        </div>

        {/* Form card */}
        <Card className="p-6 md:p-10 backdrop-blur-xl bg-card/80 border-border shadow-xl shadow-accent/5 animate-fade-in">
          {step === 0 && <Step1 form={form} set={set} />}
          {step === 1 && <Step2 form={form} set={set} />}
          {step === 2 && <Step3 form={form} toggle={toggleChannel} />}
          {step === 3 && <Step4 form={form} set={set} />}

          <div className="mt-10 pt-6 border-t flex items-center justify-between">
            <Button variant="ghost" onClick={back} disabled={step === 0 || submitting}>
              <ArrowLeft className="size-4" /> Atrás
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next} disabled={!stepValid}>
                Siguiente <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={!stepValid || submitting} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {submitting ? "Procesando…" : "Generar piezas"}
              </Button>
            )}
          </div>
        </Card>

        {submitting && <LoadingOverlay />}
      </main>
    </div>
  );
}

/* ───────── Steps ───────── */

function SectionTitle({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-accent" />
        <h2 className="font-serif text-2xl">{title}</h2>
      </div>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Field({ label, icon: Icon, children, required }: { label: string; icon?: React.ElementType; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5" />} {label}
        {required && <span className="text-accent">*</span>}
      </Label>
      {children}
    </div>
  );
}

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
              className={cn("flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all hover:border-accent/50",
                form.audience === a && "border-accent bg-accent/5 ring-1 ring-accent")}>
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
    if (f && f.size > 15 * 1024 * 1024) return;
    set("file", f);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    onFile(e.dataTransfer.files?.[0] ?? null);
  };
  return (
    <div className="space-y-6 animate-fade-in">
      <SectionTitle icon={ImageIcon} title="Necesidades visuales" hint="¿Necesitas que creemos la pieza o ya la tienes lista?" />
      <RadioGroup value={form.imageStatus} onValueChange={(v) => set("imageStatus", v as "need" | "have")} className="grid gap-3">
        {[
          { v: "need", t: "Necesito que elaboren la pieza gráfica.", d: "Nuestro agente IA generará las piezas para los canales seleccionados." },
          { v: "have", t: "Ya tengo la pieza gráfica.", d: "La adjuntaré a continuación." },
        ].map((o) => (
          <Label key={o.v} htmlFor={`is-${o.v}`}
            className={cn("flex gap-3 rounded-xl border p-4 cursor-pointer transition-all hover:border-accent/50",
              form.imageStatus === o.v && "border-accent bg-accent/5 ring-1 ring-accent")}>
            <RadioGroupItem id={`is-${o.v}`} value={o.v} className="mt-1" />
            <div>
              <div className="text-sm font-medium">{o.t}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{o.d}</div>
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
              className="relative rounded-xl border-2 border-dashed border-border hover:border-accent/60 transition-colors p-8 text-center bg-surface-muted/40"
            >
              {form.file ? (
                <div className="flex items-center justify-center gap-3 text-sm">
                  <FileCheck2 className="size-5 text-accent" />
                  <span className="font-medium">{form.file.name}</span>
                  <span className="text-muted-foreground">({(form.file.size / 1024 / 1024).toFixed(1)} MB)</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => set("file", null)}>Quitar</Button>
                </div>
              ) : (
                <>
                  <Upload className="size-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm">Arrastra tu archivo aquí o</p>
                  <label className="inline-block mt-2 text-sm text-accent font-medium cursor-pointer hover:underline">
                    selecciona desde tu equipo
                    <input type="file" className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e: ChangeEvent<HTMLInputElement>) => onFile(e.target.files?.[0] ?? null)} />
                  </label>
                  <p className="text-xs text-muted-foreground mt-2">PNG, JPG o PDF · máx. 15 MB</p>
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
      { id: "x", label: "X (Twitter)", icon: Twitter },
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
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <g.icon className="size-3.5" /> {g.label}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {g.items.map((it) => {
              const active = form.channels.includes(it.id);
              return (
                <Label key={it.id} htmlFor={`c-${it.id}`}
                  className={cn("flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all hover:border-accent/50",
                    active && "border-accent bg-accent/5 ring-1 ring-accent")}>
                  <Checkbox id={`c-${it.id}`} checked={active} onCheckedChange={() => toggle(it.id)} />
                  <it.icon className="size-4 text-muted-foreground" />
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

const TONES: { v: Tone; t: string; d: string }[] = [
  { v: "academico", t: "Académico / Magistral", d: "Formal y riguroso. Ideal para LinkedIn, boletines institucionales." },
  { v: "formativo", t: "Formativo / Taller práctico", d: "Educativo y equilibrado. Resalta lo que se aprenderá." },
  { v: "networking", t: "Integración / Networking", d: "Cercano y dinámico. Genera comunidad y asistencia." },
];

function Step4({ form, set }: { form: FormState; set: <K extends keyof FormState>(k: K, v: FormState[K]) => void }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <SectionTitle icon={Sparkles} title="Datos para el agente de IA" hint="Esto define el tono de los copys generados." />
      <Field label="Tono y objetivo" required>
        <RadioGroup value={form.tone} onValueChange={(v) => set("tone", v as Tone)} className="grid gap-3">
          {TONES.map((o) => (
            <Label key={o.v} htmlFor={`t-${o.v}`}
              className={cn("flex gap-3 rounded-xl border p-4 cursor-pointer transition-all hover:border-accent/50",
                form.tone === o.v && "border-accent bg-accent/5 ring-1 ring-accent")}>
              <RadioGroupItem id={`t-${o.v}`} value={o.v} className="mt-1" />
              <div>
                <div className="text-sm font-medium">{o.t}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{o.d}</div>
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

/* ───────── Loading & Results ───────── */

function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 grid place-content-center bg-background/70 backdrop-blur-md animate-fade-in">
      <Card className="px-10 py-12 max-w-md text-center bg-card/90 border-accent/20 shadow-2xl">
        <div className="relative size-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-accent/20" />
          <div className="absolute inset-0 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <Sparkles className="absolute inset-0 m-auto size-6 text-accent" />
        </div>
        <h3 className="font-serif text-2xl mb-2">Generando…</h3>
        <p className="text-sm text-muted-foreground">
          El Agente de IA está procesando tus datos y generando las piezas…
        </p>
      </Card>
    </div>
  );
}

const COPIES: Record<Tone, { instagram: string; linkedin: string; whatsapp: string; email: string }> = {
  academico: {
    instagram: "Te invitamos a una jornada de reflexión académica sobre los desafíos contemporáneos. Inscripción abierta.",
    linkedin: "Tenemos el honor de convocar a la comunidad académica a una sesión magistral. Una oportunidad para profundizar en el estado del arte de la disciplina y dialogar con voces de referencia.",
    whatsapp: "Hola 👋 Te compartimos la convocatoria a nuestra próxima sesión académica. Cupos limitados.",
    email: "Estimada comunidad,\n\nTenemos el agrado de invitarles a una sesión académica con presencia de invitados destacados. Adjuntamos los detalles y enlace de inscripción.",
  },
  formativo: {
    instagram: "¿Quieres llevarte herramientas prácticas? Este taller es para ti 💡 ¡Apúntate!",
    linkedin: "Abrimos inscripciones a un taller práctico diseñado para fortalecer competencias clave. Metodología activa, casos reales y certificación al finalizar.",
    whatsapp: "Hola! Queremos contarte de un taller práctico que estamos organizando. ¿Te interesa participar?",
    email: "Hola,\n\nTe invitamos a un taller práctico pensado para llevarte aprendizajes accionables desde el primer día. Te dejamos el enlace para inscribirte.",
  },
  networking: {
    instagram: "¡Se viene algo grande! 🎉 Conoce gente, comparte ideas y pásala increíble con nosotros ✨ Te esperamos 👀",
    linkedin: "Un espacio pensado para conectar profesionales, expandir tu red y descubrir nuevas oportunidades. Te esperamos.",
    whatsapp: "Heyy 👋 Estamos armando un encuentro buenísimo y no te puedes perder. ¿Te apuntas? 🚀",
    email: "Hola!\n\nEstamos preparando un encuentro para conectar y crear comunidad. Será una tarde para compartir ideas y conocer gente nueva. ¡Cuento contigo!",
  },
};

const CHANNEL_META: Record<string, { label: string; icon: React.ElementType; format: string }> = {
  instagram: { label: "Instagram", icon: Instagram, format: "Post cuadrado 1080×1080" },
  linkedin: { label: "LinkedIn", icon: Linkedin, format: "Banner 1200×627" },
  facebook: { label: "Facebook", icon: Facebook, format: "Post 1200×630" },
  x: { label: "X (Twitter)", icon: Twitter, format: "Imagen 1600×900" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, format: "Story vertical 1080×1920" },
  boletin: { label: "Boletín", icon: MailIcon, format: "Header email 600×300" },
  egresados: { label: "Egresados", icon: GraduationCap, format: "Tarjeta 1080×1080" },
};

function ResultsDashboard({ form, onReset }: { form: FormState; onReset: () => void }) {
  const tone = (form.tone || "networking") as Tone;
  const copies = COPIES[tone];

  const copyMap: { channel: string; key: keyof typeof copies; icon: React.ElementType; label: string }[] = [
    { channel: "instagram", key: "instagram", icon: Instagram, label: "Instagram" },
    { channel: "linkedin", key: "linkedin", icon: Linkedin, label: "LinkedIn" },
    { channel: "whatsapp", key: "whatsapp", icon: MessageCircle, label: "WhatsApp" },
    { channel: "boletin", key: "email", icon: MailIcon, label: "Email / Boletín" },
  ].filter((c) => form.channels.includes(c.channel));

  const gradients = [
    "from-accent/30 via-accent/10 to-transparent",
    "from-indigo-500/30 via-indigo-500/10 to-transparent",
    "from-emerald-500/30 via-emerald-500/10 to-transparent",
    "from-rose-500/30 via-rose-500/10 to-transparent",
    "from-sky-500/30 via-sky-500/10 to-transparent",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-12 md:py-16 animate-fade-in">
        <div className="flex items-start gap-4 mb-10">
          <div className="size-12 rounded-full bg-accent/15 grid place-content-center shrink-0">
            <CheckCircle2 className="size-6 text-accent" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-accent font-medium mb-2 flex items-center gap-2">
              <PartyPopper className="size-3.5" /> ¡Listo!
            </p>
            <h1 className="font-serif text-4xl md:text-5xl leading-[1.05]">Tus piezas están preparadas</h1>
            <p className="mt-3 text-muted-foreground">
              Generamos los copys y los placeholders gráficos para <strong>{form.eventName || "tu evento"}</strong>. Revisa, descarga y publica.
            </p>
          </div>
        </div>

        {/* Copys */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl mb-5 flex items-center gap-2">
            <Sparkles className="size-5 text-accent" /> Copys generados
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {copyMap.length === 0 && <p className="text-sm text-muted-foreground">No seleccionaste canales con copy.</p>}
            {copyMap.map((c) => (
              <Card key={c.channel} className="p-5 bg-card/80 backdrop-blur-md">
                <div className="flex items-center gap-2 mb-3 text-sm font-medium">
                  <c.icon className="size-4 text-accent" /> {c.label}
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
                  {copies[c.key]}
                </p>
                <Button size="sm" variant="ghost" className="mt-3 -ml-2"
                  onClick={() => navigator.clipboard.writeText(copies[c.key])}>
                  Copiar texto
                </Button>
              </Card>
            ))}
          </div>
        </section>

        {/* Piezas gráficas */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl mb-5 flex items-center gap-2">
            <ImageIcon className="size-5 text-accent" /> Piezas gráficas
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {form.channels.map((ch, i) => {
              const meta = CHANNEL_META[ch];
              if (!meta) return null;
              return (
                <Card key={ch} className="overflow-hidden group hover:shadow-xl hover:-translate-y-0.5 transition-all bg-card/80 backdrop-blur-md">
                  <div className={cn("aspect-[4/3] bg-gradient-to-br relative", gradients[i % gradients.length])}>
                    <div className="absolute inset-0 grid place-content-center">
                      <meta.icon className="size-12 text-foreground/40" />
                    </div>
                    <div className="absolute bottom-3 left-3 text-[10px] uppercase tracking-wider text-foreground/60">
                      {meta.format}
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">Post para {meta.label}</div>
                      <div className="text-xs text-muted-foreground">{form.eventName || "Evento"}</div>
                    </div>
                    <Button size="sm" variant="outline">
                      <Download className="size-3.5" /> PNG
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <div className="flex items-center justify-between pt-6 border-t">
          <p className="text-xs text-muted-foreground">
            Enviado a <span className="text-foreground">{form.email}</span>
          </p>
          <Button variant="outline" onClick={onReset}>Crear otra solicitud</Button>
        </div>
      </main>
    </div>
  );
}
