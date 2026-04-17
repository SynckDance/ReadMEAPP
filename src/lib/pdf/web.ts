"use client";

import type {
  HighlightAnchor,
  HighlightModel,
  HighlightRenderer,
  PageRect,
} from "@/lib/highlights/model";
import { pdfjs } from "./worker";

type PdfDoc = Awaited<ReturnType<typeof pdfjs.getDocument extends (...args: unknown[]) => { promise: infer P } ? never : never>>;

const ANCHOR_CONTEXT = 32;

export class WebHighlightRenderer implements HighlightRenderer {
  async render(doc: unknown, highlights: HighlightModel[]): Promise<void> {
    // Rendering overlay is done inline by the React component
    // (see src/components/PdfReader.tsx). This hook is kept on the
    // contract for parity with the iOS PDFKit path, which paints
    // natively. No-op on web.
    void doc;
    void highlights;
  }

  async captureSelection(
    _doc: unknown,
  ): Promise<Omit<HighlightModel, "id" | "documentId" | "color"> | null> {
    if (typeof window === "undefined") return null;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const text = selection.toString().trim();
    if (!text) return null;

    const rects = extractPageRects(range);
    if (rects.length === 0) return null;

    const pages = Array.from(new Set(rects.map((r) => r.page))).sort((a, b) => a - b);
    const anchor = extractAnchor(range, text);

    return {
      pages,
      rects,
      text,
      anchor,
      coordSpace: "normalized",
    };
  }
}

// pdf.js renders each page as a <canvas> wrapped by an element carrying
// data-page-number and data-viewport-* attributes (set by PdfReader).
// We translate DOMRect -> normalized page coords using those attrs.
function extractPageRects(range: Range): PageRect[] {
  const clientRects = Array.from(range.getClientRects());
  const out: PageRect[] = [];

  for (const rect of clientRects) {
    const pageEl = findPageElement(rect);
    if (!pageEl) continue;

    const page = Number(pageEl.dataset.pageNumber);
    const vw = Number(pageEl.dataset.viewportWidth);
    const vh = Number(pageEl.dataset.viewportHeight);
    if (!page || !vw || !vh) continue;

    const pageRect = pageEl.getBoundingClientRect();
    out.push({
      page,
      x: (rect.left - pageRect.left) / pageRect.width,
      y: (rect.top - pageRect.top) / pageRect.height,
      w: rect.width / pageRect.width,
      h: rect.height / pageRect.height,
    });
  }

  return out;
}

function findPageElement(rect: DOMRect): HTMLElement | null {
  const el = document.elementFromPoint(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  );
  return el?.closest<HTMLElement>("[data-page-number]") ?? null;
}

function extractAnchor(range: Range, exact: string): HighlightAnchor {
  const container = range.commonAncestorContainer;
  const root =
    container.nodeType === Node.ELEMENT_NODE
      ? (container as Element)
      : container.parentElement;
  const fullText = root?.textContent ?? exact;

  const idx = fullText.indexOf(exact);
  if (idx < 0) return { prefix: "", exact, suffix: "" };

  return {
    prefix: fullText.slice(Math.max(0, idx - ANCHOR_CONTEXT), idx),
    exact,
    suffix: fullText.slice(idx + exact.length, idx + exact.length + ANCHOR_CONTEXT),
  };
}
