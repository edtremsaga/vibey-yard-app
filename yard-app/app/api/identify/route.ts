import type { Candidate } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.PLANTNET_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "PLANTNET_API_KEY is not configured" }, { status: 500 });
    }

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

    if (imageValue.type !== "image/jpeg" && imageValue.type !== "image/png") {
      return NextResponse.json({ error: "image must be image/jpeg or image/png" }, { status: 400 });
    }

    const plantnetForm = new FormData();
    plantnetForm.append("images", imageValue, imageValue.name || "plant.jpg");
    plantnetForm.append("organs", "auto");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const response = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(apiKey)}&nb-results=5`,
      {
        method: "POST",
        body: plantnetForm,
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!response.ok) {
      const bodyText = await response.text();
      console.error("PlantNet identify failed:", response.status, bodyText.slice(0, 500));
      return NextResponse.json(
        { error: "Identify failed", detail: `plantnet_status_${response.status}` },
        { status: 502 }
      );
    }

    const json = (await response.json()) as {
      results?: Array<{
        score?: number;
        species?: {
          commonNames?: string[];
          scientificNameWithoutAuthor?: string;
          scientificName?: string;
        };
      }>;
    };

    const candidates: Candidate[] = (json.results ?? []).slice(0, 5).map((r) => ({
      commonName:
        r.species?.commonNames?.[0] ??
        r.species?.scientificNameWithoutAuthor ??
        r.species?.scientificName ??
        "Unknown",
      scientificName: r.species?.scientificName ?? r.species?.scientificNameWithoutAuthor ?? undefined,
      confidence: typeof r.score === "number" ? r.score : undefined,
      source: "plantnet",
    }));

    return NextResponse.json({ candidates });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("Identify failed:", err);
    return NextResponse.json({ error: "Identify failed", detail }, { status: 500 });
  }
}
