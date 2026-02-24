"use client";

import { dbGetPlant, dbPutPlant } from "@/lib/yardDb";
import { resizeImageForIdentify } from "@/lib/resizeImage";
import type { Candidate, PlantDbRecord } from "@/lib/types";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type PlantDetail = Omit<PlantDbRecord, "imageBlob"> & {
  imageUrl: string;
};

export default function PlantDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const autoIdentify = searchParams.get("autoIdentify") === "1";
  const [plant, setPlant] = useState<PlantDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const imageUrlRef = useRef<string | null>(null);

  const refreshPlant = useCallback(async () => {
    if (!id) {
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
      setPlant(null);
      return;
    }

    try {
      const record = await dbGetPlant(id);
      if (!record) {
        if (imageUrlRef.current) {
          URL.revokeObjectURL(imageUrlRef.current);
          imageUrlRef.current = null;
        }
        setPlant(null);
        return;
      }

      const nextImageUrl = URL.createObjectURL(record.imageBlob);
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
      }
      imageUrlRef.current = nextImageUrl;

      setPlant({
        id: record.id,
        createdAt: record.createdAt,
        nickname: record.nickname,
        imageUrl: nextImageUrl,
        idStatus: record.idStatus,
        identifiedAt: record.identifiedAt,
        candidates: record.candidates,
        chosenCandidate: record.chosenCandidate,
      });
    } catch {
      setPlant(null);
    }
  }, [id]);

  useEffect(() => {
    let active = true;

    const loadPlant = async () => {
      setIsLoading(true);
      await refreshPlant();
      if (active) {
        setIsLoading(false);
      }
    };

    void loadPlant();

    return () => {
      active = false;
    };
  }, [refreshPlant]);

  useEffect(() => {
    return () => {
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
        imageUrlRef.current = null;
      }
    };
  }, []);

  const identifyPlant = useCallback(async () => {
    if (!id) {
      return;
    }

    try {
      const current = await dbGetPlant(id);
      if (!current) {
        return;
      }

      if (current.idStatus === "identifying") {
        return;
      }
      setIsIdentifying(true);

      await dbPutPlant({
        ...current,
        idStatus: "identifying",
      });
      await refreshPlant();

      const resizedBlob = await resizeImageForIdentify(current.imageBlob);

      const fd = new FormData();
      fd.append("plantId", id);
      fd.append("image", resizedBlob, "plant.jpg");

      const response = await fetch("/api/identify", {
        method: "POST",
        body: fd,
      });

      if (!response.ok) {
        throw new Error("Identify request failed");
      }

      const payload = (await response.json()) as { candidates?: Candidate[] };
      const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
      if (candidates.length === 0) {
        throw new Error("No candidates");
      }

      const latest = await dbGetPlant(id);
      if (!latest) {
        return;
      }

      await dbPutPlant({
        ...latest,
        idStatus: "unidentified",
        candidates,
        chosenCandidate: undefined,
        identifiedAt: undefined,
      });
      await refreshPlant();
    } catch {
      const latest = await dbGetPlant(id);
      if (latest) {
        await dbPutPlant({
          ...latest,
          idStatus: "failed",
        });
        await refreshPlant();
      }
    } finally {
      setIsIdentifying(false);
    }
  }, [id, refreshPlant]);

  const handleChooseCandidate = useCallback(
    async (candidate: Candidate) => {
      if (!id) {
        return;
      }

      const current = await dbGetPlant(id);
      if (!current) {
        return;
      }

      await dbPutPlant({
        ...current,
        chosenCandidate: candidate,
        idStatus: "identified",
        identifiedAt: new Date().toISOString(),
      });
      await refreshPlant();
    },
    [id, refreshPlant]
  );

  useEffect(() => {
    if (!id || !autoIdentify || !plant || isIdentifying) {
      return;
    }

    if (plant.idStatus === "identifying" || plant.idStatus === "identified") {
      return;
    }

    void identifyPlant();
    router.replace(`/plant/${id}`);
  }, [autoIdentify, id, identifyPlant, isIdentifying, plant, router]);

  return (
    <div className="min-h-screen bg-emerald-50/40 px-4 py-6 text-zinc-900 sm:px-6">
      <main className="mx-auto w-full max-w-2xl space-y-4 pb-24">
        <Link href="/" className="inline-flex text-sm font-medium text-zinc-600 hover:text-zinc-900">
          Back to Your Yard
        </Link>

        {isLoading ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            <p className="text-sm text-zinc-600">Loading plant...</p>
          </section>
        ) : plant ? (
          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={plant.imageUrl}
              alt={plant.nickname ?? "Yard plant"}
              className="h-auto w-full rounded-xl object-cover"
            />

            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                {plant.nickname ?? "Unnamed plant"}
              </h1>
              <p className="text-sm text-zinc-600">Captured {new Date(plant.createdAt).toLocaleString()}</p>
            </div>

            <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Plant ID</p>
              {plant.chosenCandidate ? (
                <div className="mt-1 space-y-1">
                  <p className="text-sm font-medium text-zinc-900">{plant.chosenCandidate.commonName}</p>
                  {plant.chosenCandidate.scientificName ? (
                    <p className="text-sm text-zinc-600 italic">{plant.chosenCandidate.scientificName}</p>
                  ) : null}
                  {plant.identifiedAt ? (
                    <p className="text-xs text-zinc-500">
                      Identified {new Date(plant.identifiedAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              ) : plant.idStatus === "identifying" || isIdentifying ? (
                <p className="mt-1 text-sm text-zinc-700">Identifying...</p>
              ) : (
                <p className="mt-1 text-sm text-zinc-700">Not identified yet.</p>
              )}
            </div>

            <button
              type="button"
              disabled={isIdentifying || plant?.idStatus === "identifying"}
              onClick={() => {
                void identifyPlant();
              }}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
            >
              {isIdentifying ? "Identifying..." : "Identify this plant"}
            </button>

            {plant.candidates && plant.candidates.length > 0 && !plant.chosenCandidate ? (
              <div className="space-y-2 rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Identification Candidates
                </p>
                <ul className="space-y-2">
                  {plant.candidates.map((candidate, index) => (
                    <li
                      key={`${candidate.commonName}-${candidate.scientificName ?? "none"}-${index}`}
                      className="rounded-lg bg-white p-3 ring-1 ring-zinc-200"
                    >
                      <p className="text-sm font-medium text-zinc-900">{candidate.commonName}</p>
                      {candidate.scientificName ? (
                        <p className="text-sm text-zinc-600 italic">{candidate.scientificName}</p>
                      ) : null}
                      <p className="text-xs text-zinc-500">
                        Confidence:{" "}
                        {typeof candidate.confidence === "number"
                          ? `${Math.round(candidate.confidence * 100)}%`
                          : "N/A"}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          void handleChooseCandidate(candidate);
                        }}
                        className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-600"
                      >
                        Use this
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {plant.chosenCandidate ? (
              <button
                type="button"
                disabled={isIdentifying}
                onClick={() => {
                  void identifyPlant();
                }}
                className="inline-flex min-h-10 items-center justify-center rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
              >
                Re-identify
              </button>
            ) : null}
          </section>
        ) : (
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            <p className="text-sm text-zinc-600">Plant not found.</p>
          </section>
        )}
      </main>
    </div>
  );
}
