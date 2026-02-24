export type PlantDbRecord = {
  id: string;
  createdAt: string;
  nickname: string | null;
  imageBlob: Blob;
};

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

export async function dbGetAllPlants(): Promise<PlantDbRecord[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as PlantDbRecord[]);
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
      resolve((request.result as PlantDbRecord | undefined) ?? null);
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
