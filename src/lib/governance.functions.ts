import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const KIND = z.enum([
  "logo_vertical",
  "logo_horizontal",
  "logotipo",
  "logotipo_simplificado",
  "manual_pdf",
]);

async function assertAdminOrDev(supabase: any, userId: string) {
  const [{ data: a }, { data: d }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "dev" }),
  ]);
  if (!a && !d) throw new Error("Solo administradores");
}

/* ───────── Assets ───────── */

export const listBrandAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("brand_assets")
      .select("*")
      .order("kind");
    if (error) throw new Error(error.message);

    // Firmar URLs (bucket privado)
    const withUrls = await Promise.all(
      (data ?? []).map(async (a: any) => {
        const { data: signed } = await context.supabase.storage
          .from("brand-assets")
          .createSignedUrl(a.storage_path, 60 * 60);
        return { ...a, url: signed?.signedUrl ?? null };
      }),
    );
    return { assets: withUrls };
  });

export const upsertBrandAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      kind: KIND,
      storage_path: z.string().min(1).max(500),
      file_name: z.string().min(1).max(255),
      file_size: z.number().int().min(0),
      mime_type: z.string().min(1).max(120),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrDev(context.supabase, context.userId);
    const { error } = await context.supabase.from("brand_assets").upsert(
      {
        kind: data.kind,
        storage_path: data.storage_path,
        file_name: data.file_name,
        file_size: data.file_size,
        mime_type: data.mime_type,
        uploaded_by: context.userId,
      },
      { onConflict: "kind" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBrandAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: KIND }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOrDev(context.supabase, context.userId);
    const { data: row } = await context.supabase
      .from("brand_assets")
      .select("storage_path")
      .eq("kind", data.kind)
      .maybeSingle();
    if (row?.storage_path) {
      await context.supabase.storage.from("brand-assets").remove([row.storage_path]);
    }
    const { error } = await context.supabase
      .from("brand_assets")
      .delete()
      .eq("kind", data.kind);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ───────── Rules ───────── */

export const getBrandRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("brand_rules")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { rules: data };
  });

export const updateBrandRules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid(),
      allowed_colors: z.array(z.string().min(1).max(60)).min(1).max(10),
      no_alteration: z.boolean(),
      require_trademark: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrDev(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("brand_rules")
      .update({
        allowed_colors: data.allowed_colors,
        no_alteration: data.no_alteration,
        require_trademark: data.require_trademark,
        updated_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ───────── Category rules ───────── */

export const listCategoryRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("event_category_rules")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const upsertCategoryRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      id: z.string().uuid().optional(),
      category: z.string().min(1).max(120),
      subcategory: z.string().max(120).nullable().optional(),
      required_logo: KIND,
      require_trademark: z.boolean(),
      description: z.string().max(300).nullable().optional(),
      sort_order: z.number().int().min(0).max(10000),
      active: z.boolean().default(true),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrDev(context.supabase, context.userId);
    const payload = { ...data };
    const { error } = data.id
      ? await context.supabase.from("event_category_rules").update(payload).eq("id", data.id)
      : await context.supabase.from("event_category_rules").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategoryRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOrDev(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("event_category_rules")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
