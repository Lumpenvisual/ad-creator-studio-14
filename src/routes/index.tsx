import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sparkles, Layers, Download } from "lucide-react";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/editor" });
  }, [user, loading, navigate]);

  const features = [
    { icon: Sparkles, t: t("landing.f1.t"), d: t("landing.f1.d") },
    { icon: Layers, t: t("landing.f2.t"), d: t("landing.f2.d") },
    { icon: Download, t: t("landing.f3.t"), d: t("landing.f3.d") },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Ambient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 80% 0%, color-mix(in oklab, var(--accent) 22%, transparent), transparent 60%), radial-gradient(ellipse 50% 40% at 0% 30%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 60%)",
        }}
      />

      <header className="sticky top-0 z-50 bg-background/70 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-serif text-2xl">{t("brand")}</span>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <Button asChild variant="ghost"><Link to="/login">{t("nav.login")}</Link></Button>
            <Button asChild><Link to="/signup">{t("nav.getStarted")}</Link></Button>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 pt-24 pb-32">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-muted text-xs font-medium uppercase tracking-widest ring-1 ring-border">
            <span className="size-1.5 rounded-full bg-accent animate-pulse" />
            {t("landing.badge")}
          </span>
          <h1 className="mt-6 font-serif text-6xl md:text-7xl leading-[0.95] text-balance">
            {t("landing.h1.a")}<br />
            <span className="text-muted-foreground italic">{t("landing.h1.b")}</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl text-pretty">
            {t("landing.lead")}
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/signup">{t("landing.cta.primary")}</Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/login">{t("landing.cta.secondary")}</Link></Button>
          </div>
        </div>

        <div className="mt-24 grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.t}
              className="group relative p-6 rounded-xl bg-card ring-1 ring-border transition-all hover:ring-accent/40 hover:-translate-y-0.5"
            >
              <div className="size-10 rounded-lg bg-accent/10 text-accent grid place-items-center">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-5 font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
