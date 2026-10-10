import { bookFromPdfScan, joinScanPages, pdfScanScale, pdfScanTitle, pdfScanWarning, PDF_SCAN_CAP } from "../lib/pdf-sayfa";
import { ImportError } from "../lib/import";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

assert(PDF_SCAN_CAP === 8, String(PDF_SCAN_CAP));
assert(pdfScanScale(1000, 400) === 1.6, String(pdfScanScale(1000, 400)));
assert(pdfScanScale(400, 200) === 2, String(pdfScanScale(400, 200)));
assert(pdfScanScale(4000, 1000) === 0.4, String(pdfScanScale(4000, 1000)));
assert(pdfScanScale(0, 0) === 1, String(pdfScanScale(0, 0)));
assert(pdfScanScale(0, 10) === 2, String(pdfScanScale(0, 10)));
assert(pdfScanTitle("C:\\Kitap\\filiz-tarama.pdf") === "filiz tarama", pdfScanTitle("filiz-tarama.pdf"));
assert(joinScanPages(["  Filiz sabah.\n", " \n ", "İkinci satır."]) === "Filiz sabah.\n\nİkinci satır.", joinScanPages(["x"]));
assert(pdfScanWarning(8) === null, String(pdfScanWarning(8)));
assert(pdfScanWarning(9) === "İlk 8 sayfa okundu.", String(pdfScanWarning(9)));

const book = bookFromPdfScan("Filiz sabah çayını içti.", "filiz-tarama.pdf", "Profil");
assert(book.source === "pdf", book.source);
assert(book.title === "filiz tarama", book.title);
assert(book.author === "Profil", book.author);
assert(book.unread === true, "okundu başladı");
const spoken = book.chapters.flatMap((chapter) => chapter.sentences.map((sentence) => sentence.text)).join(" ");
assert(spoken.includes("Filiz sabah çayını içti."), spoken);

let short = false;
try {
  bookFromPdfScan("yok", "bos.pdf", "Profil");
} catch (err) {
  short = true;
  assert(err instanceof ImportError && err.message.includes("okunacak metin"), err instanceof ImportError ? err.message : String(err));
}
assert(short, "kısa PDF tarama kitap üretti");
console.log("pdf sayfa tamam");
