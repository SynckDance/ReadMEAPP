// Shared highlight model. Round-trips between pdf.js (web) and PDFKit (iOS).
// Both renderers emit and consume this shape so highlights stay stable
// when a user opens the same doc on different platforms.

export type PageRect = {
  page: number; // 1-indexed
  x: number;
  y: number;
  w: number;
  h: number;
};

// Text-quote anchor — the surrounding characters around the selection.
// Used to re-anchor the highlight if page coords drift (font substitution,
// re-flow, OCR variance). Matches the W3C Web Annotation TextQuoteSelector.
export type HighlightAnchor = {
  prefix: string;
  exact: string;
  suffix: string;
};

export type HighlightCoordSpace = "normalized" | "points";

export type HighlightModel = {
  id: string;
  documentId: string;
  pages: number[];
  rects: PageRect[];
  text: string;
  anchor: HighlightAnchor;
  color: string;
  coordSpace: HighlightCoordSpace;
};

// Renderer contract. Implemented by the web (pdf.js) and iOS (PDFKit) adapters.
export interface HighlightRenderer {
  render(doc: unknown, highlights: HighlightModel[]): Promise<void>;
  captureSelection(doc: unknown): Promise<Omit<HighlightModel, "id" | "documentId" | "color"> | null>;
}
