import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyState } from "@/lib/google-drive.functions";

export const Route = createFileRoute("/api/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const error = url.searchParams.get("error");

        const redirectBack = (status: "ok" | "error", msg?: string) => {
          const target = new URL("/dashboard", url);
          target.searchParams.set("google", status);
          if (msg) target.searchParams.set("msg", msg);
          return Response.redirect(target.toString(), 302);
        };

        if (error) return redirectBack("error", error);
        if (!code || !state) return redirectBack("error", "missing_code");

        const verified = verifyState(state);
        if (!verified) return redirectBack("error", "invalid_state");

        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        if (!clientId || !clientSecret) return redirectBack("error", "server_misconfig");

        const redirectUri = `${url.protocol}//${url.host}/api/google/callback`;
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
          }),
        });
        if (!tokenRes.ok) {
          console.error("Google token exchange failed", await tokenRes.text());
          return redirectBack("error", "token_exchange");
        }
        const tok = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in: number;
          scope: string;
        };

        // Fetch email
        let email: string | null = null;
        try {
          const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${tok.access_token}` },
          });
          if (ui.ok) email = ((await ui.json()) as { email?: string }).email ?? null;
        } catch {}

        const expiry_at = new Date(Date.now() + tok.expires_in * 1000).toISOString();

        const { error: dbErr } = await supabaseAdmin.from("google_connections").upsert(
          {
            user_id: verified.userId,
            access_token: tok.access_token,
            refresh_token: tok.refresh_token ?? null,
            expiry_at,
            scope: tok.scope,
            email,
          },
          { onConflict: "user_id" },
        );
        if (dbErr) {
          console.error("DB upsert failed", dbErr);
          return redirectBack("error", "db");
        }

        return redirectBack("ok");
      },
    },
  },
});
