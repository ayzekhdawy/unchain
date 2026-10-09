import { CATALOG, bookFromCatalog } from "../lib/catalog";
import { addCollection, assignCollection, bookHaystack, emptyLibrary, formatSpoken, normalizeLibrary, shelfKind } from "../lib/books";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const ids = new Set<string>();
for (const work of CATALOG) {
  assert(!ids.has(work.id), work.id);
  ids.add(work.id);
  assert(work.title.length > 1, work.title);
  assert(work.author.length > 1, work.author);
  assert(work.text.length > 80, `${work.id} kısa`);
  assert(work.sourceUrl.startsWith("https://tr.wikisource.org/"), work.sourceUrl);
  const end = Date.parse(`${work.termEnd}T00:00:00Z`);
  assert(end < Date.parse("2026-10-09T00:00:00Z"), `${work.id} süre`);
  const book = bookFromCatalog(work);
  assert(book.id === work.id, book.id);
  assert(book.source === "pd", book.source);
  assert(shelfKind(book) === "kitap", work.id);
  assert(book.chapters.some((chapter) => chapter.sentences.length > 0), work.id);
}

const kir = CATALOG.find((work) => work.id === "pd-kir-sinegi");
const yalniz = CATALOG.find((work) => work.id === "pd-yalnizlik");
const yasamak = CATALOG.find((work) => work.id === "pd-yasamak");
assert(Boolean(kir && yalniz && yasamak), "üç kayıt");
assert(kir!.text.includes("kır sineği"), "kır sineği");
assert(yalniz!.text.includes("Atımın nal sadası"), "yalnızlık");
assert(yasamak!.text.includes("kolay değil yaşamak"), "yaşamak");
assert(bookHaystack(bookFromCatalog(kir!)).includes("kır sineği"), "arama");

const fresh = emptyLibrary();
assert(fresh.collections.length === 0, "boş koleksiyon");
assert(fresh.spokenSeconds === 0, "süre");
const named = addCollection(fresh, "Gece");
assert(named.collections.length === 1, "ad");
assert(named.books.every((book) => book.collection === null), "ilk kitaba yazılmadı");
const again = addCollection(named, "Gece");
assert(again.collections.length === 1, "tekrar");
const assigned = assignCollection(named, fresh.books[0].id, "Gece");
assert(assigned.books[0].collection === "Gece", "atama");
const cleared = assignCollection(assigned, fresh.books[0].id, null);
assert(cleared.books[0].collection === null, "çıkarma");
assert(cleared.collections.includes("Gece"), "boş ad durur");

const old = normalizeLibrary({
  profileName: "ada",
  speed: 1.2,
  pronunciations: [{ from: "Unchain", to: "ançeyn" }],
  books: fresh.books.map((book) => ({ ...book, collection: "Sonra oku" })),
  currentId: fresh.books[0].id,
  cursor: fresh.cursor
});
assert(old.collections[0] === "Sonra oku", "eski kayıt");
assert(old.spokenSeconds === 0, "eski süre");
assert(formatSpoken(0) === "0 sn", formatSpoken(0));
assert(formatSpoken(75) === "1 dk 15 sn", formatSpoken(75));
assert(shelfKind({ ...fresh.books[0], source: "pdf" }) === "ice", "pdf");
assert(shelfKind({ ...fresh.books[0], source: "link" }) === "link", "link");
assert(shelfKind({ ...fresh.books[0], source: "text" }) === "metin", "metin");

console.log("katalog tamam");
