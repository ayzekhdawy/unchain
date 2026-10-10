import { bookFromText, emptyLibrary, normalizeLibrary } from "../lib/books";
import { QUEUE_CAP, cleanQueue, dropBookQueue, enqueueBook, moveQueued, removeQueued, takeNext } from "../lib/kuyruk";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const fresh = emptyLibrary();
assert(fresh.queue.length === 0, "boş");
const sample = fresh.books[0];
const added = enqueueBook(fresh, sample.id);
assert(added.queue.length === 1 && added.queue[0] === sample.id, "ekle");
assert(enqueueBook(added, sample.id) === added, "tekrar");
assert(enqueueBook(added, "yok") === added, "yok");

const second = bookFromText("İkinci", "Sen", "Kapı açıldı. Oda sessizdi.", "text");
const third = bookFromText("Üçüncü", "Sen", "Sabah oldu.", "text");
let lib = { ...added, books: [sample, second, third] };
lib = enqueueBook(lib, second.id);
lib = enqueueBook(lib, third.id);
assert(lib.queue.join(",") === [sample.id, second.id, third.id].join(","), "sıra");
const down = moveQueued(lib, sample.id, 1);
assert(down.queue[0] === second.id && down.queue[1] === sample.id, "aşağı");
assert(moveQueued(down, second.id, -1) === down, "başta yukarı");
const removed = removeQueued(down, sample.id);
assert(!removed.queue.includes(sample.id) && removed.queue.length === 2, "çıkar");
assert(removeQueued(removed, sample.id) === removed, "çıkmış");

const many = Array.from({ length: QUEUE_CAP + 3 }, (_, index) => bookFromText(`Kitap ${index}`, "Sen", `Cümle ${index}.`, "text"));
let capped = { ...fresh, books: many, queue: [] as string[] };
for (const book of many) capped = enqueueBook(capped, book.id);
assert(capped.queue.length === QUEUE_CAP, "tavan");
assert(capped.queue[0] === many[0].id, "ilk durur");
assert(!capped.queue.includes(many[QUEUE_CAP].id), "fazla düşer");

const dirty = cleanQueue([second.id, second.id, "yok", 4, null, third.id, sample.id], [sample, second, third]);
assert(dirty.join(",") === [second.id, third.id, sample.id].join(","), "temiz");
const long = cleanQueue(
  many.map((book) => book.id),
  many
);
assert(long.length === QUEUE_CAP, "temiz tavan");

const archived = { ...third, archived: true };
const held = { ...fresh, books: [sample, second, archived], queue: [archived.id, second.id, sample.id] };
const next = takeNext(held, sample.id);
assert(next.bookId === second.id, "sıradaki");
assert(next.library.queue.length === 0, "arşiv ve biten düşer");
const onlyDone = takeNext({ ...fresh, books: [sample, second], queue: [sample.id] }, sample.id);
assert(onlyDone.bookId === null && onlyDone.library.queue.length === 0, "biten tek");
const none = takeNext(fresh, sample.id);
assert(none.bookId === null && none.library === fresh, "boş kuyruk");

const dropped = dropBookQueue({ ...fresh, books: [second], queue: [sample.id, second.id] }, sample.id);
assert(dropped.queue.join(",") === second.id, "silinen");

const old = normalizeLibrary({
  profileName: "ada",
  books: fresh.books,
  currentId: sample.id,
  cursor: fresh.cursor
});
assert(old.queue.length === 0, "eski kayıt");
const kept = normalizeLibrary({ ...added, queue: [sample.id, "yok"] });
assert(kept.queue.length === 1 && kept.queue[0] === sample.id, "saklanır");

console.log("kuyruk tamam");
