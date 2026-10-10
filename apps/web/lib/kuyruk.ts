import type { Book, Library } from "./books";

export const QUEUE_CAP = 24;

function known(books: Book[]) {
  return new Map(books.map((book) => [book.id, book]));
}

export function cleanQueue(raw: unknown, books: Book[]): string[] {
  if (!Array.isArray(raw) || !Array.isArray(books)) return [];
  const ids = known(books);
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !ids.has(item) || out.includes(item)) continue;
    out.push(item);
    if (out.length >= QUEUE_CAP) break;
  }
  return out;
}

export function enqueueBook(lib: Library, bookId: string): Library {
  if (!lib.books.some((book) => book.id === bookId)) return lib;
  if (lib.queue.includes(bookId) || lib.queue.length >= QUEUE_CAP) return lib;
  return { ...lib, queue: [...lib.queue, bookId] };
}

export function removeQueued(lib: Library, bookId: string): Library {
  if (!lib.queue.includes(bookId)) return lib;
  return { ...lib, queue: lib.queue.filter((id) => id !== bookId) };
}

export function moveQueued(lib: Library, bookId: string, direction: -1 | 1): Library {
  const index = lib.queue.indexOf(bookId);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= lib.queue.length) return lib;
  const queue = lib.queue.slice();
  const [item] = queue.splice(index, 1);
  queue.splice(next, 0, item);
  return { ...lib, queue };
}

export function dropBookQueue(lib: Library, bookId: string): Library {
  return removeQueued(lib, bookId);
}

export function takeNext(lib: Library, finishedId: string): { library: Library; bookId: string | null } {
  const ids = known(lib.books);
  const waiting = lib.queue.filter((id) => {
    const book = ids.get(id);
    return Boolean(book && !book.archived && id !== finishedId);
  });
  if (waiting.length === 0) {
    const cleaned = lib.queue.filter((id) => ids.has(id) && id !== finishedId);
    return { library: cleaned.length === lib.queue.length ? lib : { ...lib, queue: cleaned }, bookId: null };
  }
  return { library: { ...lib, queue: waiting.slice(1) }, bookId: waiting[0] };
}
