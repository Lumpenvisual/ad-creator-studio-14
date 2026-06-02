import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback, type DragEvent, type ChangeEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  ArrowLeft, UploadCloud, FileCheck2, Trash2, ShieldCheck, Palette, Lock,
  Sparkles, Image as ImageIcon, FileText, Download, AlertTriangle, Info,
  LayoutGrid, BookOpen, SlidersHorizontal, MonitorSmartphone, CheckCircle2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getMyRoles } from "@/lib/events.functions";
import {
  listBrandAssets, upsertBrandAsset, deleteBrandAsset,
  getBrandRules, updateBrandRules,
  listCategoryRules,
} from "@/lib/governance.functions";

export const Route = createFileRoute("/admin/governance")({
  head: () => ({ meta: [{ title: "Gobernanza de Marca — Admin" }] }),
  component: GovernancePage,
});

const GREEN = "#006547";
const GREEN_DARK = "#004d34";

const ASSET_KINDS = [
  { kind: "logo_vertical",        label: "Logosímbolo Vertical",        hint: "Eventos solemnes y rituales de paso" },
  { kind: "logo_horizontal",      label: "Logosímbolo Horizontal",      hint: "Actividades académicas y de docencia" },
  { kind: "logotipo",             label: "Logotipo",                    hint: "Extensión, investigación y uniformes formativos" },
  { kind: "logotipo_simplificado",label: "Logotipo Simplificado",       hint: "Deporte recreativo y aplicaciones reducidas" },
  { kind: "manual_pdf",           label: "Manual de Marca (PDF)",       hint: "Documento de referencia institucional" },
] as const;

const NAV = [
  { id: "assets",     label: "Activos de Marca",     icon: LayoutGrid },
  { id: "rules",      label: "Reglas Institucionales", icon: ShieldCheck },
  { id: "categories", label: "Mapeador de Eventos",  icon: SlidersHorizontal },
  { id: "sandbox",    label: "Sandbox de Plantilla", icon: MonitorSmartphone },
] as const;
type TabId = (typeof NAV)[number]["id"];

function GovernancePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const rolesFn = useServerFn(getMyRoles);
  const [tab, setTab] = useState<TabId>("assets");

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ["my_roles", user?.id],
    enabled: !!user,
    queryFn: () => rolesFn(),
  });
  const canManage = !!rolesData?.roles?.some((r) => r === "admin" || r === "dev");

  if (!user) return null;

  if (!rolesLoading && !canManage) {
    return (
      <div className="min-h-screen bg-white text-neutral-900 grid place-content-center p-8">
        <Card className="p-8 max-w-md text-center border-neutral-200">
          <Lock className="size-8 mx-auto mb-3" style={{ color: GREEN }} />
          <h1 className="text-xl font-semibold mb-2">Acceso restringido</h1>
          <p className="text-sm text-neutral-600 mb-5">
            Este módulo es solo para administradores y desarrolladores.
          </p>
          <Button asChild variant="outline"><Link to="/events">Volver</Link></Button>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-neutral-50 text-neutral-900 flex">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white">
          <div className="h-16 px-5 flex items-center gap-3 border-b border-neutral-200">
            <div className="size-9 rounded-md grid place-content-center text-white font-serif text-lg"
                 style={{ background: GREEN }}>U</div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Gobernanza</p>
              <p className="text-[11px] uppercase tracking-wider text-neutral-500">Marca Institucional</p>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {NAV.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
                    active ? "text-white font-medium" : "text-neutral-700 hover:bg-neutral-100",
                  )}
                  style={active ? { background: GREEN } : undefined}
                >
                  <Icon className="size-4" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
          <div className="p-3 border-t border-neutral-200">
            <Link to="/events" className="flex items-center gap-2 text-xs text-neutral-600 hover:text-neutral-900 px-3 py-2">
              <ArrowLeft className="size-3.5" /> Volver al panel
            </Link>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          <header className="h-16 px-6 md:px-10 border-b border-neutral-200 bg-white flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] font-medium" style={{ color: GREEN }}>
                Admin · Manual de Marca
              </p>
              <h1 className="text-lg font-semibold leading-tight">
                {NAV.find((n) => n.id === tab)?.label}
              </h1>
            </div>
            <Badge variant="outline" className="border-neutral-300 text-neutral-700">
              Vigente
            </Badge>
          </header>

          {/* Mobile tabs */}
          <div className="md:hidden border-b border-neutral-200 bg-white p-3 overflow-x-auto">
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
              <TabsList>
                {NAV.map(({ id, label }) => <TabsTrigger key={id} value={id}>{label}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          </div>

          <div className="p-6 md:p-10 max-w-6xl">
            {tab === "assets"     && <AssetsTab />}
            {tab === "rules"      && <RulesTab />}
            {tab === "categories" && <CategoriesTab />}
            {tab === "sandbox"    && <SandboxTab />}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

/* ───────────────────────── ASSETS TAB ───────────────────────── */

type AssetRow = {
  id: string; kind: string; storage_path: string; file_name: string;
  file_size: number; mime_type: string | null; url: string | null;
};

function AssetsTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBrandAssets);
  const { data, isLoading } = useQuery({
    queryKey: ["brand_assets"],
    queryFn: () => listFn(),
  });
  const assets = (data?.assets ?? []) as AssetRow[];
  const byKind = useMemo(() => Object.fromEntries(assets.map((a) => [a.kind, a])), [assets]);

  return (
    <div>
      <p className="text-sm text-neutral-600 max-w-2xl mb-8">
        Sube cada variante oficial del manual. Estos archivos alimentan la plantilla del creador y
        no pueden ser sustituidos por versiones no aprobadas.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {ASSET_KINDS.map((a) => (
          <AssetDropzone
            key={a.kind}
            kind={a.kind}
            label={a.label}
            hint={a.hint}
            current={byKind[a.kind]}
            onChanged={() => qc.invalidateQueries({ queryKey: ["brand_assets"] })}
          />
        ))}
      </div>

      {isLoading && <div className="mt-6 flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="size-4 animate-spin" /> Cargando…</div>}
    </div>
  );
}

function AssetDropzone({
  kind, label, hint, current, onChanged,
}: { kind: string; label: string; hint: string; current?: AssetRow; onChanged: () => void }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const upsertFn = useServerFn(upsertBrandAsset);
  const delFn = useServerFn(deleteBrandAsset);

  const accept = kind === "manual_pdf"
    ? "application/pdf"
    : "image/png,image/jpeg,image/svg+xml,image/webp";

  const upload = useCallback(async (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Archivo demasiado grande (máx 15 MB)");
      return;
    }
    if (!file.type.match(/^(image\/|application\/pdf)/)) {
      toast.error("Formato no permitido");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${kind}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("brand-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      await upsertFn({
        data: {
          kind: kind as any,
          storage_path: path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
        },
      });
      toast.success(`${label} actualizado`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setBusy(false);
    }
  }, [kind, label, upsertFn, onChanged]);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files?.[0]; if (f) upload(f);
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) upload(f);
  };

  const remove = async () => {
    if (!confirm(`¿Eliminar ${label}?`)) return;
    setBusy(true);
    try { await delFn({ data: { kind: kind as any } }); toast.success("Eliminado"); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    finally { setBusy(false); }
  };

  const isImage = current?.mime_type?.startsWith("image/");
  const isPdf = kind === "manual_pdf";

  return (
    <Card className="p-5 border-neutral-200 bg-white">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            {isPdf ? <FileText className="size-4" style={{ color: GREEN }} /> : <ImageIcon className="size-4" style={{ color: GREEN }} />}
            <h3 className="font-medium text-sm">{label}</h3>
          </div>
          <p className="text-xs text-neutral-500 mt-1">{hint}</p>
        </div>
        {current && (
          <Badge style={{ background: `${GREEN}15`, color: GREEN_DARK }} className="border-0">
            <CheckCircle2 className="size-3 mr-1" /> Cargado
          </Badge>
        )}
      </div>

      {current ? (
        <div className="rounded-lg border border-neutral-200 overflow-hidden">
          <div className="aspect-[16/9] bg-neutral-50 grid place-content-center p-4">
            {isImage && current.url ? (
              <img src={current.url} alt={label} className="max-h-full max-w-full object-contain" />
            ) : (
              <div className="text-center">
                <FileText className="size-10 mx-auto text-neutral-400" />
                <p className="text-xs text-neutral-500 mt-2">PDF</p>
              </div>
            )}
          </div>
          <div className="px-3 py-2.5 flex items-center justify-between gap-2 bg-white border-t border-neutral-200">
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{current.file_name}</p>
              <p className="text-[11px] text-neutral-500">{(current.file_size / 1024).toFixed(1)} KB</p>
            </div>
            <div className="flex items-center gap-1">
              {current.url && (
                <a href={current.url} target="_blank" rel="noreferrer"
                   className="size-8 grid place-content-center rounded hover:bg-neutral-100">
                  <Download className="size-3.5" />
                </a>
              )}
              <label className="size-8 grid place-content-center rounded hover:bg-neutral-100 cursor-pointer">
                <UploadCloud className="size-3.5" />
                <input type="file" className="hidden" accept={accept} onChange={onPick} disabled={busy} />
              </label>
              <button onClick={remove} disabled={busy}
                className="size-8 grid place-content-center rounded hover:bg-red-50 text-red-600">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          className={cn(
            "block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
            drag ? "bg-emerald-50" : "border-neutral-200 hover:border-neutral-300",
          )}
          style={drag ? { borderColor: GREEN } : undefined}
        >
          {busy ? (
            <Loader2 className="size-6 animate-spin mx-auto" style={{ color: GREEN }} />
          ) : (
            <>
              <UploadCloud className="size-6 mx-auto text-neutral-400" />
              <p className="text-sm mt-2">Arrastra aquí o <span style={{ color: GREEN }} className="font-medium">selecciona</span></p>
              <p className="text-[11px] text-neutral-500 mt-1">
                {isPdf ? "PDF · máx 15 MB" : "PNG, JPG, SVG, WEBP · máx 15 MB"}
              </p>
            </>
          )}
          <input type="file" className="hidden" accept={accept} onChange={onPick} disabled={busy} />
        </label>
      )}
    </Card>
  );
}

/* ───────────────────────── RULES TAB ───────────────────────── */

const ALL_COLORS = [
  { name: "Verde Institucional", hex: GREEN, locked: true },
  { name: "Blanco", hex: "#FFFFFF", locked: true },
  { name: "Negro", hex: "#111111", locked: true },
  { name: "Gris", hex: "#9CA3AF" },
  { name: "Dorado", hex: "#C7A14A" },
];

function RulesTab() {
  const qc = useQueryClient();
  const getFn = useServerFn(getBrandRules);
  const updFn = useServerFn(updateBrandRules);
  const { data } = useQuery({ queryKey: ["brand_rules"], queryFn: () => getFn() });
  const rules = data?.rules;

  const [colors, setColors] = useState<string[]>([]);
  const [noAlt, setNoAlt] = useState(true);
  const [tm, setTm] = useState(true);

  useEffect(() => {
    if (rules) {
      setColors(rules.allowed_colors as string[]);
      setNoAlt(rules.no_alteration);
      setTm(rules.require_trademark);
    }
  }, [rules]);

  const lockedColors = ALL_COLORS.filter((c) => c.locked).map((c) => c.name);

  const toggleColor = (name: string) => {
    if (lockedColors.includes(name)) return;
    setColors((p) => p.includes(name) ? p.filter((c) => c !== name) : [...p, name]);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!rules) return;
      const merged = Array.from(new Set([...lockedColors, ...colors]));
      await updFn({ data: { id: rules.id, allowed_colors: merged, no_alteration: noAlt, require_trademark: tm } });
    },
    onSuccess: () => { toast.success("Reglas actualizadas"); qc.invalidateQueries({ queryKey: ["brand_rules"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (!rules) return <div className="text-sm text-neutral-500"><Loader2 className="size-4 animate-spin inline mr-2" />Cargando reglas…</div>;

  return (
    <div className="max-w-3xl space-y-8">
      <Card className="p-6 border-neutral-200 bg-white">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="size-4" style={{ color: GREEN }} />
          <h2 className="font-semibold">Paleta institucional permitida</h2>
        </div>
        <p className="text-xs text-neutral-500 mb-5">
          Los tres colores institucionales están bloqueados. Puedes habilitar acentos secundarios.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ALL_COLORS.map((c) => {
            const checked = colors.includes(c.name) || c.locked;
            return (
              <Tooltip key={c.name}>
                <TooltipTrigger asChild>
                  <label className={cn(
                    "flex items-center gap-3 p-3 rounded-md border transition-colors",
                    checked ? "border-neutral-300 bg-neutral-50" : "border-neutral-200 hover:bg-neutral-50",
                    c.locked && "cursor-not-allowed opacity-90",
                  )}>
                    <Checkbox checked={checked} disabled={c.locked} onCheckedChange={() => toggleColor(c.name)} />
                    <span className="size-5 rounded border border-neutral-300" style={{ background: c.hex }} />
                    <span className="text-sm flex-1">{c.name}</span>
                    {c.locked && <Lock className="size-3 text-neutral-400" />}
                  </label>
                </TooltipTrigger>
                {c.locked && (
                  <TooltipContent>Color institucional obligatorio según manual.</TooltipContent>
                )}
              </Tooltip>
            );
          })}
        </div>
      </Card>

      <Card className="p-6 border-neutral-200 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="size-4" style={{ color: GREEN }} />
          <h2 className="font-semibold">Restricciones de uso</h2>
        </div>
        <div className="space-y-4">
          <RuleSwitch
            checked={noAlt} onChange={setNoAlt}
            title="Integridad del logosímbolo"
            description="No está permitido alterar, distorsionar o modificar las proporciones del logosímbolo."
          />
          <RuleSwitch
            checked={tm} onChange={setTm}
            title="Símbolo ® en merchandising"
            description="El uso en prendas de vestir, obsequios o productos publicitarios DEBE incluir el signo de marca registrada ®."
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending}
          style={{ background: GREEN, color: "white" }} className="hover:opacity-90">
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Guardar reglas
        </Button>
      </div>
    </div>
  );
}

function RuleSwitch({ checked, onChange, title, description }: {
  checked: boolean; onChange: (v: boolean) => void; title: string; description: string;
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-md border border-neutral-200">
      <div className="flex-1">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-neutral-600 mt-1">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/* ─────────────────────── CATEGORIES TAB ─────────────────────── */

type CatRow = {
  id: string; category: string; subcategory: string | null;
  required_logo: string; require_trademark: boolean;
  description: string | null; sort_order: number; active: boolean;
};

function CategoriesTab() {
  const listFn = useServerFn(listCategoryRules);
  const { data, isLoading } = useQuery({ queryKey: ["category_rules"], queryFn: () => listFn() });
  const rows = (data?.rows ?? []) as CatRow[];

  return (
    <div className="space-y-4">
      <Card className="p-0 border-neutral-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-wider">Categoría</th>
                <th className="px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-wider">Subcategoría</th>
                <th className="px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-wider">Logo obligatorio</th>
                <th className="px-4 py-3 font-medium text-neutral-600 text-xs uppercase tracking-wider">®</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-neutral-500"><Loader2 className="size-4 animate-spin inline mr-2" />Cargando…</td></tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-medium">{r.category}</td>
                  <td className="px-4 py-3 text-neutral-600">{r.subcategory ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" style={{ borderColor: GREEN, color: GREEN_DARK }}>
                      {logoLabel(r.required_logo)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {r.require_trademark
                      ? <span style={{ color: GREEN }} className="font-semibold">®</span>
                      : <span className="text-neutral-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-neutral-500 flex items-center gap-1.5">
        <Info className="size-3.5" /> Matriz oficial sembrada desde el manual. La edición avanzada estará disponible en una próxima iteración.
      </p>
    </div>
  );
}

function logoLabel(k: string) {
  return ASSET_KINDS.find((a) => a.kind === k)?.label ?? k;
}

/* ─────────────────────── SANDBOX TAB ─────────────────────── */

function SandboxTab() {
  const listAssetsFn = useServerFn(listBrandAssets);
  const listCatsFn = useServerFn(listCategoryRules);
  const { data: assetsData } = useQuery({ queryKey: ["brand_assets"], queryFn: () => listAssetsFn() });
  const { data: catsData } = useQuery({ queryKey: ["category_rules"], queryFn: () => listCatsFn() });
  const assets = (assetsData?.assets ?? []) as AssetRow[];
  const cats = (catsData?.rows ?? []) as CatRow[];

  const [catId, setCatId] = useState<string>("");
  const [bg, setBg] = useState<"#FFFFFF" | "#006547" | "#111111">("#FFFFFF");

  const cat = cats.find((c) => c.id === catId);
  const asset = cat ? assets.find((a) => a.kind === cat.required_logo) : null;

  const contrastOk = useMemo(() => {
    if (!cat) return true;
    // Greens on green = warn
    if (bg === "#006547" && cat.required_logo !== "logotipo_simplificado") return false;
    return true;
  }, [bg, cat]);

  const isPhysical = cat?.category?.toLowerCase().includes("merchandising") || cat?.category?.toLowerCase().includes("prendas");

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      {/* Canvas */}
      <Card className="p-6 border-neutral-200 bg-white">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Sparkles className="size-4" style={{ color: GREEN }} />
              Vista previa dinámica
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Simula la plantilla final que verá el creador.
            </p>
          </div>
          <Button variant="outline" disabled={!cat}>
            <Download className="size-4" /> Descargar
          </Button>
        </div>

        <div className="aspect-[4/3] rounded-xl border border-neutral-200 grid place-content-center relative overflow-hidden transition-colors"
             style={{ background: bg }}>
          {!cat ? (
            <p className="text-sm" style={{ color: bg === "#FFFFFF" ? "#9CA3AF" : "#FFFFFF99" }}>
              Selecciona una categoría para previsualizar
            </p>
          ) : asset?.url ? (
            <div className="text-center px-8 animate-fade-in">
              <div className="relative inline-block">
                <img src={asset.url} alt="" className="max-h-40 mx-auto object-contain"
                     style={{ filter: bg === "#111111" ? "invert(1)" : undefined }} />
                {cat.require_trademark && (
                  <span className="absolute -top-1 -right-3 text-xs font-semibold"
                        style={{ color: bg === "#FFFFFF" ? GREEN_DARK : "#FFFFFF" }}>®</span>
                )}
              </div>
              <p className="mt-4 text-xs uppercase tracking-wider"
                 style={{ color: bg === "#FFFFFF" ? "#6B7280" : "#FFFFFFCC" }}>
                {cat.category}{cat.subcategory ? ` · ${cat.subcategory}` : ""}
              </p>
            </div>
          ) : (
            <div className="text-center">
              <AlertTriangle className="size-8 mx-auto text-amber-500" />
              <p className="text-sm mt-2">Falta cargar {logoLabel(cat.required_logo)}</p>
              <p className="text-xs text-neutral-500">Súbelo en la pestaña <b>Activos</b>.</p>
            </div>
          )}
        </div>

        {cat && !contrastOk && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-900">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>Contraste insuficiente: este logo no debe ir sobre fondo verde institucional. Cambia el color base.</span>
          </div>
        )}
      </Card>

      {/* Controls */}
      <div className="space-y-5">
        <Card className="p-5 border-neutral-200 bg-white">
          <Label className="text-xs uppercase tracking-wider text-neutral-600">Tipo de evento</Label>
          <Select value={catId} onValueChange={setCatId}>
            <SelectTrigger className="mt-2"><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
            <SelectContent>
              {cats.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.category}{c.subcategory ? ` — ${c.subcategory}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {cat && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="mt-4 p-3 rounded-md text-xs flex items-start gap-2 cursor-help"
                     style={{ background: `${GREEN}10`, color: GREEN_DARK }}>
                  <Lock className="size-3.5 mt-0.5 shrink-0" />
                  <span>
                    Regla institucional: <b>{cat.category}</b> requiere estrictamente
                    el uso de <b>{logoLabel(cat.required_logo)}</b>
                    {cat.require_trademark && <> con el símbolo <b>®</b></>}.
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Determinado por el manual de marca. Solo el admin puede modificar esta asignación.
              </TooltipContent>
            </Tooltip>
          )}
        </Card>

        <Card className="p-5 border-neutral-200 bg-white">
          <Label className="text-xs uppercase tracking-wider text-neutral-600">Color base</Label>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {([
              { hex: "#FFFFFF", name: "Blanco" },
              { hex: "#006547", name: "Verde" },
              { hex: "#111111", name: "Negro" },
            ] as const).map((c) => (
              <button
                key={c.hex}
                onClick={() => setBg(c.hex)}
                className={cn(
                  "h-14 rounded-md border-2 transition-all flex items-end p-2",
                  bg === c.hex ? "ring-2 ring-offset-2" : "border-neutral-200 hover:border-neutral-300",
                )}
                style={{
                  background: c.hex,
                  borderColor: bg === c.hex ? GREEN : undefined,
                  // @ts-expect-error ring color via inline style
                  "--tw-ring-color": GREEN,
                }}
              >
                <span className="text-[10px] font-medium"
                  style={{ color: c.hex === "#FFFFFF" ? "#111" : "#fff" }}>{c.name}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-500 mt-3">
            Solo se permiten colores institucionales aprobados.
          </p>
        </Card>

        {isPhysical && cat && (
          <Card className="p-4 border-neutral-200 bg-white">
            <div className="flex items-center gap-2 text-xs">
              <BookOpen className="size-3.5" style={{ color: GREEN }} />
              <span className="font-medium">Pieza física: {cat.subcategory ?? cat.category}</span>
            </div>
            <p className="text-xs text-neutral-600 mt-1.5">
              Se aplica automáticamente el símbolo <b>®</b> y se restringe la base a colores aprobados.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
