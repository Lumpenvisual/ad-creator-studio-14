import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Build an image-generation prompt from event metadata using a chat model.
 * Uses Lovable AI Gateway (no separate API key needed).
 */
const AssistInput = z.object({
  title: z.string().min(1).max(300),
  date: z.string().max(200).optional(),
  place: z.string().max(200).optional(),
  eventType: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  paletteLabel: z.string().max(80).optional(),
});

export const assistEventPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AssistInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway no configurado");

    const sys =
      "Eres un director de arte institucional de la Universidad de Antioquia. " +
      "Genera UN solo prompt en español (máx 90 palabras) para un modelo de generación de imágenes " +
      "que produzca un FONDO de banner abstracto, elegante y minimalista para un evento universitario. " +
      "Restricciones obligatorias: paleta institucional (verde #006547, blanco, negro), sin texto, " +
      "sin logotipos, sin personas reconocibles, composición con espacio negativo en la parte inferior " +
      "para sobreponer texto. Responde SOLO el prompt, sin comillas ni explicaciones.";

    const userMsg = [
      `Evento: ${data.title}`,
      data.eventType && `Tipo: ${data.eventType}`,
      data.date && `Fecha: ${data.date}`,
      data.place && `Lugar: ${data.place}`,
      data.paletteLabel && `Paleta dominante: ${data.paletteLabel}`,
      data.description && `Descripción: ${data.description}`,
    ].filter(Boolean).join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userMsg },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("Límite de uso alcanzado, intenta en un momento.");
      if (res.status === 402) throw new Error("Créditos de IA agotados en el workspace.");
      throw new Error(`Fallo en asistente: ${t.slice(0, 200)}`);
    }
    const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const prompt = json.choices?.[0]?.message?.content?.trim();
    if (!prompt) throw new Error("El asistente no devolvió un prompt.");
    return { prompt };
  });

const MODELS = [
  "openai/gpt-image-2",
  "openai/gpt-image-1-mini",
  "google/gemini-2.5-flash-image",
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-3-pro-image-preview",
] as const;

export type ImageModel = (typeof MODELS)[number];

const Input = z.object({
  prompt: z.string().min(3).max(2000),
  model: z.enum(MODELS).default("openai/gpt-image-2"),
});

const OPENAI_FALLBACK_MODEL: ImageModel = "openai/gpt-image-2";

type ImgResp = {
  data?: Array<{ b64_json?: string; url?: string }> | null;
  choices?: Array<{
    message?: {
      images?: Array<{ image_url?: { url?: string } }>;
      content?: string;
    };
  }>;
};

function buildImageBody(model: ImageModel, prompt: string) {
  return model.startsWith("openai/")
    ? { model, prompt, quality: "low", size: "1024x1024", n: 1 }
    : {
        model,
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      };
}

function extractImage(json: ImgResp) {
  const first = json.data?.[0];
  let b64 = first?.b64_json;
  let url = first?.url;
  const imgUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!b64 && !url && imgUrl?.startsWith("data:image")) {
    b64 = imgUrl.split(",")[1];
  } else if (!b64 && !url && imgUrl) {
    url = imgUrl;
  }

  return { b64, url };
}

/**
 * Generate a banner background image using Lovable AI Gateway.
 * Deducts 1 credit from the caller's profile on success.
 * Returns a data: URL (base64 PNG) so the client can render it instantly.
 */
export const generateBannerImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway not configured");

    // Check credits
    const { data: profile, error: pErr } = await supabase
      .from("profiles").select("credits").eq("id", userId).single();
    if (pErr) throw new Error(pErr.message);
    if (!profile || profile.credits <= 0) {
      throw new Error("Out of credits. Top up to keep generating.");
    }

    const requestImage = async (model: ImageModel) => {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildImageBody(model, data.prompt)),
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
        if (res.status === 402) throw new Error("AI credits exhausted on the workspace.");
        throw new Error(`Image generation failed: ${text.slice(0, 200)}`);
      }

      const json = (await res.json()) as ImgResp;
      const image = extractImage(json);
      if (!image.b64 && !image.url) {
        console.error(`Image gen: ${model} returned no image`, JSON.stringify(json).slice(0, 500));
      }
      return image;
    };

    let { b64, url } = await requestImage(data.model);
    if (!b64 && !url && data.model !== OPENAI_FALLBACK_MODEL) {
      ({ b64, url } = await requestImage(OPENAI_FALLBACK_MODEL));
    }
    if (!b64 && !url) {
      throw new Error("No image returned. Try a different prompt or model.");
    }

    // Deduct credit
    await supabase
      .from("profiles")
      .update({ credits: profile.credits - 1 })
      .eq("id", userId);

    return {
      imageUrl: b64 ? `data:image/png;base64,${b64}` : url!,
      creditsRemaining: profile.credits - 1,
    };
  });
