"use client";

import { getDb, STORES } from "./db";

export type OutboxItem = {
  seq?: number;
  kind: "highlight.create" | "note.upsert" | "bucket.create" | "desk.update";
  payload: unknown;
  createdAt: string;
  attempts: number;
};

export async function enqueue(item: Omit<OutboxItem, "seq" | "attempts" | "createdAt">): Promise<number> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.outbox, "readwrite");
    const req = tx.objectStore(STORES.outbox).add({
      ...item,
      attempts: 0,
      createdAt: new Date().toISOString(),
    } as OutboxItem);
    req.onsuccess = () => resolve(req.result as number);
    req.onerror = () => reject(req.error);
  });
}

export async function peekAll(): Promise<OutboxItem[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.outbox, "readonly");
    const req = tx.objectStore(STORES.outbox).getAll();
    req.onsuccess = () => resolve(req.result as OutboxItem[]);
    req.onerror = () => reject(req.error);
  });
}

export async function drop(seq: number): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.outbox, "readwrite");
    tx.objectStore(STORES.outbox).delete(seq);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function bumpAttempt(seq: number): Promise<void> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.outbox, "readwrite");
    const store = tx.objectStore(STORES.outbox);
    const getReq = store.get(seq);
    getReq.onsuccess = () => {
      const item = getReq.result as OutboxItem | undefined;
      if (!item) return;
      store.put({ ...item, attempts: item.attempts + 1 });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
