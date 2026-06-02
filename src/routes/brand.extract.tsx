import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, FileUp, Sparkles, Check, FileText, Loader2 } from "lucide-react";
import { extractBrandFromPdf, type ExtractedBrandRules } from "@/lib/brand-extract.functions";

export const Route = createFileRoute("/brand/extract")({
  head: () => ({
    meta: [
      { title: "Extraer marca desde PDF — Vellum Studio" },
      { name: "description", content: "Sube un PDF de brand guidelines y la IA extrae las reglas." },
    ],
  }),
  component: BrandExtractPage,
});

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

function BrandExtractPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const extract = useServerFn(extractBrandFromPdf);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const [file, setFile] = useState<File | null>(null);
  const [brandHint, setBrandHint] = useState("");
  const [industryHint, setIndustryHint] = useState("");
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState<ExtractedBrandRules | null>(null);
  const [applying, setApplying] = useState(false);

  const onPick = useCallback((f: File | null) => {
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast.error("Solo PDFs.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Máximo 15 MB.");
      return;
    }
    setFile(f);
    setResult(null);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onPick(e.dataTransfer.files?.[0] ?? null);
  };

  const fileToBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = r.result as string;
        resolve(s.split(",")[1] ?? "");
      };
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });

  const onExtract = async () => {
    if (!file) return;
    setExtracting(true);
    setResult(null);
    try {
      const b64 = await fileToBase64(file);
      const rules = await extract({
        data: {
          pdfBase64: b64,
          fileName: file.name,
          hints: { brand_name: brandHint || undefined, industry: industryHint || undefined },
        },
      });
      setResult(rules);
      toast.success(`Extraído (confianza ${Math.round((rules.confidence ?? 0) * 100)}%)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al extraer");
    } finally {
      setExtracting(false);
    }
  };

  const onApply = async () => {
    if (!result || !user) return;
    setApplying(true);
    try {
      const { confidence: _c, notes: _n, ...payload } = result;
      const { error } = await supabase
        .from("brand_profiles")
        .upsert(
          { ...payload, user_id: user.id, completed: true },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      toast.success("Perfil de marca aplicado.");
      navigate({ to: "/brand" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al aplicar");
    } finally {
      setApplying(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Cargando…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center">
          <Link
            to="/brand"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="size-4" /> Volver al perfil de marca
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent font-medium mb-3">
          Onboarding · PDF → Reglas
        </p>
        <h1 className="font-serif text-4xl md:text-5xl leading-tight mb-3">
          Sube tus brand guidelines
        </h1>
        <p className="text-muted-foreground max-w-xl mb-10">
          La IA leerá el PDF y propondrá reglas en formato JSON. Tú apruebas antes de
          que se apliquen a tu perfil.
        </p>

        {/* Drag & drop */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition cursor-pointer ${
            dragging
              ? "border-accent bg-accent/5"
              : file
                ? "border-accent/40 bg-surface-muted/30"
                : "border-border hover:border-foreground/30 bg-surface-muted/20"
          }`}
          onClick={() => document.getElementById("pdf-input")?.click()}
        >
          <input
            id="pdf-input"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="size-8 text-accent" />
              <p className="font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB · clic para cambiar
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileUp className="size-8 text-muted-foreground" />
              <p className="font-medium">Arrastra tu PDF aquí o haz clic</p>
              <p className="text-xs text-muted-foreground">Máx. 15 MB · solo PDF</p>
            </div>
          )}
        </div>

        {/* Hints opcionales */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Nombre de marca (opcional)
            </Label>
            <Input
              value={brandHint}
              onChange={(e) => setBrandHint(e.target.value)}
              placeholder="Si la IA falla en detectarlo"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Industria (opcional)
            </Label>
            <Input
              value={industryHint}
              onChange={(e) => setIndustryHint(e.target.value)}
              placeholder="Ej. moda sostenible"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onExtract} disabled={!file || extracting} size="lg">
            {extracting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Extrayendo…
              </>
            ) : (
              <>
                <Sparkles className="size-4" /> Extraer reglas
              </>
            )}
          </Button>
        </div>

        {/* Resultado JSON */}
        {result && (
          <div className="mt-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-2xl">Reglas propuestas</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Confianza: {Math.round((result.confidence ?? 0) * 100)}% ·{" "}
                  Revisa antes de aplicar.
                </p>
              </div>
              <Button onClick={onApply} disabled={applying} variant="default">
                {applying ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Aplicando…
                  </>
                ) : (
                  <>
                    <Check className="size-4" /> Aplicar a mi marca
                  </>
                )}
              </Button>
            </div>

            {result.notes && (
              <div className="text-xs bg-accent/5 ring-1 ring-accent/20 rounded-lg p-3 text-foreground/80">
                <span className="font-medium text-accent">Notas IA:</span> {result.notes}
              </div>
            )}

            <pre className="bg-foreground text-background text-xs p-5 rounded-xl overflow-auto font-mono leading-relaxed max-h-[500px]">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </main>
    </div>
  );
}
