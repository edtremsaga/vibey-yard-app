"use client";

import CameraCapture from "@/components/CameraCapture";
import { useState } from "react";

type Plant = {
  id: string;
  createdAt: string;
  nickname: string | null;
  imageDataUrl: string;
};

function createPlantId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return String(Date.now());
}

export default function Home() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingNickname, setPendingNickname] = useState("");

  const hasPlants = plants.length > 0;

  const title = "Your Yard";
  const subtitle = "Capture and remember what’s growing.";

  const handleCapture = (imageDataUrl: string) => {
    setPendingImage(imageDataUrl);
  };

  const clearPending = () => {
    setPendingImage(null);
    setPendingNickname("");
  };

  const handleSave = () => {
    if (!pendingImage) {
      return;
    }

    const trimmedNickname = pendingNickname.trim();

    const newPlant: Plant = {
      id: createPlantId(),
      createdAt: new Date().toISOString(),
      nickname: trimmedNickname === "" ? null : trimmedNickname,
      imageDataUrl: pendingImage,
    };

    setPlants((current) => [newPlant, ...current]);
    clearPending();
  };

  const isConfirming = pendingImage !== null;

  return (
    <div className="min-h-screen bg-emerald-50/40 px-4 py-6 text-zinc-900 sm:px-6">
      <main className="mx-auto w-full max-w-2xl pb-24">
        <header className="mb-6 space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-base text-zinc-600">{subtitle}</p>
        </header>

        {isConfirming && pendingImage ? (
          <section className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
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
                onClick={handleSave}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-emerald-500"
              >
                Save to Yard
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
                  className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200"
                >
                  <img
                    src={plant.imageDataUrl}
                    alt={plant.nickname ?? "Yard plant"}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="space-y-1 p-3">
                    <p className="truncate text-sm font-medium text-zinc-800">
                      {plant.nickname ?? "Unnamed plant"}
                    </p>
                    <p className="text-xs text-zinc-500">{new Date(plant.createdAt).toLocaleString()}</p>
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
          </section>
        )}
      </main>
    </div>
  );
}
