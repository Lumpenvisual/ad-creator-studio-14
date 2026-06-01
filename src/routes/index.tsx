import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Sparkles, Layers, Download } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/editor" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-serif text-2xl">Vellum Studio</span>
          <div className="flex gap-2">
            <Button asChild variant="ghost"><Link to="/login">Log in</Link></Button>
            <Button asChild><Link to="/signup">Get started</Link></Button>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-6 pt-24 pb-32">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-muted text-xs font-medium uppercase tracking-widest ring-1 ring-border">
            <span className="size-1.5 rounded-full bg-accent animate-pulse" />
            AI banner studio
          </span>
          <h1 className="mt-6 font-serif text-6xl md:text-7xl leading-[0.95] text-balance">
            Banner ads, drafted by AI.<br />
            <span className="text-muted-foreground italic">Refined by you.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl text-pretty">
            Generate background imagery with GPT-Image, Gemini, or open-source models. Edit headline, body, and brand colors on a live canvas. Export in three social formats — or push straight to Drive.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/signup">Start creating — 5 free credits</Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/login">I have an account</Link></Button>
          </div>
        </div>

        <div className="mt-24 grid md:grid-cols-3 gap-8">
          {[
            { icon: Sparkles, t: "Multi-model AI", d: "GPT-Image, Gemini, and open-source providers behind one unified prompt." },
            { icon: Layers, t: "Brand-aware editor", d: "Live overlays — your typography, your colors, draggable text blocks." },
            { icon: Download, t: "Export anywhere", d: "Square, Story, Landscape — download as PNG or push to Google Drive." },
          ].map((f) => (
            <div key={f.t} className="p-6 rounded-xl bg-card ring-1 ring-border">
              <f.icon className="size-5 text-accent" />
              <h3 className="mt-4 font-semibold">{f.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
