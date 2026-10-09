import type { TextBlock } from "./structure";

export type Sentence = { id: string; text: string };
export type Chapter = { id: string; title: string; sentences: Sentence[] };
export type BookSource = "text" | "txt" | "md" | "pdf" | "epub" | "docx" | "link" | "scan" | "sample";

export type Book = {
  id: string;
  title: string;
  author: string;
  source: BookSource;
  minutes: number;
  cover: string;
  archived: boolean;
  unread: boolean;
  collection: string | null;
  chapters: Chapter[];
};

export type Cursor = { bookId: string; chapter: number; sentence: number; word: number };

export type Library = {
  profileName: string;
  speed: number;
  pronunciations: { from: string; to: string }[];
  books: Book[];
  currentId: string | null;
  cursor: Cursor | null;
};

const COVERS = [
  "linear-gradient(160deg,#3d4c63,#8e7d9b)",
  "linear-gradient(160deg,#7eb8c9,#d7efe8)",
  "linear-gradient(160deg,#c4a46a,#6e4b2a)",
  "linear-gradient(160deg,#8a3d3d,#e7c7a1)",
  "linear-gradient(160deg,#1f3d34,#7dcea0)"
];

let seq = 0;
function nid(prefix: string) {
  seq += 1;
  return `${prefix}-${seq}-${Math.random().toString(36).slice(2, 8)}`;
}

export function minutesFor(text: string) {
  return Math.max(1, Math.round(text.replace(/\s+/g, " ").trim().length / 900));
}

export function coverFromTitle(title: string): string {
  let hash = 0;
  for (const ch of title) hash = (hash * 33 + ch.charCodeAt(0)) >>> 0;
  return COVERS[hash % COVERS.length];
}

export function bookFromBlocks(
  title: string,
  author: string,
  blocks: TextBlock[],
  source: BookSource,
  cover?: string
): Book {
  const chapters: Chapter[] = [];
  let current: Chapter = { id: nid("c"), title: "Başlangıç", sentences: [] };

  const pushSentence = (text: string) => {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean) current.sentences.push({ id: nid("s"), text: clean });
  };

  for (const block of blocks) {
    const text = block.text.replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (block.kind === "heading") {
      if (current.sentences.length) chapters.push(current);
      current = { id: nid("c"), title: text, sentences: [] };
      continue;
    }
    for (const part of text.split(/(?<=[.!?…])\s+/)) pushSentence(part);
  }
  if (current.sentences.length) chapters.push(current);
  if (!chapters.length) {
    const fallback = blocks.map((block) => block.text).join(" ").replace(/\s+/g, " ").trim() || "Boş metin.";
    chapters.push({
      id: nid("c"),
      title: "Metin",
      sentences: [{ id: nid("s"), text: fallback }]
    });
  }
  const flat = chapters.flatMap((chapter) => chapter.sentences.map((sentence) => sentence.text)).join(" ");
  const safeTitle = title.trim() || "Adsız metin";
  return {
    id: nid("b"),
    title: safeTitle,
    author: author.trim() || "Sen",
    source,
    minutes: minutesFor(flat),
    cover: cover ?? coverFromTitle(safeTitle),
    archived: false,
    unread: true,
    collection: null,
    chapters
  };
}

export function bookFromText(title: string, author: string, raw: string, source: BookSource): Book {
  const blocks: TextBlock[] = raw
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((block) => ({
      kind: block.length < 80 && !/[.!?…]$/.test(block) ? "heading" : "paragraph",
      text: block.replace(/\s+/g, " ").trim()
    }));
  return bookFromBlocks(title, author, blocks, source);
}

export const SAMPLE: Book = {
  id: "sample-gece",
  title: "Gece okuması",
  author: "Unchain",
  source: "sample",
  minutes: 2,
  cover: COVERS[0],
  archived: false,
  unread: false,
  collection: null,
  chapters: [
    {
      id: "c1",
      title: "İlk sayfa",
      sentences: [
        { id: "s1", text: "Gece inince oda küçülür." },
        { id: "s2", text: "Masanın üstündeki kitap, kapattığın yerden nefes alır." },
        { id: "s3", text: "Unchain bu nefesi telefonda ses yapar." },
        { id: "s4", text: "Metin senden çıkmaz." },
        { id: "s5", text: "Ses de senden çıkmaz." }
      ]
    },
    {
      id: "c2",
      title: "Cümle cümle",
      sentences: [
        { id: "s6", text: "Bir cümle biter, yeşil kapsül bir sonrakine kayar." },
        { id: "s7", text: "On beş saniye geri, otuz saniye ileri." },
        { id: "s8", text: "Uyku zamanı gelince ses susar." },
        { id: "s9", text: "Bölümün adı çubuğun üstünde durur." }
      ]
    },
    {
      id: "c3",
      title: "Kendi metnin",
      sentences: [
        { id: "s10", text: "PDF, EPUB, düz yazı ya da bir bağlantı." },
        { id: "s11", text: "Üstbilgi ve sayfa numarası içeri girmez." },
        { id: "s12", text: "Sayılar, tarihler ve kısaltmalar söyleyiş sözlüğünden geçer." },
        { id: "s13", text: "Ema tek bir sestir." },
        { id: "s14", text: "Bu ses yapay zekâ ile üretilmiştir." }
      ]
    }
  ]
};

export function emptyLibrary(): Library {
  return {
    profileName: "okur",
    speed: 1,
    pronunciations: [{ from: "Unchain", to: "ançeyn" }],
    books: [{ ...SAMPLE, unread: false }],
    currentId: SAMPLE.id,
    cursor: { bookId: SAMPLE.id, chapter: 0, sentence: 0, word: 0 }
  };
}

export function applySpeech(text: string, pairs: { from: string; to: string }[]) {
  let out = text;
  for (const pair of pairs) {
    const from = pair.from.trim();
    const to = pair.to.trim();
    if (!from || !to) continue;
    out = out.split(from).join(to);
  }
  return out;
}

export function progressOf(book: Book, cursor: Cursor | null) {
  const total = book.chapters.reduce((n, c) => n + c.sentences.length, 0) || 1;
  if (!cursor || cursor.bookId !== book.id) return 0;
  let seen = 0;
  for (let i = 0; i < book.chapters.length; i++) {
    if (i < cursor.chapter) seen += book.chapters[i].sentences.length;
  }
  seen += cursor.sentence;
  return Math.min(1, seen / total);
}

export function sentenceAt(book: Book, cursor: Cursor) {
  const chapter = book.chapters[cursor.chapter] ?? book.chapters[0];
  const sentence = chapter.sentences[cursor.sentence] ?? chapter.sentences[0];
  return { chapter, sentence };
}

export function moveSentences(book: Book, cursor: Cursor, delta: number): Cursor {
  let chapter = cursor.chapter;
  let sentence = cursor.sentence + delta;
  while (sentence < 0 && chapter > 0) {
    chapter -= 1;
    sentence += book.chapters[chapter].sentences.length;
  }
  while (chapter < book.chapters.length - 1 && sentence >= book.chapters[chapter].sentences.length) {
    sentence -= book.chapters[chapter].sentences.length;
    chapter += 1;
  }
  const max = book.chapters[chapter].sentences.length - 1;
  return { bookId: book.id, chapter, sentence: Math.max(0, Math.min(max, sentence)), word: 0 };
}

export function moveBySeconds(book: Book, cursor: Cursor, seconds: number, speed: number) {
  const chars = Math.round((900 / 60) * seconds * speed);
  let chapter = cursor.chapter;
  let sentence = cursor.sentence;
  let left = chars;
  const dir = seconds >= 0 ? 1 : -1;
  while (left > 0) {
    const text = book.chapters[chapter].sentences[sentence]?.text ?? "";
    if (text.length >= left && dir > 0) break;
    if (dir > 0 && text.length < left) {
      left -= text.length;
      const next = moveSentences(book, { bookId: book.id, chapter, sentence, word: 0 }, 1);
      if (next.chapter === chapter && next.sentence === sentence) break;
      chapter = next.chapter;
      sentence = next.sentence;
      continue;
    }
    left += text.length;
    const prev = moveSentences(book, { bookId: book.id, chapter, sentence, word: 0 }, -1);
    if (prev.chapter === chapter && prev.sentence === sentence) break;
    chapter = prev.chapter;
    sentence = prev.sentence;
  }
  return { bookId: book.id, chapter, sentence, word: 0 };
}
