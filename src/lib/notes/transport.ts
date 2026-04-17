"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import * as Y from "yjs";

// Yjs updates are Uint8Array; Supabase broadcast is JSON, so we base64 them.
// Awareness is handled separately on a sibling event.

type TransportOpts = {
  supabase: SupabaseClient;
  noteId: string;
  doc: Y.Doc;
  clientId: string;
};

export function createNoteTransport({ supabase, noteId, doc, clientId }: TransportOpts) {
  const channel = supabase.channel(`note:${noteId}`, {
    config: { broadcast: { self: false } },
  });

  const onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === "remote") return;
    channel.send({
      type: "broadcast",
      event: "y-update",
      payload: { clientId, data: toBase64(update) },
    });
  };

  doc.on("update", onLocalUpdate);

  channel.on("broadcast", { event: "y-update" }, ({ payload }) => {
    if (!payload || payload.clientId === clientId) return;
    try {
      Y.applyUpdate(doc, fromBase64(payload.data), "remote");
    } catch {
      // Malformed update — ignore. Peers stay consistent via the next diff.
    }
  });

  let state: "connecting" | "ready" | "closed" = "connecting";
  const subscribed = channel.subscribe((status) => {
    if (status === "SUBSCRIBED") state = "ready";
  });

  return {
    channel: subscribed,
    status: () => state,
    async destroy() {
      doc.off("update", onLocalUpdate);
      await supabase.removeChannel(channel);
      state = "closed";
    },
  };
}

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export type NoteTransport = ReturnType<typeof createNoteTransport>;

// Awareness channel (presence + cursors). Kept separate so note updates
// are not mixed with ephemeral signal.
export function createAwarenessChannel(supabase: SupabaseClient, deskId: string, channelName: RealtimeChannel["topic"] extends string ? string : string) {
  return supabase.channel(`presence:${deskId}:${channelName}`, {
    config: { presence: { key: channelName } },
  });
}
