import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { signState } from "./google-drive.server";

const SCOPES = "https://www.googleapis.com/auth/drive.file";

function getOrigin() {
  const req = getRequest();
  const origin = req.headers.get("origin");
  if (origin && !origin.includes("localhost")) return origin;

  const forwardedHost = req.headers.get("x-forwarded-host");
  const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  const url = new URL(req.url);
  const host = req.headers.get("host") ?? url.host;
  if (host && !host.includes("localhost")) return `https://${host}`;

  const referer = req.headers.get("referer");
  if (referer) {
    const refererUrl = new URL(referer);
    if (!refererUrl.host.includes("localhost")) return refererUrl.origin;
  }

  return `${url.protocol}//${url.host}`;
}

export const getGoogleAuthUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error("GOOGLE_OAUTH_CLIENT_ID no configurado");
    const redirectUri = `${getOrigin()}/api/google/callback`;
    const state = signState(context.userId);
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      state,
      include_granted_scopes: "true",
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
  });

export const getGoogleConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("google_connections")
      .select("email, expiry_at, scope")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { connected: !!data, email: data?.email ?? null };
  });

export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("google_connections").delete().eq("user_id", context.userId);
    return { ok: true };
  });

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google refresh failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

export const uploadBannerToDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      filename: z.string().min(1).max(200),
      imageBase64: z.string().min(10), // raw base64 PNG (no data: prefix)
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: conn, error } = await context.supabase
      .from("google_connections")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conn) throw new Error("Google Drive no conectado");

    let accessToken = conn.access_token;
    if (new Date(conn.expiry_at).getTime() - Date.now() < 60_000) {
      if (!conn.refresh_token) throw new Error("Sesión de Google expirada, reconecta tu cuenta");
      const refreshed = await refreshAccessToken(conn.refresh_token);
      accessToken = refreshed.access_token;
      await context.supabase.from("google_connections").update({
        access_token: accessToken,
        expiry_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      }).eq("user_id", context.userId);
    }

    const boundary = `vellum_${crypto.randomUUID()}`;
    const metadata = { name: data.filename, mimeType: "image/png" };
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: image/png\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      `${data.imageBase64}\r\n` +
      `--${boundary}--`;

    const up = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    if (!up.ok) throw new Error(`Drive upload failed: ${up.status} ${await up.text()}`);
    const file = (await up.json()) as { id: string; name: string; webViewLink?: string };
    return { id: file.id, name: file.name, webViewLink: file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view` };
  });
