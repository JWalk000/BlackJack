/**
 * Browser bytes for deal project files (IndexedDB).
 * Cloud path (when signed in) is stored on deal.project.files.cloudPath.
 */

const DB_NAME = "estate-arc-files";
const DB_VERSION = 1;
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

function key(dealId: string, fileId: string): string {
  return `${dealId}::${fileId}`;
}

export async function putLocalFileBlob(
  dealId: string,
  fileId: string,
  blob: Blob,
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB write failed"));
    tx.objectStore(STORE).put(blob, key(dealId, fileId));
  });
  db.close();
}

export async function getLocalFileBlob(
  dealId: string,
  fileId: string,
): Promise<Blob | null> {
  try {
    const db = await openDb();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key(dealId, fileId));
      req.onsuccess = () => {
        const v = req.result;
        resolve(v instanceof Blob ? v : null);
      };
      req.onerror = () => reject(req.error ?? new Error("IndexedDB read failed"));
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}

export async function deleteLocalFileBlob(
  dealId: string,
  fileId: string,
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () =>
        reject(tx.error ?? new Error("IndexedDB delete failed"));
      tx.objectStore(STORE).delete(key(dealId, fileId));
    });
    db.close();
  } catch {
    /* ignore */
  }
}
