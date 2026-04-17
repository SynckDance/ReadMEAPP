import { Capacitor } from "@capacitor/core";
import type { HighlightRenderer } from "@/lib/highlights/model";

// Returns the right renderer for the running platform.
// Web → pdf.js via WebHighlightRenderer.
// iOS (Capacitor native) → PDFKit via NativeHighlightRenderer.
// Android is deferred; will fall through to web for now if ever enabled.
export async function getRenderer(): Promise<HighlightRenderer> {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
    const { NativeHighlightRenderer } = await import("./native");
    return new NativeHighlightRenderer();
  }
  const { WebHighlightRenderer } = await import("./web");
  return new WebHighlightRenderer();
}
