"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";

export function PdfPreview({ url, name }: { url: string; name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let task: PDFDocumentLoadingTask | undefined;
    async function load() {
      try {
        const [reader, response] = await Promise.all([
          import("pdfjs-dist"),
          fetch(url, { signal: controller.signal, credentials: "same-origin", referrerPolicy: "no-referrer" }),
        ]);
        if (!response.ok) throw new Error("PDF unavailable");
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (controller.signal.aborted) return;
        const assets = `/pdf-assets/${reader.version}/`;
        reader.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker.min.mjs`;
        // Draw pages only. Do not enable PDF scripts, forms or annotation actions.
        task = reader.getDocument({
          data: bytes,
          enableXfa: false,
          useWasm: false,
          cMapUrl: `${assets}cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${assets}standard_fonts/`,
          wasmUrl: `${assets}wasm/`,
          maxImageSize: 24_000_000,
          canvasMaxAreaInBytes: 16_000_000,
        });
        const document = await task.promise;
        if (!controller.signal.aborted) setPdf(document);
      } catch {
        if (!controller.signal.aborted) {
          setBusy(false);
          setError("PDF 无法预览，请下载后查看");
        }
      }
    }
    void load();
    return () => {
      controller.abort();
      void task?.destroy().catch(() => {});
    };
  }, [url]);

  useEffect(() => {
    if (!pdf) return;
    let cancelled = false;
    let render: RenderTask | undefined;
    async function draw() {
      try {
        const documentPage = await pdf!.getPage(page);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        const original = documentPage.getViewport({ scale: 1 });
        if (!Number.isFinite(original.width * original.height) || original.width <= 0 || original.height <= 0) {
          throw new Error("Invalid page dimensions");
        }
        const density = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.min(canvas.parentElement?.clientWidth || 720, 900);
        const scale = Math.min(width * density / original.width,
          Math.sqrt(4_000_000 / (original.width * original.height)),
          8192 / original.width, 8192 / original.height);
        const viewport = documentPage.getViewport({ scale });
        canvas.width = Math.max(1, Math.ceil(viewport.width));
        canvas.height = Math.max(1, Math.ceil(viewport.height));
        canvas.style.width = `${viewport.width / density}px`;
        delete canvas.dataset.rendered;
        render = documentPage.render({ canvas, canvasContext: context, viewport, annotationMode: 0 });
        await render.promise;
        if (!cancelled) {
          canvas.dataset.rendered = "true";
          setBusy(false);
        }
      } catch {
        if (!cancelled) {
          setBusy(false);
          setError("这一页无法预览，请下载后查看");
        }
      }
    }
    void draw();
    return () => { cancelled = true; render?.cancel(); };
  }, [pdf, page]);

  function changePage(next: number) {
    setBusy(true);
    setError("");
    setPage(next);
  }

  return (
    <div className="p-3">
      {pdf && <div className="mb-3 flex items-center justify-center gap-3 text-sm">
        <button type="button" className="btn-xs" disabled={page <= 1 || busy} onClick={() => changePage(page - 1)}>上一页</button>
        <span aria-live="polite">{page} / {pdf.numPages}</span>
        <button type="button" className="btn-xs" disabled={page >= pdf.numPages || busy} onClick={() => changePage(page + 1)}>下一页</button>
      </div>}
      {busy && <p role="status" className="mb-2 text-center text-sm text-muted">加载中…</p>}
      {error && <p role="alert" className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="max-h-[65vh] overflow-auto">
        <canvas ref={canvasRef} role="img" aria-label={`${name}，第 ${page} 页`} className="mx-auto h-auto max-w-full bg-white" />
      </div>
    </div>
  );
}
