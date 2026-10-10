import { bookFromText, emptyLibrary, normalizeLibrary, type Cursor } from "../lib/books";
import { BOOKMARK_CAP, bookmarkLabel, cleanBookmarks, dropBookBookmarks, toggleBookmark } from "../lib/yer-imi";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const fresh = emptyLibrary();
assert(fresh.bookmarks.length === 0, "boş");
const sample = fresh.books[0];
const start: Cursor = { bookId: sample.id, chapter: 0, sentence: 0, word: 0 };
assert(bookmarkLabel(sample, start) === "İlk sayfa · Gece inince oda küçülür.", bookmarkLabel(sample, start));

const placed = toggleBookmark(fresh, sample, start);
assert(placed.bookmarks.length === 1, "koy");
assert(placed.bookmarks[0].label.startsWith("İlk sayfa"), placed.bookmarks[0].label);
const removed = toggleBookmark(placed, sample, start);
assert(removed.bookmarks.length === 0, "kaldır");

const sentences = Array.from({ length: 30 }, (_, index) => `Cümle ${index} bitti.`);
const book = bookFromText("Deneme", "Sen", sentences.join(" "), "text");
assert(book.chapters[0].sentences.length === 30, String(book.chapters[0].sentences.length));
let lib = { ...fresh, books: [book], currentId: book.id, cursor: { bookId: book.id, chapter: 0, sentence: 0, word: 0 } };
for (let index = 0; index < BOOKMARK_CAP; index += 1) {
  lib = toggleBookmark(lib, book, { bookId: book.id, chapter: 0, sentence: index, word: 0 });
}
assert(lib.bookmarks.length === BOOKMARK_CAP, "tavan");
lib = toggleBookmark(lib, book, { bookId: book.id, chapter: 0, sentence: 24, word: 0 });
assert(lib.bookmarks.length === BOOKMARK_CAP, "tavan durur");
assert(!lib.bookmarks.some((mark) => mark.sentence === 0), "en eski düşer");
assert(lib.bookmarks.some((mark) => mark.sentence === 24), "yeni durur");
const missed = toggleBookmark(lib, book, { bookId: book.id, chapter: 9, sentence: 0, word: 0 });
assert(missed.bookmarks.length === BOOKMARK_CAP, "dışarı");

const long = bookFromText("Uzun", "Sen", `${"elma ".repeat(8).trim()}.`, "text");
const words = long.chapters[0].sentences[0].text.split(/\s+/).filter(Boolean);
assert(words.length === 8, String(words.length));
let wordLib = { ...fresh, books: [long], currentId: long.id, cursor: { bookId: long.id, chapter: 0, sentence: 0, word: 0 } };
wordLib = toggleBookmark(wordLib, long, { bookId: long.id, chapter: 0, sentence: 0, word: 3 });
assert(wordLib.bookmarks.length === 1 && wordLib.bookmarks[0].word === 3, "sözcük");
const other = toggleBookmark(wordLib, long, { bookId: long.id, chapter: 0, sentence: 0, word: 0 });
assert(other.bookmarks.length === 2, "ayrı sözcük");
const far = toggleBookmark(wordLib, long, { bookId: long.id, chapter: 0, sentence: 0, word: 8 });
assert(far === wordLib, "sözcük dışı");

const dirty = cleanBookmarks(
  [
    { id: "ok", bookId: book.id, chapter: 0, sentence: 1, word: 0, label: "  selam  " },
    { id: "ok", bookId: book.id, chapter: 0, sentence: 1, word: 0, label: "tekrar" },
    { id: "yok", bookId: "missing", chapter: 0, sentence: 0, word: 0, label: "yok" },
    { id: "bad", bookId: book.id, chapter: 4, sentence: 0, word: 0, label: "bad" },
    null,
    "x"
  ],
  [book]
);
assert(dirty.length === 1, "temiz");
assert(dirty[0].label === "selam", dirty[0].label);
assert(dirty[0].id === "ok", dirty[0].id);

const many = Array.from({ length: 30 }, (_, index) => ({
  id: `m-${index}`,
  bookId: book.id,
  chapter: 0,
  sentence: index,
  word: 0,
  label: `Cümle ${index}`
}));
const capped = cleanBookmarks(many, [book]);
assert(capped.length === BOOKMARK_CAP, "temiz tavan");
assert(capped[0].sentence === 6, String(capped[0].sentence));
assert(capped[capped.length - 1].sentence === 29, "son durur");

const old = normalizeLibrary({
  profileName: "ada",
  books: fresh.books,
  currentId: fresh.books[0].id,
  cursor: fresh.cursor
});
assert(old.bookmarks.length === 0, "eski kayıt");
const kept = normalizeLibrary({ ...placed, bookmarks: placed.bookmarks });
assert(kept.bookmarks.length === 1, "saklanır");
assert(kept.bookmarks[0].chapter === 0 && kept.bookmarks[0].word === 0, "konum");

const dropped = dropBookBookmarks(placed, sample.id);
assert(dropped.bookmarks.length === 0, "kitap silinince");
const idle = dropBookBookmarks(fresh, sample.id);
assert(idle === fresh, "yoksa aynı");

const heading = "A".repeat(79);
const wide = bookFromText("X", "Sen", `${heading}\n\n${"kelime ".repeat(12).trim()}.`, "text");
const label = bookmarkLabel(wide, { bookId: wide.id, chapter: 0, sentence: 0, word: 0 });
assert(label.length === 80, String(label.length));
assert(label.startsWith("AAAA"), label);

console.log("yer imi tamam");
