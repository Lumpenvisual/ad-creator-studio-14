import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate({ to: "/dashboard" }); }, [user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("login.toastSuccess"));
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-primary text-primary-foreground p-12 flex-col justify-between relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "radial-gradient(ellipse 70% 50% at 100% 100%, color-mix(in oklab, var(--accent) 60%, transparent), transparent 60%)" }}
        />
        <Link to="/" className="font-serif text-2xl relative">{t("brand")}</Link>
        <div className="relative">
          <p className="font-serif text-4xl text-balance leading-tight">{t("login.quote")}</p>
          <p className="mt-4 text-sm opacity-70">{t("login.quoteBy")}</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 relative">
        <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="font-serif text-3xl">{t("login.welcome")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("login.sub")}</p>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="email">{t("login.email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">{t("login.password")}</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? t("login.submitting") : t("login.submit")}</Button>
          <p className="text-sm text-center text-muted-foreground">
            {t("login.noAccount")} <Link to="/signup" className="underline text-foreground">{t("login.createOne")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
