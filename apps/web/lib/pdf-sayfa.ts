import { bookFromText, type Book } from "./books";
import { ImportError } from "./import";

export const PDF_SCAN_CAP = 8;
export const PDF_SCAN_EDGE = 1600;

export function pdfScanScale(width: number, height: number, edge = PDF_SCAN_EDGE) {
  const longest = Math.max(width, height);
  if (!(longest > 0)) return 1;
  return Math.min(2, edge / longest);
}

export function pdfScanTitle(name: string) {
  const base = name.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return (base || "Taranan metin").slice(0, 80);
}

export function joinScanPages(pages: string[]) {
  return pages
    .map((page) => page.replace(/\r\n/g, "\n").trim())
    .filter((page) => page.replace(/\s+/g, "").length > 0)
    .join("\n\n");
}

export function pdfScanWarning(pageCount: number, cap = PDF_SCAN_CAP) {
  if (pageCount <= cap) return null;
  return `İlk ${cap} sayfa okundu.`;
}

export function bookFromPdfScan(text: string, title: string, author: string): Book {
  const clean = text.replace(/\r\n/g, "\n").trim();
  const spoken = clean.replace(/\s+/g, " ").trim();
  if (spoken.length < 10) throw new ImportError("Bu PDF’te okunacak metin çıkmadı.");
  return bookFromText(pdfScanTitle(title), author, clean, "pdf");
}
