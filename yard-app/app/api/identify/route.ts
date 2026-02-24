import type { Candidate } from "@/lib/types";
import { NextResponse } from "next/server";

type PlantSeed = {
  commonName: string;
  scientificName: string;
};

const PLANT_SEEDS: PlantSeed[] = [
  { commonName: "Tomato", scientificName: "Solanum lycopersicum" },
  { commonName: "Basil", scientificName: "Ocimum basilicum" },
  { commonName: "Rosemary", scientificName: "Salvia rosmarinus" },
  { commonName: "Lavender", scientificName: "Lavandula angustifolia" },
  { commonName: "Mint", scientificName: "Mentha spicata" },
  { commonName: "Marigold", scientificName: "Tagetes erecta" },
  { commonName: "Hydrangea", scientificName: "Hydrangea macrophylla" },
  { commonName: "Coneflower", scientificName: "Echinacea purpurea" },
  { commonName: "Hosta", scientificName: "Hosta plantaginea" },
  { commonName: "Sunflower", scientificName: "Helianthus annuus" },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildCandidates(plantId: string): Candidate[] {
  const seed = hashString(plantId);
  const usedIndexes = new Set<number>();
  const candidates: Candidate[] = [];

  for (let i = 0; i < 4; i += 1) {
    let offset = 0;
    let index = (seed + i * 5 + offset) % PLANT_SEEDS.length;
    while (usedIndexes.has(index)) {
      offset += 1;
      index = (seed + i * 5 + offset) % PLANT_SEEDS.length;
    }

    usedIndexes.add(index);

    const confidenceJitter = ((seed >> (i * 3)) & 7) * 0.005;
    const confidence = Math.max(0.5, Math.min(0.96, 0.9 - i * 0.09 + confidenceJitter));
    const plant = PLANT_SEEDS[index];

    candidates.push({
      commonName: plant.commonName,
      scientificName: plant.scientificName,
      confidence: Number(confidence.toFixed(2)),
      source: "mock",
    });
  }

  return candidates;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { plantId?: unknown };
    const plantId = typeof body.plantId === "string" ? body.plantId : "";

    if (!plantId) {
      return NextResponse.json({ error: "plantId is required" }, { status: 400 });
    }

    return NextResponse.json({ candidates: buildCandidates(plantId) });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
