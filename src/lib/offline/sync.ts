"use client";

import { bumpAttempt, drop, peekAll, type OutboxItem } from "./outbox";

// Sync orchestrator.
// - Listens for online/offline events.
// - Drains the outbox when we're online.
// - Each OutboxItem.kind dispatches to a server action / API route
//   registered via registerHandler().

type Handler = (payload: unknown) => Promise<void>;
const handlers: Record<OutboxItem["kind"], Handler | undefined> = {
  "highlight.create": undefined,
  "note.upsert": undefined,
  "bucket.create": undefined,
  "desk.update": undefined,
};

export function registerHandler(kind: OutboxItem["kind"], fn: Handler) {
  handlers[kind] = fn;
}

let draining = false;

export async function drainOutbox(): Promise<void> {
  if (draining) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  draining = true;
  try {
    const items = await peekAll();
    for (const item of items) {
      const fn = handlers[item.kind];
      if (!fn) continue;
      try {
        await fn(item.payload);
        if (item.seq !== undefined) await drop(item.seq);
      } catch {
        if (item.seq !== undefined) await bumpAttempt(item.seq);
      }
    }
  } finally {
    draining = false;
  }
}

export function startSyncLoop() {
  if (typeof window === "undefined") return () => undefined;
  const onOnline = () => void drainOutbox();
  window.addEventListener("online", onOnline);
  // Also try on startup, in case we're already online with a backlog.
  void drainOutbox();
  return () => {
    window.removeEventListener("online", onOnline);
  };
}
