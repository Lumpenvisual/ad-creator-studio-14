import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

    // Build body per model family
    const isOpenAI = data.model.startsWith("openai/");
    const body = isOpenAI
      ? { model: data.model, prompt: data.prompt }
      : {
          model: data.model,
          messages: [{ role: "user", content: data.prompt }],
          modalities: ["image", "text"],
        };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted on the workspace.");
      throw new Error(`Image generation failed: ${text.slice(0, 200)}`);
    }

    type ImgResp = {
      data?: Array<{ b64_json?: string; url?: string }>;
      choices?: Array<{
        message?: {
          images?: Array<{ image_url?: { url?: string } }>;
          content?: string;
        };
      }>;
    };
    const json = (await res.json()) as ImgResp;
    const first = json.data?.[0];
    let b64 = first?.b64_json;
    let url = first?.url;
    // Fallback: chat-completions-style image response (some Gemini paths)
    if (!b64 && !url) {
      const imgUrl = json.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imgUrl?.startsWith("data:image")) {
        b64 = imgUrl.split(",")[1];
      } else if (imgUrl) {
        url = imgUrl;
      }
    }
    if (!b64 && !url) {
      console.error("Image gen: unexpected response", JSON.stringify(json).slice(0, 500));
      throw new Error("No image returned");
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
