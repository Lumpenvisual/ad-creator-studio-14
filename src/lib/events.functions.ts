import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { uploadBriefToDrive } from "./drive.server";

/* ============ Roles helpers ============ */

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    return { roles: (data ?? []).map((r) => r.role as string) };
  });

/**
 * If no admin exists in the system, promote the caller to admin.
 * Used to bootstrap the first admin without manual SQL.
 */
export const claimAdminIfFirst = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) return { claimed: false };
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) throw new Error(error.message);
    return { claimed: true };
  });

/* ============ Questionnaire template ============ */

export const listQuestionnaireFields = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("event_questionnaire_fields")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { fields: data ?? [] };
  });

export const listAllQuestionnaireFields = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("event_questionnaire_fields")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { fields: data ?? [] };
  });

const FieldInput = z.object({
  id: z.string().uuid().optional(),
  field_key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, "snake_case"),
  label: z.string().min(1).max(120),
  hint: z.string().max(300).optional().default(""),
  field_type: z.enum(["text", "textarea", "select", "date", "number"]),
  options: z.array(z.string().min(1).max(64)).default([]),
  section: z.string().min(1).max(40).default("general"),
  required: z.boolean().default(false),
  sort_order: z.number().int().min(0).max(10000).default(0),
  active: z.boolean().default(true),
});

export const upsertQuestionnaireField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FieldInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administradores");

    const payload = { ...data, options: data.options };
    const { error } = data.id
      ? await context.supabase.from("event_questionnaire_fields").update(payload).eq("id", data.id)
      : await context.supabase.from("event_questionnaire_fields").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteQuestionnaireField = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase
      .rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Solo administradores");
    const { error } = await context.supabase
      .from("event_questionnaire_fields").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ Events CRUD ============ */

export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("events")
      .select("id, name, status, updated_at, drive_folder_url")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { events: data ?? [] };
  });

export const createEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      name: z.string().min(1).max(200),
      answers: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).default({}),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("events")
      .insert({ user_id: context.userId, name: data.name, answers: data.answers, status: "draft" })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const getEvent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const [{ data: ev, error: evErr }, { data: outs }] = await Promise.all([
      context.supabase.from("events").select("*").eq("id", data.id).single(),
      context.supabase.from("event_outputs").select("*").eq("event_id", data.id).order("created_at", { ascending: false }),
    ]);
    if (evErr) throw new Error(evErr.message);
    return { event: ev, outputs: outs ?? [] };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ============ Generation ============ */

const MAX_ATTEMPTS = 3;

type BrandProfile = {
  brand_name: string;
  industry: string | null;
  personality: string | null;
  target_audience: string | null;
  voice_tone: string | null;
  writing_style: string | null;
  forbidden_phrases: string[];
  mandatory_elements: string[];
  restrictions: string[];
  slogan: string | null;
  legal_text: string | null;
  primary_color: string | null;
  accent_color: string | null;
};

type CopyOutput = { headlines: string[]; bodies: string[] };

function buildPrompt(brand: BrandProfile, event: { name: string; answers: Record<string, unknown> }, retryHint: string) {
  const answersStr = Object.entries(event.answers)
    .map(([k, v]) => `- ${k}: ${v ?? "—"}`).join("\n");
  return `Genera 3 titulares y 3 cuerpos publicitarios para una campaña.

MARCA: ${brand.brand_name}
Industria: ${brand.industry || "—"}
Personalidad: ${brand.personality || "—"}
Audiencia objetivo: ${brand.target_audience || "—"}
Tono de voz: ${brand.voice_tone || "—"}
Estilo de escritura: ${brand.writing_style || "—"}
Slogan: ${brand.slogan || "—"}

REGLAS ESTRICTAS (DEBES CUMPLIR):
- NUNCA uses estas frases o palabras: ${brand.forbidden_phrases.join(", ") || "ninguna"}
- SIEMPRE incluye al menos un elemento obligatorio cuando aplique: ${brand.mandatory_elements.join(", ") || "ninguno"}
- Restricciones visuales/conceptuales: ${brand.restrictions.join(", ") || "ninguna"}

EVENTO: ${event.name}
${answersStr}

${retryHint ? `IMPORTANTE — el intento anterior falló:\n${retryHint}\n` : ""}

Responde EXACTAMENTE en este JSON (sin markdown, sin explicación):
{
  "headlines": ["titular 1", "titular 2", "titular 3"],
  "bodies": ["cuerpo 1 (máx 30 palabras)", "cuerpo 2", "cuerpo 3"]
}`;
}

function validateCopy(out: CopyOutput, brand: BrandProfile): string[] {
  const warnings: string[] = [];
  const all = [...out.headlines, ...out.bodies].map((s) => s.toLowerCase());
  for (const phrase of brand.forbidden_phrases) {
    const p = phrase.toLowerCase().trim();
    if (!p) continue;
    if (all.some((t) => t.includes(p))) warnings.push(`Frase prohibida detectada: "${phrase}"`);
  }
  if (out.headlines.length < 3) warnings.push(`Solo ${out.headlines.length} titulares (se esperaban 3)`);
  if (out.bodies.length < 3) warnings.push(`Solo ${out.bodies.length} cuerpos (se esperaban 3)`);
  return warnings;
}

async function callTextAI(prompt: string): Promise<CopyOutput> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI gateway no configurado");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Eres un copywriter publicitario senior. Respondes solo con JSON válido." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Límite de IA alcanzado, intenta en un momento");
    if (res.status === 402) throw new Error("Créditos de IA agotados en el workspace");
    throw new Error(`AI error ${res.status}: ${t.slice(0, 200)}`);
  }
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: CopyOutput;
  try { parsed = JSON.parse(content); }
  catch { throw new Error("La IA devolvió JSON inválido"); }
  return {
    headlines: Array.isArray(parsed.headlines) ? parsed.headlines.map(String) : [],
    bodies: Array.isArray(parsed.bodies) ? parsed.bodies.map(String) : [],
  };
}

export const generateEventContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ eventId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Cargar evento + brand profile
    const [{ data: event, error: evErr }, { data: brand }] = await Promise.all([
      supabase.from("events").select("*").eq("id", data.eventId).single(),
      supabase.from("brand_profiles").select("*").eq("user_id", userId).maybeSingle(),
    ]);
    if (evErr || !event) throw new Error("Evento no encontrado");
    if (!brand || !brand.brand_name) {
      throw new Error("Primero completa tu Perfil de Marca");
    }

    await supabase.from("events").update({ status: "generating", last_error: null }).eq("id", event.id);

    let attempt = 0;
    let lastWarnings: string[] = [];
    let copy: CopyOutput | null = null;
    let retryHint = "";

    const answers = (event.answers && typeof event.answers === "object" && !Array.isArray(event.answers)
      ? event.answers
      : {}) as Record<string, unknown>;

    try {
      while (attempt < MAX_ATTEMPTS) {
        attempt++;
        const prompt = buildPrompt(brand as BrandProfile, { name: event.name, answers }, retryHint);
        const out = await callTextAI(prompt);
        const warnings = validateCopy(out, brand as BrandProfile);
        lastWarnings = warnings;
        if (warnings.length === 0) { copy = out; break; }
        retryHint = `Errores a evitar en este reintento: ${warnings.join("; ")}`;
      }

      const passed = !!copy;
      const finalCopy = copy ?? { headlines: [], bodies: [] };

      // Subir a Drive (si hay conexión)
      let driveFile: { id: string; url: string; folderId: string; folderUrl: string } | null = null;
      try {
        driveFile = await uploadBriefToDrive(supabase, userId, { id: event.id, name: event.name, answers }, brand as BrandProfile, finalCopy, lastWarnings);
      } catch (e) {
        console.warn("Drive upload skipped:", e);
      }

      const { error: outErr } = await supabase.from("event_outputs").insert({
        event_id: event.id,
        user_id: userId,
        headlines: finalCopy.headlines,
        bodies: finalCopy.bodies,
        format: typeof answers.format === "string" ? answers.format : "square",
        validation_warnings: lastWarnings,
        passed_validation: passed,
        attempt_number: attempt,
        drive_file_id: driveFile?.id,
        drive_file_url: driveFile?.url,
        model_used: "google/gemini-2.5-flash",
      });
      if (outErr) throw new Error(outErr.message);

      await supabase.from("events").update({
        status: passed ? "ready" : "failed",
        drive_folder_id: driveFile?.folderId,
        drive_folder_url: driveFile?.folderUrl,
        last_error: passed ? null : `No se pudo cumplir las reglas tras ${MAX_ATTEMPTS} intentos`,
      }).eq("id", event.id);

      return { passed, attempts: attempt, warnings: lastWarnings, driveUrl: driveFile?.url };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido";
      await supabase.from("events").update({ status: "failed", last_error: msg }).eq("id", event.id);
      throw new Error(msg);
    }
  });
