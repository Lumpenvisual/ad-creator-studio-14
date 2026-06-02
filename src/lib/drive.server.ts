/**
 * Server-only Google Drive helpers for the events generator.
 * Reuses the user's google_connections row (set up via /api/google/callback).
 */

type SupaClient = {
  from: (table: string) => {
    select: (...args: unknown[]) => unknown;
    update: (...args: unknown[]) => unknown;
  };
};

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
  if (!res.ok) throw new Error(`Google refresh failed: ${res.status}`);
  return res.json() as Promise<{ access_token: string; expires_in: number }>;
}

async function getAccessToken(supabase: any, userId: string): Promise<string> {
  const { data: conn, error } = await supabase
    .from("google_connections").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!conn) throw new Error("Google Drive no conectado");

  let token = conn.access_token;
  if (new Date(conn.expiry_at).getTime() - Date.now() < 60_000) {
    if (!conn.refresh_token) throw new Error("Sesión de Google expirada, reconecta");
    const refreshed = await refreshAccessToken(conn.refresh_token);
    token = refreshed.access_token;
    await supabase.from("google_connections").update({
      access_token: token,
      expiry_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
    }).eq("user_id", userId);
  }
  return token;
}

async function createFolder(token: string, name: string): Promise<{ id: string; url: string }> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!res.ok) throw new Error(`Drive folder failed: ${res.status} ${await res.text()}`);
  const f = await res.json() as { id: string; webViewLink?: string };
  return { id: f.id, url: f.webViewLink ?? `https://drive.google.com/drive/folders/${f.id}` };
}

async function uploadTextFile(
  token: string, parentId: string, filename: string, content: string, mime = "text/markdown",
): Promise<{ id: string; url: string }> {
  const boundary = `vellum_${crypto.randomUUID()}`;
  const metadata = { name: filename, mimeType: mime, parents: [parentId] };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mime}; charset=UTF-8\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive upload failed: ${res.status} ${await res.text()}`);
  const f = await res.json() as { id: string; webViewLink?: string };
  return { id: f.id, url: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view` };
}

export async function uploadBriefToDrive(
  supabase: any,
  userId: string,
  event: { id: string; name: string; answers: Record<string, unknown> },
  brand: { brand_name: string; slogan?: string | null; legal_text?: string | null },
  copy: { headlines: string[]; bodies: string[] },
  warnings: string[],
): Promise<{ id: string; url: string; folderId: string; folderUrl: string }> {
  const token = await getAccessToken(supabase, userId);
  const folder = await createFolder(token, `${brand.brand_name} — ${event.name}`);
  const md = renderBrief(event, brand, copy, warnings);
  const file = await uploadTextFile(token, folder.id, `brief-${event.name.replace(/[^\w-]+/g, "_")}.md`, md);
  return { id: file.id, url: file.url, folderId: folder.id, folderUrl: folder.url };
}

function renderBrief(
  event: { name: string; answers: Record<string, unknown> },
  brand: { brand_name: string; slogan?: string | null; legal_text?: string | null },
  copy: { headlines: string[]; bodies: string[] },
  warnings: string[],
) {
  const answers = Object.entries(event.answers)
    .map(([k, v]) => `- **${k}**: ${v ?? "—"}`).join("\n");
  return `# Brief — ${event.name}

**Marca:** ${brand.brand_name}
${brand.slogan ? `**Slogan:** ${brand.slogan}\n` : ""}

## Datos del evento
${answers}

## Titulares propuestos
${copy.headlines.map((h, i) => `${i + 1}. ${h}`).join("\n")}

## Cuerpos propuestos
${copy.bodies.map((b, i) => `${i + 1}. ${b}`).join("\n")}

${warnings.length ? `## ⚠ Advertencias de validación\n${warnings.map((w) => `- ${w}`).join("\n")}\n` : "## ✓ Pasó todas las reglas de marca\n"}

${brand.legal_text ? `---\n${brand.legal_text}\n` : ""}
Generado por Vellum Studio.
`;
}
