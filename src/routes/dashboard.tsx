import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { LogOut, Plus, MoreHorizontal, Pencil, Copy, Trash2, Sparkles, HardDrive, Check } from "lucide-react";
import {
  getGoogleAuthUrl,
  getGoogleConnectionStatus,
  disconnectGoogle,
} from "@/lib/google-drive.functions";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Vellum Studio" },
      { name: "description", content: "Tus banners guardados en Vellum Studio." },
    ],
  }),
  component: Dashboard,
});

type Banner = {
  id: string;
  name: string;
  headline: string | null;
  body_text: string | null;
  image_url: string | null;
  format: string | null;
  primary_color: string | null;
  accent_color: string | null;
  created_at: string;
  updated_at: string;
};

const FORMAT_LABEL: Record<string, string> = {
  square: "1080×1080",
  vertical: "1080×1920",
  horizontal: "1920×1080",
};

function Dashboard() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t, lang } = useI18n();

  const getAuthUrl = useServerFn(getGoogleAuthUrl);
  const getStatus = useServerFn(getGoogleConnectionStatus);
  const disconnect = useServerFn(disconnectGoogle);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const g = p.get("google");
    if (g === "ok") toast.success(t("dash.drive.connected"));
    if (g === "error") toast.error(`${t("dash.drive.error")}${p.get("msg") ? ": " + p.get("msg") : ""}`);
    if (g) window.history.replaceState({}, "", "/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: drive } = useQuery({
    queryKey: ["google-conn", user?.id],
    enabled: !!user,
    queryFn: () => getStatus(),
  });

  const connectMut = useMutation({
    mutationFn: async () => getAuthUrl(),
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const disconnectMut = useMutation({
    mutationFn: async () => disconnect(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["google-conn"] });
      toast.success(t("dash.drive.disconnected"));
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: banners, isLoading } = useQuery({
    queryKey: ["banners", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Banner[];
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("banners").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["banners"] });
      toast.success(t("dash.toast.deleted"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  const duplicateMut = useMutation({
    mutationFn: async (b: Banner) => {
      const { error } = await supabase.from("banners").insert({
        user_id: user!.id,
        name: `${b.name} (${lang === "es" ? "copia" : "copy"})`,
        headline: b.headline,
        body_text: b.body_text,
        image_url: b.image_url,
        format: b.format,
        primary_color: b.primary_color,
        accent_color: b.accent_color,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["banners"] });
      toast.success(t("dash.toast.duplicated"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error"),
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="font-serif text-2xl">{t("brand")}</Link>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-surface-muted rounded-full ring-1 ring-border">
              <span className="size-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {profile?.credits ?? "…"} {t("nav.credits")}
              </span>
            </div>
            <LanguageSwitcher />
            {drive?.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const emailPart = drive.email ? ` (${drive.email})` : "";
                  if (confirm(t("dash.confirm.disconnect", { email: emailPart }))) {
                    disconnectMut.mutate();
                  }
                }}
              >
                <Check className="size-4" /> {t("nav.driveConnected")}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => connectMut.mutate()}
                disabled={connectMut.isPending}
              >
                <HardDrive className="size-4" /> {t("nav.connectDrive")}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="size-4" /> {t("nav.signOut")}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="font-serif text-4xl md:text-5xl">{t("dash.title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {banners?.length ?? 0} {banners?.length === 1 ? t("dash.countOne") : t("dash.countMany")}
            </p>
          </div>
          <Button onClick={() => navigate({ to: "/editor" })}>
            <Plus className="size-4" /> {t("dash.new")}
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square bg-surface-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !banners?.length ? (
          <EmptyState onCreate={() => navigate({ to: "/editor" })} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {banners.map((b) => (
              <BannerCard
                key={b.id}
                banner={b}
                onOpen={() => navigate({ to: "/editor" })}
                onDuplicate={() => duplicateMut.mutate(b)}
                onDelete={() => {
                  if (confirm(t("dash.confirm.delete", { name: b.name }))) deleteMut.mutate(b.id);
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function BannerCard({
  banner, onOpen, onDuplicate, onDelete,
}: {
  banner: Banner;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const fmt = banner.format ?? "square";
  return (
    <div className="group bg-card ring-1 ring-border rounded-xl overflow-hidden hover:shadow-xl hover:shadow-black/5 transition-shadow">
      <button
        onClick={onOpen}
        className="block w-full aspect-square relative bg-surface-muted overflow-hidden"
      >
        {banner.image_url ? (
          <img
            src={banner.image_url}
            alt={banner.name}
            className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs uppercase tracking-widest text-muted-foreground">
            Sin imagen
          </div>
        )}
        {banner.headline && (
          <>
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute inset-0 p-5 flex flex-col justify-end text-left">
              <div className="h-[2px] mb-2 w-8" style={{ background: banner.accent_color ?? "#9a3412" }} />
              <h3 style={{ color: banner.primary_color ?? "#fff" }} className="font-serif text-xl leading-tight line-clamp-2">
                {banner.headline}
              </h3>
            </div>
          </>
        )}
      </button>
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{banner.name}</p>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {FORMAT_LABEL[fmt] ?? fmt} · {formatDate(banner.updated_at)}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpen}>
              <Pencil className="size-4" /> Abrir en editor
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="size-4" /> Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="size-4" /> Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="border border-dashed border-border rounded-2xl py-20 px-6 text-center bg-surface-muted/40">
      <div className="mx-auto size-12 rounded-full bg-accent/10 grid place-items-center text-accent mb-5">
        <Sparkles className="size-5" />
      </div>
      <h2 className="font-serif text-2xl">Aún no tienes banners</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
        Genera tu primer banner con IA y aparecerá aquí una vez lo guardes desde el editor.
      </p>
      <Button onClick={onCreate} className="mt-6">
        <Plus className="size-4" /> Crear primer banner
      </Button>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}
