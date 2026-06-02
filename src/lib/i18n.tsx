import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Languages, Check } from "lucide-react";

export type Lang = "es" | "en";

type Dict = Record<string, string>;
const DICTS: Record<Lang, Dict> = {
  es: {
    "brand": "Vellum Studio",
    "nav.login": "Iniciar sesión",
    "nav.getStarted": "Crear cuenta",
    "nav.dashboard": "← Panel",
    "nav.signOut": "Salir",
    "nav.credits": "créditos",
    "nav.driveConnected": "Drive conectado",
    "nav.connectDrive": "Conectar Drive",

    "landing.badge": "Estudio de banners con IA",
    "landing.h1.a": "Banners publicitarios, diseñados por IA.",
    "landing.h1.b": "Refinados por ti.",
    "landing.lead": "Genera fondos con GPT-Image, Gemini o modelos abiertos. Edita titular, cuerpo y colores de marca en un lienzo en vivo. Exporta en tres formatos sociales — o súbelos directo a Drive.",
    "landing.cta.primary": "Empezar — 5 créditos gratis",
    "landing.cta.secondary": "Ya tengo cuenta",
    "landing.f1.t": "IA multi-modelo",
    "landing.f1.d": "GPT-Image, Gemini y proveedores abiertos detrás de un único prompt.",
    "landing.f2.t": "Editor con marca",
    "landing.f2.d": "Capas en vivo — tu tipografía, tus colores, bloques de texto editables.",
    "landing.f3.t": "Exporta a cualquier sitio",
    "landing.f3.d": "Cuadrado, Story, Horizontal — descarga PNG o sube a Google Drive.",

    "login.welcome": "Bienvenido de nuevo",
    "login.sub": "Inicia sesión en tu estudio.",
    "login.email": "Email",
    "login.password": "Contraseña",
    "login.submit": "Iniciar sesión",
    "login.submitting": "Entrando…",
    "login.noAccount": "¿Sin cuenta?",
    "login.createOne": "Crear una",
    "login.quote": "“La forma más rápida con la que he lanzado un banner de campaña en una semana.”",
    "login.quoteBy": "— Una marketer cualquiera",
    "login.toastSuccess": "Bienvenido de nuevo",

    "signup.h1": "Crea tu estudio",
    "signup.sub": "Toma 30 segundos.",
    "signup.name": "Nombre",
    "signup.submit": "Crear cuenta",
    "signup.submitting": "Creando…",
    "signup.haveAccount": "¿Ya tienes cuenta?",
    "signup.logIn": "Iniciar sesión",
    "signup.toastSuccess": "Revisa tu email para verificar y luego inicia sesión.",
    "signup.quote": "5 generaciones gratis para empezar.",
    "signup.quoteSub": "Crea, edita y exporta banners publicitarios con IA.",

    "dash.title": "Tus banners",
    "dash.countOne": "banner guardado",
    "dash.countMany": "banners guardados",
    "dash.new": "Nuevo banner",
    "dash.empty.title": "Aún no tienes banners",
    "dash.empty.desc": "Genera tu primer banner con IA y aparecerá aquí cuando lo guardes desde el editor.",
    "dash.empty.cta": "Crear primer banner",
    "dash.card.noImage": "Sin imagen",
    "dash.card.open": "Abrir en editor",
    "dash.card.dup": "Duplicar",
    "dash.card.del": "Eliminar",
    "dash.toast.duplicated": "Banner duplicado",
    "dash.toast.deleted": "Banner eliminado",
    "dash.confirm.delete": "¿Eliminar \"{name}\"?",
    "dash.confirm.disconnect": "¿Desconectar Google Drive{email}?",
    "dash.drive.connected": "Google Drive conectado",
    "dash.drive.disconnected": "Google Drive desconectado",
    "dash.drive.error": "No se pudo conectar Google Drive",

    "editor.model": "Modelo",
    "editor.prompt": "Prompt visual",
    "editor.prompt.ph": "Iluminación atmosférica de estudio sobre una silla de cuero minimalista, sombras suaves, tonos neutros cálidos…",
    "editor.generate": "Generar fondo (1 crédito)",
    "editor.generating": "Generando…",
    "editor.headline": "Titular",
    "editor.body": "Cuerpo",
    "editor.text": "Texto",
    "editor.accent": "Acento",
    "editor.font": "Tipografía",
    "editor.export": "Exportar",
    "editor.export.png": "Descargar PNG",
    "editor.export.drive": "Google Drive",
    "editor.export.driveOff": "(no conectado)",
    "editor.canvas.empty": "Genera un fondo",
    "editor.canvas.loading": "Invocando…",
    "editor.toast.promptShort": "Escribe un prompt primero.",
    "editor.toast.generated": "Generado. Quedan {n} créditos.",
    "editor.toast.noBg": "Genera un fondo primero.",
    "editor.toast.downloaded": "Descargado",
    "editor.toast.driveNotConnected": "Conecta Google Drive desde el Panel primero.",
    "editor.toast.uploading": "Subiendo a Google Drive…",
    "editor.toast.uploaded": "Subido a Google Drive",
    "editor.toast.open": "Abrir",
    "fmt.square": "Cuadrado 1080×1080",
    "fmt.vertical": "Story 1080×1920",
    "fmt.horizontal": "Horizontal 1920×1080",

    "lang.label": "Idioma",
    "lang.es": "Español",
    "lang.en": "English",
  },
  en: {
    "brand": "Vellum Studio",
    "nav.login": "Log in",
    "nav.getStarted": "Get started",
    "nav.dashboard": "← Dashboard",
    "nav.signOut": "Sign out",
    "nav.credits": "credits",
    "nav.driveConnected": "Drive connected",
    "nav.connectDrive": "Connect Drive",

    "landing.badge": "AI banner studio",
    "landing.h1.a": "Banner ads, drafted by AI.",
    "landing.h1.b": "Refined by you.",
    "landing.lead": "Generate background imagery with GPT-Image, Gemini, or open-source models. Edit headline, body, and brand colors on a live canvas. Export in three social formats — or push straight to Drive.",
    "landing.cta.primary": "Start creating — 5 free credits",
    "landing.cta.secondary": "I have an account",
    "landing.f1.t": "Multi-model AI",
    "landing.f1.d": "GPT-Image, Gemini, and open-source providers behind one unified prompt.",
    "landing.f2.t": "Brand-aware editor",
    "landing.f2.d": "Live overlays — your typography, your colors, draggable text blocks.",
    "landing.f3.t": "Export anywhere",
    "landing.f3.d": "Square, Story, Landscape — download as PNG or push to Google Drive.",

    "login.welcome": "Welcome back",
    "login.sub": "Log in to your studio.",
    "login.email": "Email",
    "login.password": "Password",
    "login.submit": "Log in",
    "login.submitting": "Signing in…",
    "login.noAccount": "No account?",
    "login.createOne": "Create one",
    "login.quote": "“The fastest way I've shipped a campaign banner in a week.”",
    "login.quoteBy": "— A marketer somewhere",
    "login.toastSuccess": "Welcome back",

    "signup.h1": "Create your studio",
    "signup.sub": "It takes 30 seconds.",
    "signup.name": "Display name",
    "signup.submit": "Create account",
    "signup.submitting": "Creating…",
    "signup.haveAccount": "Have an account?",
    "signup.logIn": "Log in",
    "signup.toastSuccess": "Check your email to verify, then log in.",
    "signup.quote": "5 free generations to get started.",
    "signup.quoteSub": "Create, edit, and export AI banner ads.",

    "dash.title": "Your banners",
    "dash.countOne": "banner saved",
    "dash.countMany": "banners saved",
    "dash.new": "New banner",
    "dash.empty.title": "No banners yet",
    "dash.empty.desc": "Generate your first AI banner and it will appear here once you save it from the editor.",
    "dash.empty.cta": "Create first banner",
    "dash.card.noImage": "No image",
    "dash.card.open": "Open in editor",
    "dash.card.dup": "Duplicate",
    "dash.card.del": "Delete",
    "dash.toast.duplicated": "Banner duplicated",
    "dash.toast.deleted": "Banner deleted",
    "dash.confirm.delete": "Delete \"{name}\"?",
    "dash.confirm.disconnect": "Disconnect Google Drive{email}?",
    "dash.drive.connected": "Google Drive connected",
    "dash.drive.disconnected": "Google Drive disconnected",
    "dash.drive.error": "Could not connect Google Drive",

    "editor.model": "Model",
    "editor.prompt": "Visual prompt",
    "editor.prompt.ph": "Atmospheric studio lighting on a minimalist leather chair, soft shadows, warm neutral tones…",
    "editor.generate": "Generate background (1 credit)",
    "editor.generating": "Generating…",
    "editor.headline": "Headline",
    "editor.body": "Body",
    "editor.text": "Text",
    "editor.accent": "Accent",
    "editor.font": "Font",
    "editor.export": "Export",
    "editor.export.png": "Download PNG",
    "editor.export.drive": "Google Drive",
    "editor.export.driveOff": "(not connected)",
    "editor.canvas.empty": "Generate a background",
    "editor.canvas.loading": "Conjuring…",
    "editor.toast.promptShort": "Write a prompt first.",
    "editor.toast.generated": "Generated. {n} credits left.",
    "editor.toast.noBg": "Generate a background first.",
    "editor.toast.downloaded": "Downloaded",
    "editor.toast.driveNotConnected": "Connect Google Drive from the Dashboard first.",
    "editor.toast.uploading": "Uploading to Google Drive…",
    "editor.toast.uploaded": "Uploaded to Google Drive",
    "editor.toast.open": "Open",
    "fmt.square": "Square 1080×1080",
    "fmt.vertical": "Story 1080×1920",
    "fmt.horizontal": "Landscape 1920×1080",

    "lang.label": "Language",
    "lang.es": "Español",
    "lang.en": "English",
  },
};

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: string, vars?: Record<string, string | number>) => string };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem("lang")) as Lang | null;
    if (saved === "es" || saved === "en") setLangState(saved);
    else if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("en")) setLangState("en");
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("lang", l); } catch { /* ignore */ }
    if (typeof document !== "undefined") document.documentElement.lang = l;
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    let s = DICTS[lang][key] ?? DICTS.es[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={compact ? "icon" : "sm"} aria-label={t("lang.label")}>
          <Languages className="size-4" />
          {!compact && <span className="text-xs font-medium uppercase tracking-wider">{lang}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onClick={() => setLang("es")}>
          {lang === "es" && <Check className="size-4" />} {t("lang.es")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setLang("en")}>
          {lang === "en" && <Check className="size-4" />} {t("lang.en")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
