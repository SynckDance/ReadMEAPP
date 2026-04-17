import { registerPlugin } from "@capacitor/core";
import type {
  HighlightModel,
  HighlightRenderer,
} from "@/lib/highlights/model";

// Capacitor plugin interface. The iOS side of this contract will be
// implemented by a native PDFKit plugin added in Phase 1.
// The web shim throws — call sites should route via getRenderer()
// in ./platform.ts, not instantiate this directly.
export interface ReadMEAPPPDFKitPlugin {
  openDocument(opts: { url: string } | { path: string }): Promise<{ token: string; pageCount: number }>;
  renderHighlights(opts: { token: string; highlights: HighlightModel[] }): Promise<void>;
  captureSelection(opts: { token: string }): Promise<
    Omit<HighlightModel, "id" | "documentId" | "color"> | null
  >;
  closeDocument(opts: { token: string }): Promise<void>;
}

export const ReadMEAPPPDFKit = registerPlugin<ReadMEAPPPDFKitPlugin>("ReadMEAPPPDFKit", {
  web: () => ({
    async openDocument() {
      throw new Error("ReadMEAPPPDFKit is iOS-only. Use WebHighlightRenderer on web.");
    },
    async renderHighlights() {
      throw new Error("ReadMEAPPPDFKit is iOS-only.");
    },
    async captureSelection() {
      throw new Error("ReadMEAPPPDFKit is iOS-only.");
    },
    async closeDocument() {
      throw new Error("ReadMEAPPPDFKit is iOS-only.");
    },
  }),
});

export class NativeHighlightRenderer implements HighlightRenderer {
  async render(doc: unknown, highlights: HighlightModel[]): Promise<void> {
    const { token } = doc as { token: string };
    await ReadMEAPPPDFKit.renderHighlights({ token, highlights });
  }

  async captureSelection(doc: unknown) {
    const { token } = doc as { token: string };
    return ReadMEAPPPDFKit.captureSelection({ token });
  }
}
