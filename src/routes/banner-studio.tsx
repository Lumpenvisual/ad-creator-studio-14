import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback, type DragEvent, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  ArrowLeft, UploadCloud, FileCheck2, Trash2, ShieldCheck, Lock, CheckCircle2,
  Sparkles, Image as ImageIcon, FileText, Download, Loader2, Palette,
  LayoutTemplate, Users, Wand2, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getMyRoles } from "@/lib/events.functions";
import { listBrandAssets, upsertBrandAsset, deleteBrandAsset, listCategoryRules } from "@/lib/governance.functions";
import { generateBannerImage, type ImageModel } from "@/lib/ai.functions";
import { assistEventPrompt } from "@/lib/ai.functions";
import { Textarea } from "@/components/ui/textarea";

type BannerSearch = {
  eventId?: string;
  title?: string;
  date?: string;
  place?: string;
  eventType?: "rituales" | "academico" | "merchandising";
  view?: "admin" | "creator";
};

export const Route = createFileRoute("/banner-studio")({
  head: () => ({ meta: [{ title: "Banner Studio — Marca Institucional" }] }),
  validateSearch: (s: Record<string, unknown>): BannerSearch => ({
    eventId: typeof s.eventId === "string" ? s.eventId : undefined,
    title: typeof s.title === "string" ? s.title : undefined,
    date: typeof s.date === "string" ? s.date : undefined,
    place: typeof s.place === "string" ? s.place : undefined,
    eventType: s.eventType === "rituales" || s.eventType === "academico" || s.eventType === "merchandising" ? s.eventType : undefined,
    view: s.view === "admin" || s.view === "creator" ? s.view : undefined,
  }),
  component: BannerStudio,
});

const GREEN = "#006547";
const GREEN_DARK = "#004d34";
const WHITE = "#ffffff";
const BLACK = "#111111";

type LogoKind = "logo_vertical" | "logo_horizontal" | "logotipo" | "logotipo_simplificado";
const LOGO_SLOTS: { kind: LogoKind; label: string; hint: string }[] = [
  { kind: "logo_vertical", label: "Logosímbolo Vertical", hint: "Rituales, grados, homenajes" },
  { kind: "logo_horizontal", label: "Logosímbolo Horizontal", hint: "Académico, docencia" },
  { kind: "logotipo", label: "Logotipo ®", hint: "Extensión, congresos, merchandising" },
  { kind: "logotipo_simplificado", label: "Logotipo Simplificado (UdeA)", hint: "Aplicaciones reducidas" },
];

type AssetRow = {
  id: string; kind: string; storage_path: string; file_name: string;
  file_size: number; mime_type: string | null; url: string | null;
};

function BannerStudio() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const rolesFn = useServerFn(getMyRoles);
  const [view, setView] = useState<"admin" | "creator">(search.view ?? "creator");

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const { data: rolesData } = useQuery({
    queryKey: ["my_roles", user?.id], enabled: !!user, queryFn: () => rolesFn(),
  });
  const canManage = !!rolesData?.roles?.some((r) => r === "admin" || r === "dev");

  if (!user) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-neutral-50 text-neutral-900">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-neutral-200">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition">
                <ArrowLeft className="size-4" /> Dashboard
              </Link>
              <span className="h-5 w-px bg-neutral-200" />
              <div>
                <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: GREEN }}>Banner Studio</p>
                <h1 className="text-sm font-semibold leading-none">Arquitectura de Marca & Creador</h1>
              </div>
            </div>

            <div className="flex items-center gap-2 p-1 rounded-full bg-neutral-100 ring-1 ring-neutral-200">
              {canManage && (
                <button
                  onClick={() => setView("admin")}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5",
                    view === "admin" ? "bg-white shadow-sm ring-1 ring-neutral-200" : "text-neutral-500 hover:text-neutral-800",
                  )}
                  style={view === "admin" ? { color: GREEN } : undefined}
                >
                  <ShieldCheck className="size-3.5" /> Admin
                </button>
              )}
              <button
                onClick={() => setView("creator")}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5",
                  view === "creator" ? "bg-white shadow-sm ring-1 ring-neutral-200" : "text-neutral-500 hover:text-neutral-800",
                )}
                style={view === "creator" ? { color: GREEN } : undefined}
              >
                <Users className="size-3.5" /> Creador
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Both views are kept mounted to preserve state across tab switches */}
          <div className={cn(view === "admin" ? "block" : "hidden")}>
            {canManage ? <AdminView /> : <Restricted />}
          </div>
          <div className={cn(view === "creator" ? "block" : "hidden")}>
            <CreatorView prefill={search} />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

function Restricted() {
  return (
    <Card className="p-10 text-center border-neutral-200 max-w-md mx-auto">
      <Lock className="size-8 mx-auto mb-3" style={{ color: GREEN }} />
      <h2 className="font-semibold mb-1">Vista solo para administradores</h2>
      <p className="text-sm text-neutral-600">Usa la vista Creador para diseñar tu banner.</p>
    </Card>
  );
}

/* ───────────────────────── ADMIN VIEW ───────────────────────── */

function AdminView() {
  const qc = useQueryClient();
  const listFn = useServerFn(listBrandAssets);
  const { data } = useQuery({ queryKey: ["brand_assets"], queryFn: () => listFn() });
  const assets = (data?.assets ?? []) as AssetRow[];
  const byKind = useMemo(() => Object.fromEntries(assets.map((a) => [a.kind, a])), [assets]);

  const manualPdf = byKind["manual_pdf"];
  const [enforceTemplate, setEnforceTemplate] = useState(true);
  useEffect(() => {
    const v = localStorage.getItem("bs_enforce_template");
    if (v !== null) setEnforceTemplate(v === "1");
  }, []);
  useEffect(() => { localStorage.setItem("bs_enforce_template", enforceTemplate ? "1" : "0"); }, [enforceTemplate]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] mb-1" style={{ color: GREEN }}>Defina Marca</p>
        <h2 className="text-2xl font-semibold tracking-tight">Panel de definición institucional</h2>
        <p className="text-sm text-neutral-600 mt-1 max-w-2xl">
          Los archivos y reglas que cargas aquí alimentan en tiempo real las plantillas disponibles para los creadores.
        </p>
      </div>

      {/* PDF Knowledge Base */}
      <section>
        <SectionHead icon={<FileText className="size-4" />} title="Manual de Marca — Base de conocimiento" />
        <PdfDropzone current={manualPdf} onChanged={() => qc.invalidateQueries({ queryKey: ["brand_assets"] })} />
      </section>

      {/* Logo Vector Manager */}
      <section>
        <SectionHead icon={<ImageIcon className="size-4" />} title="Variantes oficiales del logotipo" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {LOGO_SLOTS.map((s) => (
            <LogoSlot
              key={s.kind}
              kind={s.kind}
              label={s.label}
              hint={s.hint}
              current={byKind[s.kind]}
              onChanged={() => qc.invalidateQueries({ queryKey: ["brand_assets"] })}
            />
          ))}
        </div>
      </section>

      {/* Global Enforcement */}
      <section>
        <SectionHead icon={<ShieldCheck className="size-4" />} title="Configuración global" />
        <Card className="p-5 border-neutral-200 flex items-start justify-between gap-6">
          <div>
            <p className="font-medium text-sm">Plantilla institucional bloqueada</p>
            <p className="text-xs text-neutral-600 mt-1 max-w-md">
              Al activarse, todos los banners obligan tipografía Georgia/Sans-Serif, paleta institucional
              (verde, blanco, negro) y posiciones del manual.
            </p>
          </div>
          <Switch checked={enforceTemplate} onCheckedChange={setEnforceTemplate} />
        </Card>
      </section>
    </div>
  );
}

function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="grid place-content-center size-7 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-700">{icon}</span>
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );
}

function PdfDropzone({ current, onChanged }: { current?: AssetRow; onChanged: () => void }) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const upsertFn = useServerFn(upsertBrandAsset);
  const delFn = useServerFn(deleteBrandAsset);

  const upload = useCallback(async (files: FileList) => {
    const file = files[0];
    if (!file) return;
    if (file.type !== "application/pdf") return toast.error("Solo archivos PDF");
    if (file.size > 15 * 1024 * 1024) return toast.error("Máx 15 MB");
    setBusy(true);
    try {
      const path = `manual_pdf/${Date.now()}.pdf`;
      const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: true, contentType: "application/pdf" });
      if (error) throw error;
      await upsertFn({ data: { kind: "manual_pdf", storage_path: path, file_name: file.name, file_size: file.size, mime_type: "application/pdf" } });
      toast.success("Manual procesado por el Agente de IA");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    finally { setBusy(false); }
  }, [upsertFn, onChanged]);

  const remove = async () => {
    if (!confirm("¿Eliminar manual?")) return;
    try { await delFn({ data: { kind: "manual_pdf" } }); toast.success("Eliminado"); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  return (
    <label
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) upload(e.dataTransfer.files); }}
      className={cn(
        "relative block rounded-xl border-2 border-dashed p-6 cursor-pointer transition bg-white",
        drag ? "border-[color:var(--g)] bg-emerald-50/40" : "border-neutral-200 hover:border-neutral-300",
      )}
      style={{ ["--g" as any]: GREEN }}
    >
      <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />
      {busy ? (
        <div className="flex items-center gap-3 text-sm text-neutral-600"><Loader2 className="size-4 animate-spin" /> Procesando…</div>
      ) : current ? (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-10 rounded-md grid place-content-center text-white shrink-0" style={{ background: GREEN }}>
              <FileCheck2 className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{current.file_name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="text-[10px] px-1.5 py-0 h-4 border-0" style={{ background: "#dcfce7", color: GREEN_DARK }}>
                  <CheckCircle2 className="size-2.5 mr-1" /> Manual procesado por el Agente de IA
                </Badge>
                <span className="text-[10px] text-neutral-500">Reglas de gobernanza activas</span>
              </div>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); remove(); }}>
            <Trash2 className="size-4 text-neutral-500" />
          </Button>
        </div>
      ) : (
        <div className="text-center py-4">
          <UploadCloud className="size-7 mx-auto mb-2 text-neutral-400" />
          <p className="text-sm font-medium">Adjuntar Manual de Marca (.PDF)</p>
          <p className="text-xs text-neutral-500 mt-1">Arrastra o haz clic — máx 15 MB</p>
        </div>
      )}
    </label>
  );
}

function LogoSlot({ kind, label, hint, current, onChanged }: { kind: LogoKind; label: string; hint: string; current?: AssetRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const upsertFn = useServerFn(upsertBrandAsset);
  const delFn = useServerFn(deleteBrandAsset);
  const [variants, setVariants] = useState({ verde: false, blanco: false, negro: false });

  useEffect(() => {
    const v = localStorage.getItem(`bs_variants_${kind}`);
    if (v) try { setVariants(JSON.parse(v)); } catch {}
  }, [kind]);
  useEffect(() => { localStorage.setItem(`bs_variants_${kind}`, JSON.stringify(variants)); }, [variants, kind]);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) return toast.error("Solo imágenes");
    if (file.size > 10 * 1024 * 1024) return toast.error("Máx 10 MB");
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${kind}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      await upsertFn({ data: { kind, storage_path: path, file_name: file.name, file_size: file.size, mime_type: file.type } });
      toast.success(`${label} actualizado`);
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm("¿Eliminar?")) return;
    try { await delFn({ data: { kind } }); toast.success("Eliminado"); onChanged(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Error"); }
  };

  return (
    <Card className="p-4 border-neutral-200">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-[11px] text-neutral-500 mt-0.5">{hint}</p>
        </div>
        {current && <Badge variant="outline" className="border-emerald-200 text-emerald-700 text-[10px]">Cargado</Badge>}
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f); }}
        className={cn(
          "relative block rounded-lg border-2 border-dashed transition cursor-pointer aspect-[4/2] grid place-content-center bg-neutral-50",
          drag ? "border-[color:var(--g)] bg-emerald-50/40" : "border-neutral-200 hover:border-neutral-300",
        )}
        style={{ ["--g" as any]: GREEN }}
      >
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        {busy ? (
          <Loader2 className="size-5 animate-spin text-neutral-400" />
        ) : current?.url ? (
          <img src={current.url} alt={label} className="max-h-24 max-w-[80%] object-contain mx-auto" />
        ) : (
          <div className="text-center text-neutral-400">
            <UploadCloud className="size-5 mx-auto mb-1" />
            <p className="text-[11px]">Subir PNG / SVG</p>
          </div>
        )}
      </label>

      <div className="mt-3">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">Variantes de color cargadas</p>
        <div className="flex gap-3">
          {[
            { id: "verde", label: "Verde Institucional", color: GREEN },
            { id: "blanco", label: "Blanco", color: WHITE },
            { id: "negro", label: "Negro", color: BLACK },
          ].map((v) => (
            <label key={v.id} className="flex items-center gap-1.5 text-[11px] text-neutral-700 cursor-pointer">
              <Checkbox
                checked={variants[v.id as keyof typeof variants]}
                onCheckedChange={(c) => setVariants((p) => ({ ...p, [v.id]: !!c }))}
              />
              <span className="size-2.5 rounded-sm ring-1 ring-neutral-300" style={{ background: v.color }} />
              {v.label}
            </label>
          ))}
        </div>
      </div>

      {current && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-neutral-100">
          <p className="text-[10px] text-neutral-500 truncate max-w-[180px]">{current.file_name}</p>
          <Button variant="ghost" size="sm" onClick={remove} className="h-7 text-[11px]">
            <Trash2 className="size-3" /> Quitar
          </Button>
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── CREATOR VIEW ───────────────────────── */

type Format = "square" | "landscape" | "vertical";
const FORMATS: { id: Format; label: string; channel: string; w: number; h: number }[] = [
  { id: "square", label: "Instagram Post", channel: "1:1 Cuadrado", w: 1080, h: 1080 },
  { id: "landscape", label: "LinkedIn / Facebook", channel: "16:9 Horizontal", w: 1280, h: 720 },
  { id: "vertical", label: "WhatsApp Broadcast", channel: "9:16 Vertical", w: 720, h: 1280 },
];

type EventType = "rituales" | "academico" | "merchandising";
const EVENT_TYPES: { id: EventType; label: string; required: LogoKind; trademark: boolean; placement: "center" | "right" | "trademark" }[] = [
  { id: "rituales", label: "Rituales de Paso / Grados / Homenajes", required: "logo_vertical", trademark: false, placement: "center" },
  { id: "academico", label: "Actividad de Extensión / Congreso / Foro", required: "logo_horizontal", trademark: false, placement: "right" },
  { id: "merchandising", label: "Merchandising / Producto Promocional", required: "logotipo", trademark: true, placement: "trademark" },
];

const PALETTE = [
  { id: "green", label: "Verde", bg: GREEN, fg: WHITE },
  { id: "white", label: "Blanco", bg: WHITE, fg: GREEN_DARK },
  { id: "black", label: "Negro", bg: BLACK, fg: WHITE },
] as const;

const IMAGE_MODELS: { id: ImageModel; label: string; tag: string; free: boolean }[] = [
  { id: "google/gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image (Nano Banana)", tag: "Gratis · Gateway", free: true },
  { id: "google/gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image (Nano Banana 2)", tag: "Gratis · Gateway", free: true },
  { id: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image", tag: "Gratis · Gateway", free: true },
  { id: "openai/gpt-image-1-mini", label: "GPT Image 1 Mini", tag: "Económico", free: false },
  { id: "openai/gpt-image-2", label: "GPT Image 2", tag: "Premium", free: false },
];

function CreatorView({ prefill }: { prefill?: BannerSearch }) {
  const listAssetsFn = useServerFn(listBrandAssets);
  const { data: assetsData } = useQuery({ queryKey: ["brand_assets"], queryFn: () => listAssetsFn() });
  const assets = (assetsData?.assets ?? []) as AssetRow[];
  const byKind = useMemo(() => Object.fromEntries(assets.map((a) => [a.kind, a])), [assets]);

  const [format, setFormat] = useState<Format>("square");
  const [eventType, setEventType] = useState<EventType>(prefill?.eventType ?? "rituales");
  const [paletteId, setPaletteId] = useState<typeof PALETTE[number]["id"]>("green");
  const [title, setTitle] = useState(prefill?.title ?? "Ceremonia de Grados 2026");
  const [date, setDate] = useState(prefill?.date ?? "15 Junio · 4:00 p.m.");
  const [place, setPlace] = useState(prefill?.place ?? "Teatro Universitario · UdeA");
  const [downloading, setDownloading] = useState(false);

  // AI background
  const [aiModel, setAiModel] = useState<ImageModel>("google/gemini-2.5-flash-image");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [assistBusy, setAssistBusy] = useState(false);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const genFn = useServerFn(generateBannerImage);
  const assistFn = useServerFn(assistEventPrompt);

  const canvasRef = useRef<HTMLDivElement>(null);
  const fmt = FORMATS.find((f) => f.id === format)!;
  const evt = EVENT_TYPES.find((e) => e.id === eventType)!;
  const palette = PALETTE.find((p) => p.id === paletteId)!;
  const logo = byKind[evt.required];

  async function handleAssist() {
    setAssistBusy(true);
    try {
      const r = await assistFn({ data: {
        title, date, place,
        eventType: EVENT_TYPES.find(e => e.id === eventType)?.label,
        paletteLabel: palette.label,
      }});
      setAiPrompt(r.prompt);
      toast.success("Prompt generado por el asistente");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setAssistBusy(false); }
  }

  async function handleGenerate() {
    const p = aiPrompt.trim();
    if (p.length < 5) return toast.error("Escribe un prompt o usa el asistente");
    setAiBusy(true);
    try {
      const r = await genFn({ data: { prompt: p, model: aiModel } });
      setBgUrl(r.imageUrl);
      toast.success("Fondo generado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally { setAiBusy(false); }
  }

  async function handleDownload() {
    if (!canvasRef.current) return;
    setDownloading(true);
    try {
      const { w, h } = fmt;
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, w, h);

      // AI background
      if (bgUrl) {
        try {
          const bg = new Image();
          bg.crossOrigin = "anonymous";
          await new Promise<void>((res, rej) => { bg.onload = () => res(); bg.onerror = () => rej(); bg.src = bgUrl; });
          // cover
          const r = Math.max(w / bg.width, h / bg.height);
          const iw = bg.width * r, ih = bg.height * r;
          ctx.drawImage(bg, (w - iw) / 2, (h - ih) / 2, iw, ih);
          // dark gradient overlay for legibility
          const g = ctx.createLinearGradient(0, h * 0.4, 0, h);
          g.addColorStop(0, "rgba(0,0,0,0)");
          g.addColorStop(1, palette.id === "white" ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.55)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        } catch {}
      }
      if (logo?.url) {
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = logo.url!; });
          const maxW = w * 0.32, maxH = h * 0.22;
          const r = Math.min(maxW / img.width, maxH / img.height);
          const iw = img.width * r, ih = img.height * r;
          let lx = (w - iw) / 2, ly = h * 0.1;
          if (evt.placement === "right") { lx = w - iw - w * 0.06; ly = h * 0.06; }
          if (evt.placement === "trademark") { lx = (w - iw) / 2; ly = h * 0.08; }
          ctx.drawImage(img, lx, ly, iw, ih);
        } catch {}
      }

      // accent bar
      ctx.fillStyle = palette.fg;
      ctx.fillRect(w * 0.08, h * 0.5, w * 0.06, 6);

      // title
      ctx.fillStyle = palette.fg;
      ctx.textBaseline = "top";
      ctx.font = `bold ${Math.round(w * 0.06)}px Georgia, serif`;
      wrap(ctx, title, w * 0.08, h * 0.52, w * 0.84, Math.round(w * 0.07));
      // date
      ctx.font = `${Math.round(w * 0.028)}px Georgia, serif`;
      ctx.fillText(date, w * 0.08, h * 0.78);
      // place
      ctx.font = `${Math.round(w * 0.024)}px Georgia, serif`;
      ctx.fillText(place, w * 0.08, h * 0.84);

      if (evt.trademark) {
        ctx.font = `${Math.round(w * 0.018)}px Georgia, serif`;
        ctx.fillText("Marca Registrada ®", w * 0.08, h * 0.92);
      }

      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url; a.download = `banner-${format}-${Date.now()}.png`; a.click();
      toast.success("Banner descargado");
    } catch (e) {
      toast.error("Error al descargar");
    } finally { setDownloading(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] mb-1" style={{ color: GREEN }}>Creador de Banner</p>
        <h2 className="text-2xl font-semibold tracking-tight">Diseña con las reglas activas del manual</h2>
        <p className="text-sm text-neutral-600 mt-1 max-w-2xl">
          Las opciones se ajustan automáticamente según los activos definidos por el administrador.
        </p>
      </div>

      <div className="grid lg:grid-cols-[420px_1fr] gap-6 items-start">
        {/* Controls */}
        <div className="space-y-4">
          <Card className="p-5 border-neutral-200 space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-neutral-500">Canal / Formato</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={cn(
                      "rounded-lg border p-2 text-left transition",
                      format === f.id ? "border-[color:var(--g)] ring-2 ring-[color:var(--g)]/15 bg-emerald-50/40" : "border-neutral-200 hover:border-neutral-300 bg-white",
                    )}
                    style={{ ["--g" as any]: GREEN }}
                  >
                    <div className="mx-auto mb-1.5 bg-neutral-200 rounded" style={{
                      width: f.id === "vertical" ? 14 : f.id === "landscape" ? 28 : 20,
                      height: f.id === "vertical" ? 28 : f.id === "landscape" ? 16 : 20,
                    }} />
                    <p className="text-[11px] font-medium leading-tight">{f.label}</p>
                    <p className="text-[10px] text-neutral-500">{f.channel}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-widest text-neutral-500">Tipo de Evento</Label>
              <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="mt-2 flex items-start gap-2 p-2.5 rounded-md bg-emerald-50/60 border border-emerald-100">
                <Info className="size-3.5 mt-0.5 shrink-0" style={{ color: GREEN }} />
                <p className="text-[11px] text-emerald-900 leading-snug">
                  Regla activa: se usa <strong>{LOGO_SLOTS.find((s) => s.kind === evt.required)?.label}</strong>
                  {evt.trademark && " · obligatorio el símbolo ®"}.
                </p>
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-widest text-neutral-500">Paleta institucional</Label>
              <div className="flex gap-2 mt-2">
                {PALETTE.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPaletteId(p.id)}
                    className={cn(
                      "flex-1 rounded-md ring-1 transition h-10 grid place-content-center text-[10px] font-medium",
                      paletteId === p.id ? "ring-2" : "ring-neutral-200 hover:ring-neutral-300",
                    )}
                    style={{
                      background: p.bg,
                      color: p.fg,
                      borderColor: paletteId === p.id ? GREEN : undefined,
                      boxShadow: paletteId === p.id ? `0 0 0 2px ${GREEN}` : undefined,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="p-5 border-neutral-200 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">Contenido del banner</p>
            <div>
              <Label className="text-[11px]">Título del Evento</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-[11px]">Fecha / Hora</Label>
              <Input value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-[11px]">Lugar</Label>
              <Input value={place} onChange={(e) => setPlace(e.target.value)} className="mt-1" />
            </div>
          </Card>

          {/* AI Background Generator */}
          <Card className="p-5 border-neutral-200 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4" style={{ color: GREEN }} />
              <p className="text-[10px] uppercase tracking-widest text-neutral-500">Fondo generado por IA</p>
            </div>

            <div>
              <Label className="text-[11px]">Modelo de generación</Label>
              <Select value={aiModel} onValueChange={(v) => setAiModel(v as ImageModel)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {IMAGE_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <div className="flex items-center gap-2">
                        <span>{m.label}</span>
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full"
                          style={{
                            background: m.free ? "#dcfce7" : "#f1f5f9",
                            color: m.free ? GREEN_DARK : "#475569",
                          }}
                        >
                          {m.tag}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-neutral-500 mt-1">
                Gemini vía Lovable AI Gateway: gratuito en el plan incluido. GPT Image consume créditos.
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-[11px]">Prompt</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAssist}
                      disabled={assistBusy}
                      className="h-7 text-[11px]"
                    >
                      {assistBusy ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3" />}
                      Asistente
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Genera un prompt automáticamente usando los datos del evento.</TooltipContent>
                </Tooltip>
              </div>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ej: fondo abstracto verde institucional con formas geométricas sutiles y espacio negativo en la parte inferior..."
                rows={4}
                className="mt-1 text-[12px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleGenerate}
                disabled={aiBusy}
                style={{ background: GREEN }}
                className="text-white hover:opacity-90 flex-1"
              >
                {aiBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Generar fondo
              </Button>
              {bgUrl && (
                <Button type="button" variant="outline" onClick={() => setBgUrl(null)} className="text-[11px]">
                  Quitar
                </Button>
              )}
            </div>
          </Card>
        </div>


        {/* Preview */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl border border-neutral-200 p-6 flex items-center justify-center min-h-[480px]">
            <div
              ref={canvasRef}
              className="relative shadow-2xl shadow-black/10 overflow-hidden ring-1 ring-black/5 transition-all duration-300"
              style={{
                background: palette.bg,
                color: palette.fg,
                width: "100%",
                maxWidth: format === "vertical" ? 320 : format === "landscape" ? 640 : 480,
                aspectRatio: `${fmt.w} / ${fmt.h}`,
                fontFamily: "Georgia, serif",
              }}
            >
              {/* AI Background */}
              {bgUrl && (
                <>
                  <img src={bgUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: palette.id === "white"
                        ? "linear-gradient(to bottom, rgba(255,255,255,0) 40%, rgba(255,255,255,0.85) 100%)"
                        : "linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
                    }}
                  />
                </>
              )}

              {/* Logo */}
              <div
                className={cn(
                  "absolute transition-all duration-300",
                  evt.placement === "right" ? "top-[6%] right-[6%]" : "top-[8%] left-1/2 -translate-x-1/2",
                )}
              >
                {logo?.url ? (
                  <img src={logo.url} alt="logo" className="max-h-[14vh] max-w-[40%] object-contain" style={{ maxHeight: format === "vertical" ? 90 : 70, maxWidth: format === "vertical" ? 140 : 180 }} />
                ) : (
                  <div className="text-[10px] opacity-70 px-2 py-1 ring-1 ring-current/30 rounded">
                    {LOGO_SLOTS.find((s) => s.kind === evt.required)?.label} (no cargado)
                  </div>
                )}
              </div>

              {/* Text block */}
              <div className="absolute inset-x-[8%] bottom-[10%]">
                <div className="h-[3px] mb-3" style={{ width: 40, background: palette.fg }} />
                <h3 className="font-bold leading-[1.05] text-balance" style={{ fontSize: format === "vertical" ? 30 : format === "landscape" ? 38 : 34 }}>
                  {title}
                </h3>
                <p className="mt-3 opacity-90" style={{ fontSize: format === "vertical" ? 13 : 15 }}>{date}</p>
                <p className="opacity-80" style={{ fontSize: format === "vertical" ? 12 : 14 }}>{place}</p>
                {evt.trademark && (
                  <p className="mt-3 text-[10px] opacity-75 uppercase tracking-widest">Marca Registrada ®</p>
                )}
              </div>
            </div>
          </div>

          {/* Compliance bar */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50/60">
            <div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: GREEN_DARK }}>
              <ShieldCheck className="size-4" />
              Gobernanza de Marca: Cumpliendo con el Manual de Identidad
              <Badge className="ml-2 border-0 text-[10px] h-5" style={{ background: GREEN, color: "white" }}>OK</Badge>
            </div>
            <Button onClick={handleDownload} disabled={downloading} style={{ background: GREEN }} className="text-white hover:opacity-90">
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Descargar Banner Adaptado
            </Button>
          </div>

          {!logo && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-[12px] text-amber-900">
              <Info className="size-4 shrink-0 mt-0.5" />
              El logo requerido para este tipo de evento aún no se ha cargado en la vista Admin.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(/\s+/);
  let line = "", cy = y;
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      ctx.fillText(line, x, cy); line = w; cy += lineH;
    } else line = t;
  }
  if (line) ctx.fillText(line, x, cy);
}
