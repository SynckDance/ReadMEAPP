"use client";

import type { HighlightModel } from "@/lib/highlights/model";
import { get, getAll, getAllByIndex, put, STORES } from "./db";

export type CachedDoc = {
  id: string;
  title: string;
  sourceType: string;
  body?: ArrayBuffer; // raw PDF/epub/etc bytes
  storagePath: string | null;
  cachedAt: string;
};

export type CachedNote = {
  id: string;
  deskId: string;
  documentId: string | null;
  yjsState: Uint8Array; // last known server state (network-authoritative)
  updatedAt: string;
};

export type CachedOutline = {
  documentId: string;
  model: string;
  json: unknown;
  cachedAt: string;
};

export const cache = {
  docs: {
    put: (d: CachedDoc) => put(STORES.docs, d),
    get: (id: string) => get<CachedDoc>(STORES.docs, id),
    all: () => getAll<CachedDoc>(STORES.docs),
  },
  highlights: {
    put: (h: HighlightModel) => put(STORES.highlights, h),
    byDoc: (documentId: string) =>
      getAllByIndex<HighlightModel>(STORES.highlights, "by_doc", documentId),
  },
  notes: {
    put: (n: CachedNote) => put(STORES.notes, n),
    get: (id: string) => get<CachedNote>(STORES.notes, id),
    byDesk: (deskId: string) =>
      getAllByIndex<CachedNote>(STORES.notes, "by_desk", deskId),
  },
  outlines: {
    put: (o: CachedOutline) => put(STORES.outlines, o),
    get: (documentId: string) => get<CachedOutline>(STORES.outlines, documentId),
  },
};
