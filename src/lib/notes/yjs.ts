import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

// Per-note Yjs doc with local IndexedDB persistence.
// Network sync (Supabase Realtime transport) is layered on top in Phase 0.5c.

export type NoteHandle = {
  doc: Y.Doc;
  persistence: IndexeddbPersistence;
  text: Y.Text;
  destroy: () => Promise<void>;
};

export function openNoteDoc(noteId: string): NoteHandle {
  const doc = new Y.Doc();
  const persistence = new IndexeddbPersistence(`readme-note-${noteId}`, doc);
  const text = doc.getText("body");

  return {
    doc,
    persistence,
    text,
    async destroy() {
      await persistence.destroy();
      doc.destroy();
    },
  };
}

// Server-side: convert a Yjs binary update to a plaintext snapshot for the
// `notes.body_md` column. Use this when the server needs a readable copy
// (search indexing, export) without instantiating a full Yjs runtime.
export function yjsStateToPlainText(state: Uint8Array): string {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, state);
  const text = doc.getText("body").toString();
  doc.destroy();
  return text;
}
