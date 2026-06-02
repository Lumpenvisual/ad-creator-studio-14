import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";

export const Route = createFileRoute("/signup")({ component: SignupPage });

function SignupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate({ to: "/dashboard" }); }, [user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { display_name: name },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("signup.toastSuccess"));
    navigate({ to: "/login" });
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
          <p className="font-serif text-4xl text-balance leading-tight">{t("signup.quote")}</p>
          <p className="mt-4 text-sm opacity-70">{t("signup.quoteSub")}</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-8 relative">
        <div className="absolute top-4 right-4"><LanguageSwitcher /></div>
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="font-serif text-3xl">{t("signup.h1")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("signup.sub")}</p>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="name">{t("signup.name")}</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email">{t("login.email")}</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">{t("login.password")}</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? t("signup.submitting") : t("signup.submit")}</Button>
          <p className="text-sm text-center text-muted-foreground">
            {t("signup.haveAccount")} <Link to="/login" className="underline text-foreground">{t("signup.logIn")}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
