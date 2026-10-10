import { bookFromText, type Book } from "./books";
import { ImportError } from "./import";
import { bookFromPdfScan, joinScanPages, PDF_SCAN_CAP, pdfScanScale, pdfScanWarning } from "./pdf-sayfa";

export function bookFromScan(text: string, author: string): Book {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  const spoken = clean.replace(/\s+/g, " ").trim();
  if (spoken.length < 10) throw new ImportError("Bu görüntüde okunacak metin çıkmadı.");
  const title = clean
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean)
    ?.slice(0, 80) || "Taranan metin";
  return bookFromText(title, author, clean, "scan");
}

async function openScanWorker() {
  const { createWorker } = await import("tesseract.js");
  return createWorker("tur", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr",
    gzip: true
  });
}

export async function readScan(file: Blob | HTMLCanvasElement): Promise<string> {
  const worker = await openScanWorker();
  try {
    const result = await worker.recognize(file);
    return result.data.text ?? "";
  } finally {
    await worker.terminate();
  }
}

export async function readPdfScan(
  file: Blob,
  title: string,
  author: string,
  onPage?: (index: number, total: number) => void
): Promise<{ book: Book; warning: string | null }> {
  if (typeof document === "undefined") throw new ImportError("Bu PDF sayfası burada görüntülenemiyor.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const data = new Uint8Array(await file.arrayBuffer());
  const loading = pdfjs.getDocument({ data, verbosity: 0, disableFontFace: true, useSystemFonts: false });
  let doc;
  try {
    doc = await loading.promise;
  } catch (err) {
    await loading.destroy().catch(() => undefined);
    const name = err && typeof err === "object" && "name" in err ? String((err as { name: string }).name) : "";
    if (name === "PasswordException") throw new ImportError("Bu PDF parolalı. Parolasız bir kopya seç.");
    throw new ImportError("PDF açılamadı.");
  }
  let worker: Awaited<ReturnType<typeof openScanWorker>> | undefined;
  try {
    worker = await openScanWorker();
    const total = Math.min(doc.numPages, PDF_SCAN_CAP);
    const pages: string[] = [];
    for (let number = 1; number <= total; number += 1) {
      onPage?.(number, total);
      const page = await doc.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: pdfScanScale(base.width, base.height) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.ceil(viewport.width));
      canvas.height = Math.max(1, Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new ImportError("Sayfa görüntüsü açılamadı.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      const result = await worker.recognize(canvas);
      pages.push(result.data.text ?? "");
      page.cleanup();
    }
    return { book: bookFromPdfScan(joinScanPages(pages), title, author), warning: pdfScanWarning(doc.numPages) };
  } finally {
    await worker?.terminate();
    await loading.destroy();
  }
}
