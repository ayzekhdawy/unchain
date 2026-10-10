import { moveBySeconds, type Book, type Cursor } from "../lib/books";

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message);
}

function bookOf(sentences: string[]): Book {
  return {
    id: "b",
    title: "Uzun",
    author: "Profil",
    source: "text",
    minutes: 1,
    cover: "",
    archived: false,
    unread: true,
    collection: null,
    chapters: [{ id: "c", title: "Bölüm", sentences: sentences.map((text, index) => ({ id: `s${index}`, text })) }]
  };
}

const long = Array.from({ length: 80 }, () => "elma").join(" ");
const cursor: Cursor = { bookId: "b", chapter: 0, sentence: 0, word: 0 };
const forward = moveBySeconds(bookOf([long]), cursor, 15, 1);
assert(forward.sentence === 0, `uzun cümle dışına çıktı: ${forward.sentence}`);
assert(forward.word === 45, `15 sn sözcük ${forward.word}`);

const back = moveBySeconds(bookOf([long]), forward, -15, 1);
assert(back.sentence === 0 && back.word === 0, `geri ${back.sentence}:${back.word}`);

const stayed = moveBySeconds(bookOf([long]), cursor, -15, 1);
assert(stayed.word === 0 && stayed.sentence === 0, "baştan geri kaydı");

const shorts = bookOf(["a".repeat(100), "b".repeat(100), "c".repeat(100)]);
const hopped = moveBySeconds(shorts, cursor, 15, 1);
assert(hopped.sentence === 2 && hopped.word === 0, `kısa cümle ${hopped.sentence}:${hopped.word}`);

const faster = moveBySeconds(bookOf([long]), cursor, 15, 2);
assert(faster.word === 79, `hız 2 sözcük ${faster.word}`);

const zero = moveBySeconds(bookOf([long]), { ...cursor, word: 12 }, 0, 1);
assert(zero.word === 12, "sıfır saniye sözcüğü sildi");

console.log("seek tamam");
