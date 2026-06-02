import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listEvents, deleteEvent, getMyRoles, claimAdminIfFirst } from "@/lib/events.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, ExternalLink, Settings, ShieldCheck } from "lucide-react";
import { LanguageSwitcher } from "@/lib/i18n";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Eventos — Vellum Studio" },
      { name: "description", content: "Tus campañas y eventos generados." },
    ],
  }),
  component: EventsPage,
});

const STATUS_LABEL: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Borrador", tone: "outline" },
  generating: { label: "Generando…", tone: "secondary" },
  ready: { label: "Listo", tone: "default" },
  failed: { label: "Falló", tone: "destructive" },
};

function EventsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const listFn = useServerFn(listEvents);
  const delFn = useServerFn(deleteEvent);
  const rolesFn = useServerFn(getMyRoles);
  const claimFn = useServerFn(claimAdminIfFirst);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const { data: rolesData } = useQuery({
    queryKey: ["my_roles", user?.id],
    enabled: !!user,
    queryFn: () => rolesFn(),
  });
  const isAdmin = rolesData?.roles?.includes("admin");

  // Auto-promover al primer usuario como admin
  useEffect(() => {
    if (user && rolesData && !isAdmin) {
      claimFn().then((r) => {
        if (r.claimed) {
          toast.success("Eres el primer usuario: rol admin asignado");
          qc.invalidateQueries({ queryKey: ["my_roles"] });
        }
      }).catch(() => { /* ignore */ });
    }
  }, [user, rolesData, isAdmin, claimFn, qc]);

  const { data, isLoading } = useQuery({
    queryKey: ["events", user?.id],
    enabled: !!user,
    queryFn: () => listFn(),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); toast.success("Evento eliminado"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Panel
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            {isAdmin && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/questionnaire"><Settings className="size-4" /> Plantilla</Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/brand"><ShieldCheck className="size-4" /> Marca</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-medium mb-2">Input</p>
            <h1 className="font-serif text-4xl md:text-5xl">Eventos</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Cada evento alimenta el generador con datos específicos. La marca y las reglas se aplican automáticamente.
            </p>
          </div>
          <Button asChild>
            <Link to="/difusion"><Plus className="size-4" /> Nueva solicitud</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-surface-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !data?.events.length ? (
          <div className="text-center py-20 ring-1 ring-border rounded-2xl bg-surface-muted/30">
            <p className="font-serif text-2xl mb-2">Ningún evento todavía</p>
            <p className="text-sm text-muted-foreground mb-6">Crea tu primer evento para generar contenido.</p>
            <Button asChild><Link to="/events/new"><Plus className="size-4" /> Crear evento</Link></Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.events.map((e) => {
              const s = STATUS_LABEL[e.status] ?? STATUS_LABEL.draft;
              return (
                <li key={e.id} className="group ring-1 ring-border rounded-xl px-5 py-4 flex items-center gap-4 hover:bg-surface-muted/40 transition">
                  <Link to="/events/$id" params={{ id: e.id }} className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="font-medium truncate">{e.name}</span>
                      <Badge variant={s.tone}>{s.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Actualizado {new Date(e.updated_at).toLocaleString()}
                    </p>
                  </Link>
                  {e.drive_folder_url && (
                    <a href={e.drive_folder_url} target="_blank" rel="noreferrer"
                       className="text-xs text-accent hover:underline flex items-center gap-1">
                      Drive <ExternalLink className="size-3" />
                    </a>
                  )}
                  <Button variant="ghost" size="icon"
                    onClick={() => { if (confirm(`¿Eliminar "${e.name}"?`)) delMut.mutate(e.id); }}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
