"use client";

import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { createClient } from "@/lib/supabase/client";
import { openNoteDoc, type NoteHandle } from "./yjs";
import { createNoteTransport, type NoteTransport } from "./transport";
import { cache } from "@/lib/offline/cache";

export type UseNoteState = {
  handle: NoteHandle | null;
  transport: NoteTransport | null;
  status: "loading" | "ready" | "error";
  error: string | null;
};

// Client-side hook. Opens a Yjs doc with IndexedDB persistence, connects
// the Supabase Realtime transport, and writes the flattened server state
// to our offline cache on each update.
export function useNote(noteId: string | null, deskId: string | null): UseNoteState {
  const [state, setState] = useState<UseNoteState>({
    handle: null,
    transport: null,
    status: "loading",
    error: null,
  });
  const clientIdRef = useRef(`c-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    if (!noteId || !deskId) return;
    let disposed = false;

    (async () => {
      try {
        const supabase = createClient();
        const handle = openNoteDoc(noteId);
        await handle.persistence.whenSynced;
        if (disposed) {
          await handle.destroy();
          return;
        }

        const transport = createNoteTransport({
          supabase,
          noteId,
          doc: handle.doc,
          clientId: clientIdRef.current,
        });

        // Persist the flattened Yjs state locally on every update so
        // the Desk mirror stays current even when the user is offline.
        const onUpdate = () => {
          const yjsState = Y.encodeStateAsUpdate(handle.doc);
          void cache.notes.put({
            id: noteId,
            deskId,
            documentId: null,
            yjsState,
            updatedAt: new Date().toISOString(),
          });
        };
        handle.doc.on("update", onUpdate);

        setState({ handle, transport, status: "ready", error: null });

        return () => {
          handle.doc.off("update", onUpdate);
        };
      } catch (e: unknown) {
        if (!disposed) {
          setState({
            handle: null,
            transport: null,
            status: "error",
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    })();

    return () => {
      disposed = true;
      setState((s) => {
        void s.transport?.destroy();
        void s.handle?.destroy();
        return { handle: null, transport: null, status: "loading", error: null };
      });
    };
  }, [noteId, deskId]);

  return state;
}
