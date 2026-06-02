import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAllQuestionnaireFields, upsertQuestionnaireField, deleteQuestionnaireField, getMyRoles,
} from "@/lib/events.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/questionnaire")({
  head: () => ({ meta: [{ title: "Admin — Cuestionario" }] }),
  component: AdminQuestionnairePage,
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
  active: boolean;
};

const TYPES = ["text", "textarea", "select", "date", "number"] as const;

function AdminQuestionnairePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const rolesFn = useServerFn(getMyRoles);
  const listFn = useServerFn(listAllQuestionnaireFields);
  const upsertFn = useServerFn(upsertQuestionnaireField);
  const delFn = useServerFn(deleteQuestionnaireField);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["my_roles", user?.id],
    enabled: !!user,
    queryFn: () => rolesFn(),
  });
  const isAdmin = rolesData?.roles?.includes("admin");

  const { data, isLoading } = useQuery({
    queryKey: ["all_questionnaire_fields"],
    enabled: !!user && !!isAdmin,
    queryFn: () => listFn(),
  });

  const upsertMut = useMutation({
    mutationFn: (f: Partial<Field> & { field_key: string; label: string; field_type: string }) => upsertFn({ data: f as any }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all_questionnaire_fields"] }); qc.invalidateQueries({ queryKey: ["questionnaire_fields"] }); toast.success("Guardado"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["all_questionnaire_fields"] }); qc.invalidateQueries({ queryKey: ["questionnaire_fields"] }); toast.success("Eliminado"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (!user || rolesLoading) return null;
  if (!isAdmin) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6">
      <p className="font-serif text-2xl">Solo administradores</p>
      <Button asChild variant="outline"><Link to="/events">Volver</Link></Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/events" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> Eventos
          </Link>
          <FieldDialog onSave={(f) => upsertMut.mutate(f)} trigger={
            <Button size="sm"><Plus className="size-4" /> Nuevo campo</Button>
          } />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-10">
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-medium mb-2">Admin</p>
          <h1 className="font-serif text-4xl md:text-5xl">Plantilla del cuestionario</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xl">
            Define los campos que cada usuario rellenará al crear un evento. Los cambios afectan a todos los usuarios.
          </p>
        </div>

        {isLoading ? <div className="text-sm text-muted-foreground">Cargando…</div> : (
          <ul className="space-y-2">
            {(data?.fields ?? []).map((f: Field) => (
              <li key={f.id} className="ring-1 ring-border rounded-xl px-5 py-4 flex items-center gap-4 bg-surface-muted/30">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{f.label}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-background px-1.5 py-0.5 rounded ring-1 ring-border">{f.field_type}</span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.section}</span>
                    {f.required && <span className="text-[10px] text-accent uppercase tracking-wider">obligatorio</span>}
                    {!f.active && <span className="text-[10px] text-muted-foreground">(inactivo)</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">{f.field_key} · orden {f.sort_order}</p>
                </div>
                <FieldDialog initial={f} onSave={(v) => upsertMut.mutate({ ...v, id: f.id })}
                  trigger={<Button variant="ghost" size="icon"><Pencil className="size-4" /></Button>} />
                <Button variant="ghost" size="icon"
                  onClick={() => { if (confirm(`¿Eliminar campo "${f.label}"?`)) delMut.mutate(f.id); }}>
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function FieldDialog({ initial, onSave, trigger }: {
  initial?: Field;
  onSave: (f: any) => void;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    field_key: initial?.field_key ?? "",
    label: initial?.label ?? "",
    hint: initial?.hint ?? "",
    field_type: initial?.field_type ?? "text",
    options: Array.isArray(initial?.options) ? (initial?.options as string[]).join("\n") : "",
    section: initial?.section ?? "general",
    required: initial?.required ?? false,
    sort_order: initial?.sort_order ?? 100,
    active: initial?.active ?? true,
  });

  const submit = () => {
    if (!form.field_key.match(/^[a-z0-9_]+$/)) {
      toast.error("La clave debe ser snake_case (a-z, 0-9, _)");
      return;
    }
    onSave({
      ...form,
      options: form.options.split("\n").map((s) => s.trim()).filter(Boolean),
      sort_order: Number(form.sort_order) || 0,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? "Editar campo" : "Nuevo campo"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Clave (snake_case)</Label>
              <Input value={form.field_key} onChange={(e) => setForm({ ...form, field_key: e.target.value.toLowerCase() })} disabled={!!initial} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Tipo</Label>
              <Select value={form.field_type} onValueChange={(v) => setForm({ ...form, field_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider">Etiqueta</Label>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider">Pista</Label>
            <Input value={form.hint} onChange={(e) => setForm({ ...form, hint: e.target.value })} />
          </div>
          {form.field_type === "select" && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Opciones (una por línea)</Label>
              <Textarea value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} rows={4} className="font-mono text-sm" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Sección</Label>
              <Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider">Orden</Label>
              <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.required} onCheckedChange={(v) => setForm({ ...form, required: v })} /> Obligatorio</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /> Activo</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>Guardar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
