import type { Candidate } from "@/lib/types";
import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const CANDIDATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidates: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          commonName: { type: "string" },
          scientificName: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          source: { type: "string", enum: ["openai"] },
        },
        required: ["commonName", "scientificName", "confidence", "source"],
      },
    },
  },
  required: ["candidates"],
} as const;

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }
    const client = new OpenAI({ apiKey });

    const formData = await request.formData();
    const plantIdValue = formData.get("plantId");
    const imageValue = formData.get("image");

    const plantId = typeof plantIdValue === "string" ? plantIdValue : "";
    if (!plantId) {
      return NextResponse.json({ error: "plantId is required" }, { status: 400 });
    }

    if (!(imageValue instanceof File)) {
      return NextResponse.json({ error: "image is required" }, { status: 400 });
    }

    if (!imageValue.type.startsWith("image/")) {
      return NextResponse.json({ error: "image must be an image file" }, { status: 400 });
    }

    const bytes = await imageValue.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const dataUrl = `data:${imageValue.type};base64,${base64}`;

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Identify the plant in the photo. Return 3-5 candidate identifications. Prefer widely used common names. If unsure, still return best guesses but reduce confidence. Confidence must be between 0 and 1.",
            },
            { type: "input_image", image_url: dataUrl, detail: "auto" },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "plant_identification_candidates",
          strict: true,
          schema: CANDIDATE_SCHEMA,
        },
      },
    });

    const outputText = response.output_text;
    if (!outputText) {
      return NextResponse.json({ error: "Identify failed" }, { status: 500 });
    }

    const parsed = JSON.parse(outputText) as { candidates?: Candidate[] };
    const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];

    return NextResponse.json({ candidates });
  } catch {
    return NextResponse.json({ error: "Identify failed" }, { status: 500 });
  }
}
