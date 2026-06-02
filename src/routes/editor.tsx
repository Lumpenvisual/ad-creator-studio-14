import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { generateBannerImage, type ImageModel } from "@/lib/ai.functions";
import { uploadBannerToDrive, getGoogleConnectionStatus } from "@/lib/google-drive.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Sparkles, Download, LogOut, Loader2, HardDrive } from "lucide-react";

export const Route = createFileRoute("/editor")({ component: Editor });

type Format = "square" | "vertical" | "horizontal";
const FORMATS: Record<Format, { w: number; h: number; label: string }> = {
  square: { w: 1080, h: 1080, label: "Square 1080×1080" },
  vertical: { w: 1080, h: 1920, label: "Story 1080×1920" },
  horizontal: { w: 1920, h: 1080, label: "Landscape 1920×1080" },
};

const FONTS = ["Instrument Serif", "Schibsted Grotesk", "Inter", "Playfair Display", "Space Grotesk"];
const MODELS: { id: ImageModel; label: string; tag: string }[] = [
  { id: "google/gemini-2.5-flash-image", label: "Gemini Nano-Banana", tag: "Fast" },
  { id: "google/gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image", tag: "New" },
  { id: "google/gemini-3-pro-image-preview", label: "Gemini 3 Pro Image", tag: "Quality" },
  { id: "openai/gpt-image-2", label: "GPT-Image-2", tag: "OpenAI" },
  { id: "openai/gpt-image-1-mini", label: "GPT-Image Mini", tag: "Cheap" },
];

function Editor() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const genFn = useServerFn(generateBannerImage);
  const uploadDrive = useServerFn(uploadBannerToDrive);
  const getDrive = useServerFn(getGoogleConnectionStatus);
  const { data: drive } = useQuery({
    queryKey: ["google-conn", user?.id], enabled: !!user, queryFn: () => getDrive(),
  });

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  const [headline, setHeadline] = useState("Modern Comfort");
  const [body, setBody] = useState("Designed for the refined living space.");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ImageModel>("google/gemini-2.5-flash-image");
  const [primary, setPrimary] = useState("#ffffff");
  const [accent, setAccent] = useState("#9a3412");
  const [font, setFont] = useState("Instrument Serif");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [format, setFormat] = useState<Format>("square");
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  async function handleGenerate() {
    if (prompt.trim().length < 3) return toast.error("Write a prompt first.");
    setGenerating(true);
    try {
      const res = await genFn({ data: { prompt, model } });
      setImageUrl(res.imageUrl);
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success(`Generated. ${res.creditsRemaining} credits left.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally { setGenerating(false); }
  }

  async function renderToDataUrl(fmt: Format): Promise<string> {
    const { w, h } = FORMATS[fmt];
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Image load failed"));
      img.src = imageUrl!;
    });
    const ratio = Math.max(w / img.width, h / img.height);
    const iw = img.width * ratio, ih = img.height * ratio;
    ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, w, h);
    const padX = w * 0.07;
    const headlineSize = Math.round(w * (fmt === "horizontal" ? 0.075 : 0.095));
    const bodySize = Math.round(w * 0.028);
    ctx.fillStyle = primary;
    ctx.font = `${headlineSize}px "${font}"`;
    ctx.textBaseline = "top";
    wrapText(ctx, headline, padX, h * 0.55, w - padX * 2, headlineSize * 1.05);
    ctx.font = `${bodySize}px "${font}"`;
    wrapText(ctx, body, padX, h * 0.75, w - padX * 2, bodySize * 1.4);
    ctx.fillStyle = accent;
    ctx.fillRect(padX, h * 0.52, w * 0.08, 6);
    return canvas.toDataURL("image/png");
  }

  async function handleExport(fmt: Format) {
    if (!imageUrl) return toast.error("Generate a background first.");
    setExporting(true);
    try {
      const url = await renderToDataUrl(fmt);
      const a = document.createElement("a");
      a.href = url;
      a.download = `banner-${fmt}-${Date.now()}.png`;
      a.click();
      toast.success("Downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally { setExporting(false); }
  }

  async function handleUploadDrive(fmt: Format) {
    if (!imageUrl) return toast.error("Generate a background first.");
    if (!drive?.connected) {
      toast.error("Conecta Google Drive desde el Dashboard primero.");
      return;
    }
    setExporting(true);
    const tId = toast.loading("Subiendo a Google Drive…");
    try {
      const dataUrl = await renderToDataUrl(fmt);
      const base64 = dataUrl.split(",")[1];
      const filename = `banner-${fmt}-${Date.now()}.png`;
      const res = await uploadDrive({ data: { filename, imageBase64: base64 } });
      toast.success("Subido a Google Drive", {
        id: tId,
        action: { label: "Abrir", onClick: () => window.open(res.webViewLink, "_blank") },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed", { id: tId });
    } finally { setExporting(false); }
  }

  if (!user) return null;

  const fmt = FORMATS[format];
  const aspect = fmt.w / fmt.h;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="font-serif text-2xl">Vellum Studio</Link>
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              ← Dashboard
            </Link>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface-muted rounded-full ring-1 ring-border">
              <span className="size-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {profile?.credits ?? "…"} créditos
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4" /> Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-[380px_1fr] gap-8 items-start">
          {/* Controls */}
          <aside className="space-y-4">
            <section className="p-6 bg-surface-muted rounded-xl ring-1 ring-border space-y-5">
              <div>
                <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Model</Label>
                <Select value={model} onValueChange={(v) => setModel(v as ImageModel)}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          {m.label}
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{m.tag}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Visual prompt</Label>
                <Textarea
                  className="mt-2 min-h-[110px] resize-none"
                  placeholder="Atmospheric studio lighting on a minimalist leather chair, soft shadows, warm neutral tones…"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>

              <Button onClick={handleGenerate} disabled={generating} className="w-full">
                {generating ? <><Loader2 className="size-4 animate-spin" /> Generating…</> : <><Sparkles className="size-4" /> Generate background (1 credit)</>}
              </Button>
            </section>

            <section className="p-6 bg-surface-muted rounded-xl ring-1 ring-border space-y-4">
              <div>
                <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Headline</Label>
                <Input className="mt-2" value={headline} onChange={(e) => setHeadline(e.target.value)} />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Body</Label>
                <Textarea className="mt-2 min-h-[70px] resize-none" value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Text" value={primary} onChange={setPrimary} />
                <ColorField label="Accent" value={accent} onChange={setAccent} />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">Font</Label>
                <Select value={font} onValueChange={setFont}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONTS.map((f) => <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </section>
          </aside>

          {/* Canvas */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex gap-2">
                {(Object.keys(FORMATS) as Format[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                      format === f ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {FORMATS[f].label}
                  </button>
                ))}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button disabled={!imageUrl || exporting}>
                    <Download className="size-4" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">Descargar PNG</DropdownMenuLabel>
                  {(Object.keys(FORMATS) as Format[]).map((f) => (
                    <DropdownMenuItem key={`dl-${f}`} onClick={() => handleExport(f)}>
                      <Download className="size-4" /> {FORMATS[f].label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Google Drive {drive?.connected ? "" : "(no conectado)"}
                  </DropdownMenuLabel>
                  {(Object.keys(FORMATS) as Format[]).map((f) => (
                    <DropdownMenuItem
                      key={`gd-${f}`}
                      disabled={!drive?.connected}
                      onClick={() => handleUploadDrive(f)}
                    >
                      <HardDrive className="size-4" /> {FORMATS[f].label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="bg-surface-muted rounded-xl p-8 ring-1 ring-border flex items-center justify-center min-h-[480px]">
              <div
                ref={previewRef}
                className="relative bg-card shadow-2xl shadow-black/10 ring-1 ring-border overflow-hidden w-full"
                style={{
                  aspectRatio: `${aspect}`,
                  maxWidth: format === "vertical" ? 360 : format === "horizontal" ? 720 : 480,
                }}
              >
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center text-xs uppercase tracking-widest text-muted-foreground">
                    {generating ? "Conjuring…" : "Generate a background"}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/25" />
                <div className="absolute inset-0 p-[7%] flex flex-col justify-end">
                  <div className="h-[3px] mb-3" style={{ width: "8%", background: accent }} />
                  <h2 style={{ color: primary, fontFamily: font }} className="text-3xl md:text-4xl leading-[1.05] text-balance">
                    {headline}
                  </h2>
                  <p style={{ color: primary, fontFamily: font, opacity: 0.85 }} className="mt-2 text-sm md:text-base max-w-[80%]">
                    {body}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</Label>
      <div className="mt-2 flex items-center gap-2 px-2 py-1.5 bg-card ring-1 ring-border rounded-md">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-6 rounded cursor-pointer border-0 bg-transparent"
        />
        <span className="text-xs font-mono text-muted-foreground">{value.toUpperCase()}</span>
      </div>
    </div>
  );
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) {
  const words = text.split(/\s+/);
  let line = "";
  let cy = y;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = w;
      cy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, cy);
}
