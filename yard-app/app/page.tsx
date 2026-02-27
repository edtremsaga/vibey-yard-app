"use client";

import CameraCapture from "@/components/CameraCapture";
import { dbDeletePlant, dbGetAllPlants, dbGetPlant, dbPutPlant } from "@/lib/yardDb";
import type { PlantDbRecord } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Plant = Omit<
  PlantDbRecord,
  "images" | "identifiedAt" | "candidates" | "chosenCandidate"
> & {
  imageUrl: string;
};

function createPlantId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return String(Date.now());
}

export default function Home() {
  const router = useRouter();
  const [plants, setPlants] = useState<Plant[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingNickname, setPendingNickname] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [showA2hsHint, setShowA2hsHint] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const plantImageUrlsRef = useRef<Set<string>>(new Set());
  const pendingImageUrlRef = useRef<string | null>(null);

  const hasPlants = plants.length > 0;

  const title = "Your Yard";
  const subtitle = "Capture and remember what’s growing.";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setHasMounted(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isIosSafari =
      ua.includes("Safari") &&
      !ua.includes("CriOS") &&
      !ua.includes("FxiOS") &&
      !ua.includes("EdgiOS") &&
      !ua.includes("OPiOS");
    const isStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dismissed = window.localStorage.getItem("vibey-yard-a2hsDismissed") === "1";
    const shouldShow = isIos && isIosSafari && !isStandalone && !dismissed;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowA2hsHint((current) => (current === shouldShow ? current : shouldShow));
  }, [hasMounted]);

  useEffect(() => {
    let active = true;

    const loadPlants = async () => {
      try {
        const records = await dbGetAllPlants();
        const sorted = [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const loadedPlants = sorted
          .map((record) => {
            const latestImage = record.images[record.images.length - 1];
            if (!latestImage) {
              return null;
            }

            return {
              id: record.id,
              createdAt: record.createdAt,
              nickname: record.nickname,
              idStatus: record.idStatus,
              imageUrl: URL.createObjectURL(latestImage.blob),
            };
          })
          .filter((plant): plant is Plant => plant !== null);

        if (!active) {
          for (const plant of loadedPlants) {
            URL.revokeObjectURL(plant.imageUrl);
          }
          return;
        }

        setPlants(loadedPlants);
      } catch {
        if (active) {
          setPlants([]);
        }
      }
    };

    void loadPlants();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const nextUrls = new Set(plants.map((plant) => plant.imageUrl));

    for (const existingUrl of plantImageUrlsRef.current) {
      if (!nextUrls.has(existingUrl)) {
        URL.revokeObjectURL(existingUrl);
      }
    }

    plantImageUrlsRef.current = nextUrls;
  }, [plants]);

  useEffect(() => {
    return () => {
      for (const existingUrl of plantImageUrlsRef.current) {
        URL.revokeObjectURL(existingUrl);
      }
      plantImageUrlsRef.current.clear();

      if (pendingImageUrlRef.current) {
        URL.revokeObjectURL(pendingImageUrlRef.current);
        pendingImageUrlRef.current = null;
      }
    };
  }, []);

  const handleCapture = (file: File) => {
    const objectUrl = URL.createObjectURL(file);

    if (pendingImageUrlRef.current) {
      URL.revokeObjectURL(pendingImageUrlRef.current);
    }

    pendingImageUrlRef.current = objectUrl;
    setPendingFile(file);
    setPendingImage(objectUrl);
  };

  const clearPending = () => {
    if (pendingImageUrlRef.current) {
      URL.revokeObjectURL(pendingImageUrlRef.current);
      pendingImageUrlRef.current = null;
    }

    setPendingFile(null);
    setPendingImage(null);
    setPendingNickname("");
  };

  const savePendingPlant = async (): Promise<string | null> => {
    if (!pendingFile) {
      return null;
    }

    const trimmedNickname = pendingNickname.trim();

    const record = {
      id: createPlantId(),
      createdAt: new Date().toISOString(),
      nickname: trimmedNickname === "" ? null : trimmedNickname,
      images: [
        {
          id: `${createPlantId()}-image-0`,
          createdAt: new Date().toISOString(),
          blob: pendingFile,
        },
      ],
      idStatus: "unidentified" as const,
    };

    try {
      await dbPutPlant(record);
      const latestImage = record.images[record.images.length - 1];
      if (!latestImage) {
        return null;
      }
      const imageUrl = URL.createObjectURL(latestImage.blob);

      const newPlant: Plant = {
        id: record.id,
        createdAt: record.createdAt,
        nickname: record.nickname,
        idStatus: record.idStatus,
        imageUrl,
      };

      setPlants((current) => [newPlant, ...current]);
      clearPending();
      return record.id;
    } catch {
      // Keep UI stable when persistence fails.
      return null;
    }
  };

  const handleSave = async () => {
    await savePendingPlant();
  };

  const handleSaveAndIdentify = async () => {
    const id = await savePendingPlant();
    if (id) {
      router.push(`/plant/${id}?autoIdentify=1`);
    }
  };

  const handleRenameStart = (plant: Plant) => {
    setEditingId(plant.id);
    setEditingValue(plant.nickname ?? "");
  };

  const handleRenameCancel = () => {
    setEditingId(null);
    setEditingValue("");
  };

  const handleRenameSave = async () => {
    if (!editingId) {
      return;
    }

    const id = editingId;
    const previousPlant = plants.find((plant) => plant.id === id);
    if (!previousPlant) {
      handleRenameCancel();
      return;
    }

    const trimmedNickname = editingValue.trim();
    const nickname = trimmedNickname === "" ? null : trimmedNickname;

    setPlants((current) =>
      current.map((plant) => (plant.id === id ? { ...plant, nickname } : plant))
    );
    handleRenameCancel();

    try {
      const record = await dbGetPlant(id);
      if (!record) {
        return;
      }

      await dbPutPlant({ ...record, nickname });
    } catch {
      setPlants((current) =>
        current.map((plant) =>
          plant.id === id ? { ...plant, nickname: previousPlant.nickname } : plant
        )
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (typeof window === "undefined") {
      return;
    }

    if (!window.confirm("Delete this plant?")) {
      return;
    }

    try {
      await dbDeletePlant(id);
      setPlants((current) => current.filter((plant) => plant.id !== id));
      if (editingId === id) {
        handleRenameCancel();
      }
    } catch {
      // Keep UI stable when persistence fails.
    }
  };

  const isConfirming = pendingImage !== null;
  const dismissA2hsHint = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("vibey-yard-a2hsDismissed", "1");
    }
    setShowA2hsHint(false);
  };

  return (
    <div className="min-h-screen bg-emerald-50/40 px-4 py-6 text-zinc-900 sm:px-6">
      <main className="mx-auto w-full max-w-2xl pb-24">
        <header className="mb-6 space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-base text-zinc-600">{subtitle}</p>
        </header>
        {showA2hsHint ? (
          <section className="mb-4 rounded-xl bg-emerald-100/70 p-3 ring-1 ring-emerald-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Tip</p>
            <p className="mt-1 text-sm text-zinc-700">
              Add this to your Home Screen for quick access. Tap Share → Add to Home Screen.
            </p>
            <button
              type="button"
              onClick={dismissA2hsHint}
              className="mt-2 text-xs font-medium text-emerald-700 hover:text-emerald-600"
            >
              Got it
            </button>
          </section>
        ) : null}

        {isConfirming && pendingImage ? (
          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pendingImage}
              alt="Pending plant capture"
              className="h-auto w-full rounded-xl object-cover"
            />

            <div className="space-y-2">
              <label htmlFor="nickname" className="block text-sm font-medium text-zinc-700">
                Nickname (optional)
              </label>
              <input
                id="nickname"
                type="text"
                value={pendingNickname}
                onChange={(event) => setPendingNickname(event.target.value)}
                placeholder="Rose bush near gate"
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  void handleSave();
                }}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-500"
              >
                Save to Yard
              </button>

              <button
                type="button"
                onClick={() => {
                  void handleSaveAndIdentify();
                }}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-700 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-600"
              >
                Save &amp; Identify
              </button>

              <CameraCapture label="Retake" onCapture={handleCapture} />

              <button
                type="button"
                onClick={clearPending}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 py-3 text-base font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </section>
        ) : hasPlants ? (
          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {plants.map((plant) => (
                <article
                  key={plant.id}
                  className="relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200"
                >
                  {plant.idStatus === "identified" ? (
                    <span className="absolute top-2 left-2 z-20 rounded-full bg-emerald-600 px-2 py-1 text-xs font-medium text-white shadow-sm">
                      Identified
                    </span>
                  ) : plant.idStatus === "identifying" ? (
                    <span className="absolute top-2 left-2 z-20 rounded-full bg-amber-500 px-2 py-1 text-xs font-medium text-white shadow-sm">
                      Identifying…
                    </span>
                  ) : plant.idStatus === "failed" ? (
                    <span className="absolute top-2 left-2 z-20 rounded-full bg-red-500 px-2 py-1 text-xs font-medium text-white shadow-sm">
                      Failed
                    </span>
                  ) : null}
                  <Link
                    href={`/plant/${plant.id}`}
                    aria-label={`View ${plant.nickname ?? "plant"} details`}
                    className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={plant.imageUrl}
                    alt={plant.nickname ?? "Yard plant"}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="space-y-1 p-3">
                    {editingId === plant.id ? (
                      <div className="relative z-20 space-y-2">
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(event) => setEditingValue(event.target.value)}
                          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                        />
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              void handleRenameSave();
                            }}
                            className="text-xs font-medium text-emerald-700 hover:text-emerald-600"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={handleRenameCancel}
                            className="text-xs font-medium text-zinc-500 hover:text-zinc-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="truncate text-sm font-medium text-zinc-800">
                        {plant.nickname ?? "Unnamed plant"}
                      </p>
                    )}
                    <p className="text-xs text-zinc-500">{new Date(plant.createdAt).toLocaleString()}</p>
                    <div className="relative z-20 flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => handleRenameStart(plant)}
                        className="text-xs font-medium text-zinc-600 hover:text-zinc-800"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDelete(plant.id);
                        }}
                        className="text-xs font-medium text-red-600 hover:text-red-500"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="fixed right-4 bottom-6 sm:right-6">
              <CameraCapture label="+ Add" onCapture={handleCapture} />
            </div>
          </section>
        ) : (
          <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
            <CameraCapture label="Add First Plant" onCapture={handleCapture} />
            <p className="mt-3 text-center text-xs text-zinc-500">
              Saved on this device (no cloud sync).
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
