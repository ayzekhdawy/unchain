import { bookFromText, type Book } from "./books";
import { ImportError } from "./import";

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

export async function readScan(file: Blob): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("tur", 1, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr",
    langPath: "/ocr",
    gzip: true
  });
  try {
    const result = await worker.recognize(file);
    return result.data.text ?? "";
  } finally {
    await worker.terminate();
  }
}
