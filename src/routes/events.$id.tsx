import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getEvent, generateEventContent } from "@/lib/events.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, ExternalLink, AlertTriangle, CheckCircle2, RotateCw } from "lucide-react";

export const Route = createFileRoute("/events/$id")({
  head: () => ({ meta: [{ title: "Evento — Vellum Studio" }] }),
  component: EventDetailPage,
});

function EventDetailPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const getFn = useServerFn(getEvent);
  const genFn = useServerFn(generateEventContent);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["event", id],
    enabled: !!user,
    queryFn: () => getFn({ data: { id } }),
    refetchInterval: (q) => q.state.data?.event?.status === "generating" ? 2000 : false,
  });

  const genMut = useMutation({
    mutationFn: () => genFn({ data: { eventId: id } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["event", id] });
      qc.invalidateQueries({ queryKey: ["events"] });
      if (r.passed) toast.success(`Generado en ${r.attempts} intento(s)`);
      else toast.warning(`No pasó las reglas tras ${r.attempts} intentos`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (!user || isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Cargando…</div>;
  if (!data?.event) return <div className="min-h-screen flex items-center justify-center">Evento no encontrado</div>;

  const ev = data.event;
  const outputs = data.outputs;
  const answers = (ev.answers ?? {}) as Record<string, unknown>;
  const isGenerating = ev.status === "generating" || genMut.isPending;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/events" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Eventos
          </Link>
          {ev.drive_folder_url && (
            <a href={ev.drive_folder_url} target="_blank" rel="noreferrer"
               className="text-xs text-accent hover:underline flex items-center gap-1">
              Abrir carpeta en Drive <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-medium mb-2">Evento</p>
            <h1 className="font-serif text-4xl md:text-5xl">{ev.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Estado: <Badge variant={ev.status === "ready" ? "default" : ev.status === "failed" ? "destructive" : "secondary"}>{ev.status}</Badge>
            </p>
          </div>
          <Button onClick={() => genMut.mutate()} disabled={isGenerating}>
            {isGenerating ? <RotateCw className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {isGenerating ? "Generando…" : outputs.length ? "Regenerar" : "Generar contenido"}
          </Button>
        </div>

        {ev.last_error && (
          <div className="mb-6 ring-1 ring-destructive/30 bg-destructive/5 text-destructive rounded-xl px-4 py-3 text-sm flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>{ev.last_error}</span>
          </div>
        )}

        <section className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="ring-1 ring-border rounded-2xl p-6 bg-surface-muted/30">
            <h2 className="font-serif text-xl mb-4">Datos del evento</h2>
            <dl className="space-y-3 text-sm">
              {Object.entries(answers).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</dt>
                  <dd className="text-foreground">{String(v) || "—"}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="ring-1 ring-border rounded-2xl p-6 bg-surface-muted/30">
            <h2 className="font-serif text-xl mb-4">Flujo</h2>
            <ol className="space-y-3 text-sm">
              <li className="flex items-center gap-3"><span className="size-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs">1</span> Cuestionario ✓</li>
              <li className="flex items-center gap-3"><span className="size-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs">2</span> Caja negra: tu perfil de marca aplica reglas</li>
              <li className="flex items-center gap-3"><span className="size-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs">3</span> Generación con reintentos automáticos si viola reglas</li>
              <li className="flex items-center gap-3"><span className="size-6 rounded-full bg-foreground text-background flex items-center justify-center text-xs">4</span> Subida del brief a Google Drive</li>
            </ol>
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl mb-6">Salidas generadas</h2>
          {!outputs.length ? (
            <div className="text-center py-16 ring-1 ring-border rounded-2xl bg-surface-muted/20 text-muted-foreground text-sm">
              Pulsa "Generar contenido" para producir titulares y cuerpos.
            </div>
          ) : (
            <div className="space-y-6">
              {outputs.map((o) => (
                <article key={o.id} className="ring-1 ring-border rounded-2xl p-6 bg-surface-muted/30">
                  <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Intento #{o.attempt_number}</span>
                      {o.passed_validation
                        ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="size-3.5" /> Validado</span>
                        : <span className="text-destructive flex items-center gap-1"><AlertTriangle className="size-3.5" /> Con advertencias</span>}
                      <span>· {new Date(o.created_at).toLocaleString()}</span>
                    </div>
                    {o.drive_file_url && (
                      <a href={o.drive_file_url} target="_blank" rel="noreferrer"
                         className="text-xs text-accent hover:underline flex items-center gap-1">
                        Ver brief en Drive <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>

                  {o.validation_warnings?.length > 0 && (
                    <ul className="mb-4 text-xs text-destructive space-y-1">
                      {o.validation_warnings.map((w: string, i: number) => <li key={i}>• {w}</li>)}
                    </ul>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Titulares</h3>
                      <ul className="space-y-2">
                        {(o.headlines ?? []).map((h: string, i: number) => (
                          <li key={i} className="font-serif text-lg leading-snug">{h}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-3">Cuerpos</h3>
                      <ul className="space-y-3 text-sm">
                        {(o.bodies ?? []).map((b: string, i: number) => (
                          <li key={i} className="pl-3 border-l-2 border-accent/40">{b}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
