"use client";

import * as pdfjs from "pdfjs-dist";

// Configure the pdf.js worker once, on the client.
// Webpack 5 recognizes new URL(..., import.meta.url) and bundles the worker.
if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

export { pdfjs };
