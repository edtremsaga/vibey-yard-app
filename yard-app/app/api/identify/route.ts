import type { Candidate } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type RateEntry = {
  count: number;
  windowStart: number;
};

const rateLimitStore = new Map<string, RateEntry>();

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (!forwarded) {
    return "unknown";
  }

  return forwarded.split(",")[0]?.trim() || "unknown";
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const current = rateLimitStore.get(ip);

  if (!current || now - current.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return false;
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  current.count += 1;
  return false;
}

export async function POST(request: Request) {
  try {
    const identifyToken = process.env.IDENTIFY_API_TOKEN;
    if (!identifyToken) {
      return NextResponse.json({ error: "Identify unavailable" }, { status: 500 });
    }

    const requestToken = request.headers.get("x-identify-token");
    if (!requestToken || requestToken !== identifyToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ip = getClientIp(request);
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const apiKey = process.env.PLANTNET_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Identify unavailable" }, { status: 500 });
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

    if (imageValue.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "image too large" }, { status: 413 });
    }

    const plantnetForm = new FormData();
    plantnetForm.append("images", imageValue, imageValue.name || "plant.jpg");
    plantnetForm.append("organs", "auto");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    let response: Response;
    try {
      response = await fetch(
        `https://my-api.plantnet.org/v2/identify/all?api-key=${encodeURIComponent(apiKey)}&nb-results=5`,
        {
          method: "POST",
          body: plantnetForm,
          signal: controller.signal,
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const bodyText = await response.text();
      console.error("PlantNet identify failed:", response.status, bodyText.slice(0, 500));
      return NextResponse.json({ error: "Identify failed" }, { status: 502 });
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
    console.error("Identify failed:", err);
    return NextResponse.json({ error: "Identify failed" }, { status: 500 });
  }
}
