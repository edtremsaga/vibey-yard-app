import type { PlantDbRecord, PlantImage } from "@/lib/types";

const DB_NAME = "yard-app";
const DB_VERSION = 1;
const STORE_NAME = "plants";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open IndexedDB"));
    };
  });
}

function normalizePlantRecord(raw: unknown): PlantDbRecord {
  const record = raw as Partial<PlantDbRecord> & {
    imageBlob?: Blob;
    blob?: Blob;
    images?: Array<Partial<PlantImage>>;
  };
  const normalizedImages: PlantImage[] = Array.isArray(record.images)
    ? record.images
        .map((image, index) => {
          const blob = image?.blob;
          if (!(blob instanceof Blob)) {
            return null;
          }

          return {
            id: String(image.id ?? `${record.id ?? "plant"}-image-${index}`),
            createdAt: String(image.createdAt ?? record.createdAt ?? new Date().toISOString()),
            blob,
          };
        })
        .filter((image): image is PlantImage => image !== null)
    : [];
  const legacyBlob = record.imageBlob instanceof Blob ? record.imageBlob : null;
  const fallbackBlob = record.blob instanceof Blob ? record.blob : null;
  const primaryBlob = legacyBlob ?? fallbackBlob;

  if (normalizedImages.length === 0 && primaryBlob) {
    normalizedImages.push({
      id: `${String(record.id ?? "plant")}-image-0`,
      createdAt: String(record.createdAt ?? new Date().toISOString()),
      blob: primaryBlob,
    });
  }

  return {
    id: String(record.id ?? ""),
    createdAt: String(record.createdAt ?? ""),
    nickname: record.nickname ?? null,
    images: normalizedImages,
    idStatus: record.idStatus ?? "unidentified",
    identifiedAt: record.identifiedAt,
    candidates: record.candidates,
    chosenCandidate: record.chosenCandidate,
  };
}

export async function dbGetAllPlants(): Promise<PlantDbRecord[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve((request.result as unknown[]).map((record) => normalizePlantRecord(record)));
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to read plants"));
    };

    tx.oncomplete = () => {
      db.close();
    };

    tx.onerror = () => {
      reject(tx.error ?? new Error("Failed to read plants"));
    };

    tx.onabort = () => {
      reject(tx.error ?? new Error("Failed to read plants"));
    };
  });
}

export async function dbGetPlant(id: string): Promise<PlantDbRecord | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      if (!request.result) {
        resolve(null);
        return;
      }

      resolve(normalizePlantRecord(request.result));
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to read plant"));
    };

    tx.oncomplete = () => {
      db.close();
    };

    tx.onerror = () => {
      reject(tx.error ?? new Error("Failed to read plant"));
    };

    tx.onabort = () => {
      reject(tx.error ?? new Error("Failed to read plant"));
    };
  });
}

export async function dbPutPlant(record: PlantDbRecord): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.put(record);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      reject(tx.error ?? new Error("Failed to save plant"));
    };

    tx.onabort = () => {
      reject(tx.error ?? new Error("Failed to save plant"));
    };
  });
}

export async function dbDeletePlant(id: string): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.delete(id);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      reject(tx.error ?? new Error("Failed to delete plant"));
    };

    tx.onabort = () => {
      reject(tx.error ?? new Error("Failed to delete plant"));
    };
  });
}

export async function dbClearPlants(): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    store.clear();

    tx.oncomplete = () => {
      db.close();
      resolve();
    };

    tx.onerror = () => {
      reject(tx.error ?? new Error("Failed to clear plants"));
    };

    tx.onabort = () => {
      reject(tx.error ?? new Error("Failed to clear plants"));
    };
  });
}
