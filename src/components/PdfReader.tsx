"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { pdfjs } from "@/lib/pdf/worker";
import { WebHighlightRenderer } from "@/lib/pdf/web";
import type { HighlightModel } from "@/lib/highlights/model";

type Source = { url: string } | { data: ArrayBuffer };

type Props = {
  source: Source;
  highlights?: HighlightModel[];
  onSelectionCaptured?: (draft: Omit<HighlightModel, "id" | "documentId" | "color">) => void;
  scale?: number;
};

export function PdfReader({ source, highlights = [], onSelectionCaptured, scale = 1.2 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const renderer = useMemo(() => new WebHighlightRenderer(), []);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    (async () => {
      try {
        container.replaceChildren();
        const task = pdfjs.getDocument(
          "url" in source ? { url: source.url } : { data: source.data },
        );
        const doc = await task.promise;
        if (cancelled) return;
        setPageCount(doc.numPages);

        for (let n = 1; n <= doc.numPages; n += 1) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const viewport = page.getViewport({ scale });

          const wrap = document.createElement("div");
          wrap.className = "relative mx-auto my-6 shadow-sm";
          wrap.style.width = `${viewport.width}px`;
          wrap.style.height = `${viewport.height}px`;
          wrap.dataset.pageNumber = String(n);
          wrap.dataset.viewportWidth = String(viewport.width);
          wrap.dataset.viewportHeight = String(viewport.height);

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "block";

          const textLayer = document.createElement("div");
          textLayer.className = "absolute inset-0 select-text text-transparent";
          textLayer.style.userSelect = "text";

          wrap.appendChild(canvas);
          wrap.appendChild(textLayer);
          container.appendChild(wrap);

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;

          const textContent = await page.getTextContent();
          const layer = new pdfjs.TextLayer({
            textContentSource: textContent,
            container: textLayer,
            viewport,
          });
          await layer.render();
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, scale]);

  useEffect(() => {
    if (!onSelectionCaptured) return;
    const handler = async () => {
      const draft = await renderer.captureSelection(null);
      if (draft) onSelectionCaptured(draft);
    };
    document.addEventListener("mouseup", handler);
    document.addEventListener("touchend", handler);
    return () => {
      document.removeEventListener("mouseup", handler);
      document.removeEventListener("touchend", handler);
    };
  }, [renderer, onSelectionCaptured]);

  return (
    <div className="w-full">
      {error && <div className="border border-red-400 p-3 text-sm text-red-700">{error}</div>}
      <div ref={containerRef} className="w-full overflow-auto" />
      {pageCount > 0 && <div className="mt-2 text-xs opacity-60">{pageCount} pages</div>}
      <HighlightOverlay highlights={highlights} />
    </div>
  );
}

function HighlightOverlay({ highlights }: { highlights: HighlightModel[] }) {
  useEffect(() => {
    // Paint highlights as translucent overlays on top of the text layer.
    // Runs after PdfReader's page-render effect populates data-page-number
    // elements in the DOM.
    const pages = document.querySelectorAll<HTMLElement>("[data-page-number]");
    pages.forEach((page) => {
      page.querySelectorAll("[data-highlight]").forEach((el) => el.remove());
    });

    highlights.forEach((h) => {
      h.rects.forEach((r) => {
        const page = document.querySelector<HTMLElement>(
          `[data-page-number="${r.page}"]`,
        );
        if (!page) return;
        const el = document.createElement("div");
        el.dataset.highlight = h.id;
        el.className = "pointer-events-none absolute";
        el.style.left = `${r.x * 100}%`;
        el.style.top = `${r.y * 100}%`;
        el.style.width = `${r.w * 100}%`;
        el.style.height = `${r.h * 100}%`;
        el.style.backgroundColor = h.color || "rgba(255, 230, 0, 0.35)";
        el.style.mixBlendMode = "multiply";
        page.appendChild(el);
      });
    });
  }, [highlights]);

  return null;
}
