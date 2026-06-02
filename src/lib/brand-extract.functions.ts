import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  pdfBase64: z.string().min(100).max(20_000_000), // ~15MB
  fileName: z.string().max(255).optional(),
  hints: z
    .object({
      brand_name: z.string().optional(),
      industry: z.string().optional(),
    })
    .optional(),
});

const BrandRulesSchema = z.object({
  brand_name: z.string().default(""),
  industry: z.string().default(""),
  personality: z.string().default(""),
  target_audience: z.string().default(""),
  primary_color: z.string().default("#171717"),
  secondary_color: z.string().default("#ffffff"),
  accent_color: z.string().default("#9a3412"),
  heading_font: z.string().default("Instrument Serif"),
  body_font: z.string().default("Schibsted Grotesk"),
  voice_tone: z.string().default(""),
  writing_style: z.string().default(""),
  slogan: z.string().default(""),
  legal_text: z.string().default(""),
  forbidden_phrases: z.array(z.string()).default([]),
  mandatory_elements: z.array(z.string()).default([]),
  restrictions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  notes: z.string().default(""),
});

export type ExtractedBrandRules = z.infer<typeof BrandRulesSchema>;

export const extractBrandFromPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<ExtractedBrandRules> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI gateway no configurado");

    // 1. PDF → texto
    const bytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    const cleaned = (Array.isArray(text) ? text.join("\n") : text)
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 30_000);

    if (cleaned.length < 50) {
      throw new Error("No se pudo leer texto del PDF (¿está escaneado?).");
    }

    // 2. Gemini → JSON estructurado
    const systemPrompt = `Eres un analista de marca. Extrae directrices estrictas a partir de un brand guidelines / brief en PDF.
Devuelve EXCLUSIVAMENTE un JSON válido con esta forma exacta (sin markdown, sin comentarios):
{
  "brand_name": string,
  "industry": string,
  "personality": string (3-5 adjetivos separados por coma),
  "target_audience": string,
  "primary_color": string (hex #rrggbb),
  "secondary_color": string (hex),
  "accent_color": string (hex),
  "heading_font": string,
  "body_font": string,
  "voice_tone": string,
  "writing_style": string,
  "slogan": string,
  "legal_text": string,
  "forbidden_phrases": string[],
  "mandatory_elements": string[],
  "restrictions": string[],
  "confidence": number entre 0 y 1,
  "notes": string (qué quedó ambiguo o faltante)
}
Si un campo no aparece en el documento, déjalo vacío ("" o []). No inventes.`;

    const userPrompt = `Hints del usuario: ${JSON.stringify(data.hints ?? {})}
Archivo: ${data.fileName ?? "brand.pdf"}

Contenido del PDF:
"""
${cleaned}
"""`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "raw",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      if (res.status === 429) throw new Error("Rate limit. Inténtalo en un minuto.");
      if (res.status === 402) throw new Error("Créditos de IA agotados.");
      throw new Error(`Fallo IA: ${t.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? "{}";

    let parsed: unknown;
    try {
      // El modelo a veces envuelve en ```json
      const stripped = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      parsed = JSON.parse(stripped);
    } catch {
      throw new Error("La IA devolvió JSON inválido.");
    }

    return BrandRulesSchema.parse(parsed);
  });
