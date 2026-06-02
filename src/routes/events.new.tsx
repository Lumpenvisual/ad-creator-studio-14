import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listQuestionnaireFields, createEvent } from "@/lib/events.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Sparkles } from "lucide-react";

export const Route = createFileRoute("/events/new")({
  head: () => ({ meta: [{ title: "Nuevo evento — Vellum Studio" }] }),
  component: NewEventPage,
});

type Field = {
  id: string;
  field_key: string;
  label: string;
  hint: string | null;
  field_type: string;
  options: unknown;
  section: string;
  required: boolean;
  sort_order: number;
};

function NewEventPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const listFn = useServerFn(listQuestionnaireFields);
  const createFn = useServerFn(createEvent);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["questionnaire_fields"],
    enabled: !!user,
    queryFn: () => listFn(),
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setAnswers((p) => ({ ...p, [k]: v }));

  const fields = (data?.fields ?? []) as Field[];
  const eventName = answers.event_name?.trim() || "";

  const createMut = useMutation({
    mutationFn: async () => {
      const missing = fields.filter((f) => f.required && !answers[f.field_key]?.toString().trim());
      if (missing.length) throw new Error(`Faltan campos: ${missing.map((m) => m.label).join(", ")}`);
      return createFn({ data: { name: eventName || "Evento sin nombre", answers } });
    },
    onSuccess: (r) => {
      toast.success("Evento creado");
      navigate({ to: "/events/$id", params: { id: r.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (!user) return null;

  // Agrupar por sección
  const sections = fields.reduce<Record<string, Field[]>>((acc, f) => {
    (acc[f.section] ||= []).push(f); return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
          <Link to="/events" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Eventos
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-medium mb-2">Input</p>
          <h1 className="font-serif text-4xl md:text-5xl">Nuevo evento</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Completa el cuestionario. Estos datos se combinarán con tu perfil de marca para generar el contenido.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 bg-surface-muted rounded animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(sections).map(([section, fs]) => (
              <section key={section} className="bg-surface-muted/40 ring-1 ring-border rounded-2xl p-6 md:p-8">
                <h2 className="font-serif text-2xl mb-6 capitalize">{section}</h2>
                <div className="space-y-5">
                  {fs.map((f) => (
                    <div key={f.id} className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                        {f.label}{f.required && <span className="text-accent ml-1">*</span>}
                      </Label>
                      <FieldInput field={f} value={answers[f.field_key] ?? ""} onChange={(v) => set(f.field_key, v)} />
                      {f.hint && <p className="text-xs text-muted-foreground/70">{f.hint}</p>}
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <div className="flex items-center justify-end gap-3">
              <Button variant="ghost" asChild><Link to="/events">Cancelar</Link></Button>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !eventName}>
                <Sparkles className="size-4" />
                {createMut.isPending ? "Creando…" : "Crear y continuar"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: string; onChange: (v: string) => void }) {
  const opts = Array.isArray(field.options) ? (field.options as string[]) : [];
  switch (field.field_type) {
    case "textarea":
      return <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />;
    case "select":
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Elige una opción" /></SelectTrigger>
          <SelectContent>
            {opts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case "date":
      return <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <Input value={value} onChange={(e) => onChange(e.target.value)} />;
  }
}
