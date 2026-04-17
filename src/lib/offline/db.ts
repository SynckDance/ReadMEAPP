"use client";

// Minimal IndexedDB wrapper. Enough surface for the Desk cache and the
// outbox; no extra dependency. Not a general-purpose IDB lib.

const DB_NAME = "readme-offline";
const DB_VERSION = 1;

export const STORES = {
  docs: "docs",            // Cached document metadata + bodies
  highlights: "highlights", // Highlights keyed by document_id
  notes: "notes",           // Notes keyed by desk_id
  outlines: "outlines",     // Outline JSON keyed by document_id
  outbox: "outbox",         // Pending writes, auto-increment
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.docs)) {
        db.createObjectStore(STORES.docs, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.highlights)) {
        const s = db.createObjectStore(STORES.highlights, { keyPath: "id" });
        s.createIndex("by_doc", "documentId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.notes)) {
        const s = db.createObjectStore(STORES.notes, { keyPath: "id" });
        s.createIndex("by_desk", "deskId", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.outlines)) {
        db.createObjectStore(STORES.outlines, { keyPath: "documentId" });
      }
      if (!db.objectStoreNames.contains(STORES.outbox)) {
        db.createObjectStore(STORES.outbox, { keyPath: "seq", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function put<T>(store: string, value: T): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value as unknown as object);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function get<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll<T>(store: string): Promise<T[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllByIndex<T>(
  store: string,
  indexName: string,
  key: IDBValidKey,
): Promise<T[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).index(indexName).getAll(key);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function del(store: string, key: IDBValidKey): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
