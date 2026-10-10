import { bookFromScan } from "../lib/tara";
import { ImportError } from "../lib/import";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

const book = bookFromScan("Filiz sabah çayını içti.\nİkinci satır da durur.", "Profil");
assert(book.source === "scan", book.source);
assert(book.title.startsWith("Filiz"), book.title);
assert(book.author === "Profil", book.author);
const spoken = book.chapters.flatMap((chapter) => chapter.sentences.map((sentence) => sentence.text)).join(" ");
assert(spoken.includes("Filiz") && spoken.includes("İkinci satır"), spoken);

let short = false;
try {
  bookFromScan("kısa", "Profil");
} catch (err) {
  short = true;
  assert(err instanceof ImportError && err.message.includes("okunacak metin"), err instanceof ImportError ? err.message : String(err));
}
assert(short, "kısa tarama kitap üretti");
console.log("tara tamam");
