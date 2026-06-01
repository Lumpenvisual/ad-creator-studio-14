import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (user) navigate({ to: "/editor" }); }, [user, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/editor" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-primary text-primary-foreground p-12 flex-col justify-between">
        <Link to="/" className="font-serif text-2xl">Vellum Studio</Link>
        <div>
          <p className="font-serif text-4xl text-balance leading-tight">"The fastest way I've shipped a campaign banner in a week."</p>
          <p className="mt-4 text-sm opacity-70">— A marketer somewhere</p>
        </div>
      </div>
      <div className="flex items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="font-serif text-3xl">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">Log in to your studio.</p>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Signing in…" : "Log in"}</Button>
          <p className="text-sm text-center text-muted-foreground">
            No account? <Link to="/signup" className="underline text-foreground">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
