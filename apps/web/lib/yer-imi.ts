import type { Book, Cursor, Library } from "./books";

export const BOOKMARK_CAP = 24;

export type Bookmark = {
  id: string;
  bookId: string;
  chapter: number;
  sentence: number;
  word: number;
  label: string;
};

let seq = 0;

function markId() {
  seq += 1;
  return `yim-${seq}-${Math.random().toString(36).slice(2, 8)}`;
}

function spotOk(book: Book, cursor: { chapter: number; sentence: number; word: number }) {
  if (!Array.isArray(book.chapters)) return false;
  if (!Number.isInteger(cursor.chapter) || !Number.isInteger(cursor.sentence) || !Number.isInteger(cursor.word)) return false;
  const chapter = book.chapters[cursor.chapter];
  if (!chapter || !Array.isArray(chapter.sentences)) return false;
  const sentence = chapter.sentences[cursor.sentence];
  if (!sentence || typeof sentence.text !== "string") return false;
  const count = sentence.text.split(/\s+/).filter(Boolean).length;
  return cursor.word >= 0 && cursor.word < Math.max(1, count);
}

export function bookmarkLabel(book: Book, cursor: Cursor) {
  const chapter = book.chapters[cursor.chapter];
  const sentence = chapter?.sentences[cursor.sentence];
  const title = (chapter?.title || "Yer imi").replace(/\s+/g, " ").trim() || "Yer imi";
  const words = (sentence?.text || "").split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  const label = words ? `${title} · ${words}` : title;
  return label.slice(0, 80);
}

function sameSpot(mark: Bookmark, cursor: Cursor) {
  return mark.bookId === cursor.bookId && mark.chapter === cursor.chapter && mark.sentence === cursor.sentence && mark.word === cursor.word;
}

export function bookmarksFor(bookmarks: Bookmark[], bookId: string) {
  return bookmarks.filter((mark) => mark.bookId === bookId);
}

export function bookmarkAt(bookmarks: Bookmark[], cursor: Cursor | null) {
  if (!cursor) return null;
  return bookmarks.find((mark) => sameSpot(mark, cursor)) ?? null;
}

export function cleanBookmarks(raw: unknown, books: Book[]): Bookmark[] {
  if (!Array.isArray(raw) || !Array.isArray(books)) return [];
  const byId = new Map(books.map((book) => [book.id, book]));
  const seen = new Set<string>();
  const valid: Bookmark[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<Bookmark>;
    if (typeof row.bookId !== "string") continue;
    const book = byId.get(row.bookId);
    if (!book) continue;
    const chapter = row.chapter;
    const sentence = row.sentence;
    const word = row.word;
    if (typeof chapter !== "number" || typeof sentence !== "number" || typeof word !== "number") continue;
    if (!Number.isInteger(chapter) || !Number.isInteger(sentence) || !Number.isInteger(word)) continue;
    const cursor = { bookId: row.bookId, chapter, sentence, word };
    if (!spotOk(book, cursor)) continue;
    const key = `${cursor.bookId}|${cursor.chapter}|${cursor.sentence}|${cursor.word}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const fallback = bookmarkLabel(book, cursor);
    const label = typeof row.label === "string" && row.label.trim() ? row.label.replace(/\s+/g, " ").trim().slice(0, 80) : fallback;
    let id = typeof row.id === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(row.id) ? row.id : `yim-k-${valid.length}`;
    if (valid.some((mark) => mark.id === id)) id = `yim-k-${valid.length}`;
    valid.push({ id, bookId: cursor.bookId, chapter: cursor.chapter, sentence: cursor.sentence, word: cursor.word, label });
  }
  const extra = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const mark of valid) counts.set(mark.bookId, (counts.get(mark.bookId) ?? 0) + 1);
  for (const [bookId, count] of counts) {
    if (count > BOOKMARK_CAP) extra.set(bookId, count - BOOKMARK_CAP);
  }
  const out: Bookmark[] = [];
  for (const mark of valid) {
    const left = extra.get(mark.bookId) ?? 0;
    if (left > 0) {
      extra.set(mark.bookId, left - 1);
      continue;
    }
    out.push(mark);
  }
  return out;
}

export function toggleBookmark(lib: Library, book: Book, cursor: Cursor): Library {
  if (cursor.bookId !== book.id || !spotOk(book, cursor)) return lib;
  const hit = bookmarkAt(lib.bookmarks, cursor);
  if (hit) return { ...lib, bookmarks: lib.bookmarks.filter((mark) => mark !== hit) };
  const others = lib.bookmarks.filter((mark) => mark.bookId !== book.id);
  const mine = bookmarksFor(lib.bookmarks, book.id);
  const kept = mine.length >= BOOKMARK_CAP ? mine.slice(mine.length - BOOKMARK_CAP + 1) : mine;
  const mark: Bookmark = {
    id: markId(),
    bookId: book.id,
    chapter: cursor.chapter,
    sentence: cursor.sentence,
    word: cursor.word,
    label: bookmarkLabel(book, cursor)
  };
  return { ...lib, bookmarks: [...others, ...kept, mark] };
}

export function dropBookBookmarks(lib: Library, bookId: string): Library {
  if (!lib.bookmarks.some((mark) => mark.bookId === bookId)) return lib;
  return { ...lib, bookmarks: lib.bookmarks.filter((mark) => mark.bookId !== bookId) };
}
