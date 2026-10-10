"use client";

import { useEffect, useRef, useState } from "react";
import {
  addCollection,
  applySpeech,
  assignCollection,
  bookFromText,
  bookHaystack,
  emptyLibrary,
  formatSpoken,
  moveBySeconds,
  moveSentences,
  normalizeLibrary,
  progressOf,
  sentenceAt,
  shelfKind,
  type AmbientName,
  type Book,
  type Cursor,
  type Library,
  type ReadingTheme,
  type ShelfKind
} from "@/lib/books";
import {
  deleteLibrary,
  fetchLibrary,
  fetchSession,
  logout,
  putLibrary,
  requestLink,
  speakCached,
  uploadOriginal
} from "@/lib/bulut";
import { bookFromCatalog, CATALOG, type CatalogShelf, type CatalogWork } from "@/lib/catalog";
import { emaSpeak, loadEma, resampleLinear, resumeAudio } from "@/lib/ema";
import { FILE_MAX } from "@/lib/hesap";
import { ImportError, importFile } from "@/lib/import";
import { setAmbient, stopAmbient } from "@/lib/ortam";
import { bookFromScan, readScan } from "@/lib/tara";

type View = "home" | "explore" | "library" | "voice" | "account" | "reader" | "write" | "link";
type LibTab = "saved" | "collections" | "archive";
type Sheet = null | "import" | "contents" | "sleep" | "more";
type KindFilter = "hepsi" | ShelfKind;
type ShelfFilter = "hepsi" | CatalogShelf | "ornek";

const AMBIENTS: { id: AmbientName; label: string }[] = [
  { id: "yok", label: "Kapalı" },
  { id: "yagmur", label: "Yağmur" },
  { id: "ocak", label: "Ocak" },
  { id: "oda", label: "Oda" }
];
const THEMES: { id: ReadingTheme; label: string }[] = [
  { id: "gece", label: "Gece" },
  { id: "kagit", label: "Kâğıt" }
];
const FORMAT_NOTE = "PDF, EPUB, DOCX, ODT, RTF, FB2, TXT ve MD bu tarayıcıda açılır.";
const SCAN_NOTE = "PNG, JPEG ve WebP bu tarayıcıda okunur. Görüntü sunucuya gitmez.";

const SLEEP = [
  { id: "off", label: "Kapalı" },
  { id: "chapter", label: "Bölüm bitince" },
  { id: "120", label: "2 saat" },
  { id: "90", label: "1 saat 30 dakika" },
  { id: "60", label: "1 saat" },
  { id: "45", label: "45 dakika" },
  { id: "30", label: "30 dakika" },
  { id: "15", label: "15 dakika" },
  { id: "10", label: "10 dakika" },
  { id: "5", label: "5 dakika" }
];

const NAV: { id: View; label: string }[] = [
  { id: "home", label: "Ana sayfa" },
  { id: "explore", label: "Keşfet" },
  { id: "library", label: "Kitaplık" },
  { id: "voice", label: "Ses" }
];

function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#22262C" />
      <g transform="rotate(-36 32 32)">
        <path
          d="M39 16.5A11 11 0 0 1 44 25.5V39A11 11 0 0 1 22 39V25.5A11 11 0 0 1 31 14.2"
          stroke="#E8A05A"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function UnchainApp() {
  const [lib, setLib] = useState<Library>(emptyLibrary);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("home");
  const [tab, setTab] = useState<LibTab>("saved");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [playing, setPlaying] = useState(false);
  const [word, setWord] = useState(0);
  const [voice, setVoice] = useState<"loading" | "ready" | "generating" | "fallback">("loading");
  const [emaSeconds, setEmaSeconds] = useState<number | null>(null);
  const [voiceError, setVoiceError] = useState("");
  const [sleep, setSleep] = useState("off");
  const [draft, setDraft] = useState("");
  const [link, setLink] = useState("https://");
  const [linkError, setLinkError] = useState("");
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [openBook, setOpenBook] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [openCollection, setOpenCollection] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("hepsi");
  const [shelf, setShelf] = useState<ShelfFilter>("hepsi");
  const [pronFrom, setPronFrom] = useState("");
  const [pronTo, setPronTo] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState("");
  const [girisNote, setGirisNote] = useState("");
  const [pending, setPending] = useState<{ book: Book; warning?: string | null; file?: File } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);
  const sleepUntil = useRef<number | null>(null);
  const emaOk = useRef(true);
  const heardEma = useRef(false);
  const hydrated = useRef(false);
  const cloudGen = useRef(0);

  useEffect(() => {
    let gone = false;
    const raw = localStorage.getItem("unchain.library.v1");
    let local = emptyLibrary();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<Library>;
        if (parsed.books?.length) local = normalizeLibrary(parsed);
      } catch {
        /* tohum kitaplık kalır */
      }
    }
    setLib(local);
    if (new URLSearchParams(window.location.search).get("giris") === "gecersiz") {
      setGirisNote("Bağlantı geçersiz veya kullanılmış.");
      setView("account");
      window.history.replaceState(null, "", "/uygulama");
    }
    void (async () => {
      const session = await fetchSession().catch(() => ({ giris: false, email: null }));
      if (gone) return;
      if (session.giris && session.email) {
        setSessionEmail(session.email);
        const remote = await fetchLibrary().catch(() => null);
        if (gone) return;
        if (remote) setLib(remote);
        else void putLibrary(local);
      }
      hydrated.current = true;
      setReady(true);
    })();
    return () => {
      gone = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || !hydrated.current) return;
    try {
      localStorage.setItem("unchain.library.v1", JSON.stringify(lib));
    } catch {
      setImportNote("Kitaplık bu tarayıcıda dolu. Daha kısa bir dosya dene.");
    }
    if (!sessionEmail) return;
    const gen = cloudGen.current;
    const timer = window.setTimeout(() => {
      if (cloudGen.current !== gen) return;
      void putLibrary(lib);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [lib, ready, sessionEmail]);

  const book = lib.books.find((b) => b.id === (lib.cursor?.bookId ?? lib.currentId)) ?? null;
  const cursor = lib.cursor;

  useEffect(() => {
    if (view !== "reader") return;
    let gone = false;
    setVoice((current) => (current === "ready" || current === "generating" ? current : "loading"));
    loadEma()
      .then(() => {
        if (gone) return;
        emaOk.current = true;
        setVoice((current) => (current === "generating" ? current : "ready"));
      })
      .catch((err: unknown) => {
        if (gone) return;
        emaOk.current = false;
        setVoiceError(err instanceof Error ? err.message : "yükleme");
        setVoice("fallback");
      });
    return () => {
      gone = true;
    };
  }, [view]);

  useEffect(() => {
    if (!playing || !book || !cursor) return;
    const handle = { cancelled: false, timer: 0, source: null as AudioBufferSourceNode | null };
    const spokenBook = sentenceAt(book, cursor);
    const tokens = spokenBook.sentence.text.split(/\s+/);
    const start = Math.max(0, Math.min(cursor.word, Math.max(0, tokens.length - 1)));
    const spokenText = tokens.slice(start).join(" ");
    const prepared = applySpeech(spokenText, lib.pronunciations);
    setWord(start);

    const advance = () => {
      if (handle.cancelled) return;
      if (sleepUntil.current && Date.now() >= sleepUntil.current) {
        setPlaying(false);
        return;
      }
      const next = moveSentences(book, cursor, 1);
      const stuck = next.chapter === cursor.chapter && next.sentence === cursor.sentence;
      if (stuck || (sleep === "chapter" && next.chapter !== cursor.chapter)) {
        setPlaying(false);
        if (!stuck) {
          setLib((prev) => ({
            ...prev,
            cursor: next,
            books: prev.books.map((item) => (item.id === book.id ? { ...item, unread: false } : item))
          }));
        }
        return;
      }
      setWord(0);
      setLib((prev) => ({
        ...prev,
        cursor: next,
        currentId: book.id,
        books: prev.books.map((item) => (item.id === book.id ? { ...item, unread: false } : item))
      }));
    };

    const browser = () => {
      setVoice("fallback");
      const ms = Math.max(700, ((prepared.length / 900) * 60_000) / lib.speed);
      const spokenCount = Math.max(1, tokens.length - start);
      const utter = new SpeechSynthesisUtterance(prepared);
      utter.lang = "tr-TR";
      utter.rate = Math.min(2, Math.max(0.5, lib.speed));
      const voices = window.speechSynthesis.getVoices();
      const turkish = voices.find((item) => item.lang.toLowerCase().startsWith("tr"));
      if (turkish) utter.voice = turkish;
      let step = 0;
      handle.timer = window.setInterval(() => {
        step += 1;
        if (start + step < tokens.length) setWord(start + step);
      }, ms / spokenCount);
      utter.onend = () => {
        if (handle.cancelled) return;
        window.clearInterval(handle.timer);
        advance();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    };

    const run = async () => {
      if (!emaOk.current) {
        browser();
        return;
      }
      setVoice((current) => (current === "fallback" ? current : "generating"));
      const started = performance.now();
      try {
        const upcoming = moveSentences(book, cursor, 1);
        const atEnd = upcoming.chapter === cursor.chapter && upcoming.sentence === cursor.sentence;
        if (!atEnd) {
          const nextText = applySpeech(sentenceAt(book, upcoming).sentence.text, lib.pronunciations);
          void emaSpeak(nextText, lib.speed, 0).catch(() => undefined);
        }
        const clip = await speakCached(prepared, lib.speed, Boolean(sessionEmail));
        if (handle.cancelled) return;
        const ctx = resumeAudio();
        if (!ctx) throw new Error("ses yok");
        if (ctx.state !== "running") await ctx.resume();
        if (handle.cancelled) return;
        const pcm = resampleLinear(clip.pcm, clip.sampleRate, ctx.sampleRate);
        const samples = new Float32Array(Math.max(1, pcm.length));
        if (pcm.length) samples.set(pcm);
        const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
        buffer.copyToChannel(samples, 0);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        handle.source = source;
        source.onended = () => {
          window.clearInterval(handle.timer);
          advance();
        };
        const origin = ctx.currentTime;
        source.start();
        setVoice("ready");
        setVoiceError("");
        if (!clip.fromCache) {
          if (!heardEma.current) {
            heardEma.current = true;
            setEmaSeconds((performance.now() - started) / 1000);
          }
          setLib((prev) => ({ ...prev, spokenSeconds: prev.spokenSeconds + clip.seconds }));
        }
        handle.timer = window.setInterval(() => {
          const at = ctx.currentTime - origin;
          let index = 0;
          while (index + 1 < clip.wordStarts.length && clip.wordStarts[index + 1] <= at) index += 1;
          setWord(tokens.length ? Math.min(start + index, tokens.length - 1) : 0);
        }, 40);
      } catch (err) {
        if (handle.cancelled) return;
        console.error("Ema üretilemedi", err);
        setVoiceError(err instanceof Error ? err.message : "üretim");
        browser();
      }
    };
    void run();
    return () => {
      handle.cancelled = true;
      window.clearInterval(handle.timer);
      if (handle.source) {
        try {
          handle.source.onended = null;
          handle.source.stop();
        } catch {
          /* already ended */
        }
      }
      window.speechSynthesis.cancel();
    };
  }, [playing, book, cursor, lib.speed, lib.pronunciations, sleep, sessionEmail]);

  useEffect(() => {
    document.documentElement.dataset.theme = lib.theme === "kagit" ? "kagit" : "gece";
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [lib.theme]);

  useEffect(() => {
    if (!playing || lib.ambient === "yok") {
      stopAmbient();
      return;
    }
    setAmbient(lib.ambient, lib.ambientLevel);
    return () => stopAmbient();
  }, [playing, lib.ambient, lib.ambientLevel]);

  const saved = lib.books.filter((b) => !b.archived);
  const archived = lib.books.filter((b) => b.archived);
  const collections = lib.collections;

  function patchBook(id: string, patch: Partial<Book>) {
    setLib((prev) => ({ ...prev, books: prev.books.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  }

  function openCatalog(work: CatalogWork) {
    const existing = lib.books.find((item) => item.id === work.id);
    if (existing) openReader(existing);
    else stageBook(bookFromCatalog(work));
  }

  const needle = query.trim().toLocaleLowerCase("tr");
  function hit(item: Book) {
    return !needle || bookHaystack(item).includes(needle);
  }
  const listed =
    tab === "archive"
      ? archived.filter(hit)
      : tab === "collections"
        ? saved.filter((item) => item.collection === openCollection).filter(hit)
        : saved.filter((item) => kind === "hepsi" || shelfKind(item) === kind).filter(hit);

  function openReader(target: Book) {
    setImportNote(null);
    setLib((prev) => ({
      ...prev,
      currentId: target.id,
      cursor:
        prev.cursor?.bookId === target.id
          ? prev.cursor
          : { bookId: target.id, chapter: 0, sentence: 0, word: 0 }
    }));
    const kept = lib.cursor?.bookId === target.id ? lib.cursor : { bookId: target.id, chapter: 0, sentence: 0, word: 0 };
    setWord(kept.word);
    setView("reader");
    setSheet(null);
  }

  function seek(next: Cursor) {
    setWord(next.word);
    setLib((prev) => ({ ...prev, cursor: next, currentId: next.bookId }));
  }

  function skip(seconds: number) {
    if (!book || !cursor) return;
    seek(moveBySeconds(book, cursor, seconds, lib.speed));
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      }
      if (sheet || pending || !book || !cursor) return;
      if (event.code === "Space") {
        if (event.repeat) return;
        event.preventDefault();
        togglePlay();
        return;
      }
      if (event.code !== "ArrowLeft" && event.code !== "ArrowRight") return;
      event.preventDefault();
      const step = event.shiftKey ? 30 : 15;
      skip(event.code === "ArrowLeft" ? -step : step);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, pending, book, cursor, lib.speed]);

  function togglePlay() {
    resumeAudio();
    setPlaying((value) => !value);
  }

  function addBook(next: Book, warning?: string | null) {
    setPlaying(false);
    setImportNote(warning ? warning : null);
    setImportError("");
    setLib((prev) => ({
      ...prev,
      books: [next, ...prev.books],
      currentId: next.id,
      cursor: { bookId: next.id, chapter: 0, sentence: 0, word: 0 }
    }));
    setView("reader");
    setSheet(null);
    setDraft("");
  }

  function stageBook(next: Book, warning?: string | null, file?: File) {
    if (sessionEmail) {
      setSheet(null);
      setPending({ book: next, warning, file });
      return;
    }
    addBook(next, warning);
  }

  async function confirmPending() {
    if (!pending) return;
    const item = pending;
    setPending(null);
    if (item.file) {
      const err = await uploadOriginal(item.book.id, item.file);
      if (err) {
        setImportError(err);
        setSheet("import");
        return;
      }
    }
    addBook(item.book, item.warning);
  }

  async function onFile(file: File) {
    setImportError("");
    if (sessionEmail && file.size > FILE_MAX) {
      setImportError("4 MB üstü dosya bu web kopyasına sığmaz.");
      setSheet("import");
      return;
    }
    setImporting(true);
    try {
      const result = await importFile(file, lib.profileName);
      stageBook(result.book, result.warning, sessionEmail ? file : undefined);
    } catch (err) {
      setImportError(err instanceof ImportError ? err.message : "Dosya açılamadı.");
      setSheet("import");
    } finally {
      setImporting(false);
    }
  }

  async function onScan(file: File) {
    setImportError("");
    const name = file.name.toLowerCase();
    const image = file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/webp" || /\.(png|jpe?g|webp)$/.test(name);
    if (!image) {
      setImportError("Bu görüntü türü açılmıyor. PNG, JPEG veya WebP seç.");
      setSheet("import");
      return;
    }
    if (file.size > FILE_MAX) {
      setImportError("4 MB üstü görüntü taranmaz.");
      setSheet("import");
      return;
    }
    setScanning(true);
    try {
      const text = await readScan(file);
      stageBook(bookFromScan(text, lib.profileName));
    } catch (err) {
      setImportError(err instanceof ImportError ? err.message : "Görüntü okunamadı.");
      setSheet("import");
    } finally {
      setScanning(false);
    }
  }

  async function submitLink() {
    setLinkError("");
    const response = await fetch("/api/baglanti", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: link })
    });
    const data = (await response.json()) as { title?: string; text?: string; error?: string };
    if (!response.ok || !data.text) {
      setLinkError(data.error ?? "Bağlantı açılmadı.");
      return;
    }
    stageBook(bookFromText(data.title ?? "Bağlantı", new URL(link).hostname, data.text, "link"));
  }

  function chooseSleep(id: string) {
    setSleep(id);
    const minutes = Number(id);
    sleepUntil.current = Number.isFinite(minutes) && minutes > 0 ? Date.now() + minutes * 60_000 : null;
    setSheet(null);
  }

  const progress = book && cursor ? progressOf(book, cursor) : 0;
  const chapterTitle = book && cursor ? (book.chapters[cursor.chapter]?.title ?? "") : "";

  return (
    <div className="app">
      <nav className="rail" aria-label="Bölümler">
        <div className="brand" style={{ marginBottom: 18 }}>
          <Mark />
          <b>unchain</b>
        </div>
        {NAV.map((item) => (
          <button key={item.id} className={view === item.id ? "on" : ""} onClick={() => setView(item.id)}>
            {item.label}
          </button>
        ))}
        <button onClick={() => setSheet("import")}>İçe aktar</button>
        <button className={view === "account" ? "on" : ""} onClick={() => setView("account")}>
          Profil
        </button>
      </nav>

      <main className="stage">
        {view === "home" && (
          <>
            <div className="head">
              <h1>Ana sayfa</h1>
            </div>
            <input
              className="field"
              placeholder="Kitap veya cümle ara"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Ara"
            />
            <p className="section-label">Dinlemeye devam</p>
            {book && hit(book) && (
              <button className="bookline" onClick={() => openReader(book)}>
                <span className="cover" style={{ background: book.cover }} />
                <span>
                  <b>{book.title}</b>
                  <span className="meta">
                    {book.author}
                    <br />
                    {chapterTitle ? `${chapterTitle} · ` : ""}
                    {Math.round(progress * 100)}% · {book.minutes} dk
                  </span>
                </span>
              </button>
            )}
            <p className="section-label">Kendi metnini getir</p>
            <div className="chips">
              <button className="chip" onClick={() => setView("write")}>
                Metin yaz
              </button>
              <button className="chip" onClick={() => setView("link")}>
                Bağlantı yapıştır
              </button>
              <button className="chip" disabled={importing} onClick={() => fileRef.current?.click()}>
                {importing ? "Ayrıştırılıyor…" : "Dosya yükle"}
              </button>
            </div>
            <p className="note">
              {sessionEmail
                ? `${FORMAT_NOTE} Kaydetmeden önce kopyanın Vercel’de duracağı söylenir.`
                : `${FORMAT_NOTE} Dosya sunucuya gitmez.`}
            </p>
            <p className="section-label">Rafta</p>
            <div className="cardgrid">
              {saved.filter(hit).slice(0, 4).map((item) => (
                <button key={item.id} className="card" onClick={() => openReader(item)}>
                  <span className="cover" style={{ background: item.cover, display: "block", marginBottom: 12 }} />
                  <b>{item.title}</b>
                  <div className="meta">{item.author}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {view === "explore" && (
          <>
            <h1>Keşfet</h1>
            <input
              className="field"
              placeholder="Açık raflarda ara"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Raflarda ara"
            />
            <div className="pills" style={{ marginTop: 12 }}>
              {(
                [
                  ["hepsi", "Hepsi"],
                  ["hikaye", "Hikâye"],
                  ["siir", "Şiir"],
                  ["ornek", "Örnek"]
                ] as const
              ).map(([id, label]) => (
                <button key={id} className={shelf === id ? "pill on" : "pill"} onClick={() => setShelf(id)}>
                  {label}
                </button>
              ))}
            </div>
            <p className="section-label">Açık metinler</p>
            <p className="note">
              Raf yalnız lisansı depoda yazılı metinleri taşır. Ticari kitap kapakları burada yok. Puan yok.
            </p>
            {(shelf === "hepsi" || shelf === "ornek") && (!needle || "gece okuması unchain örnek".includes(needle)) && (
              <button
                className="bookline"
                onClick={() => openReader(lib.books.find((item) => item.id === "sample-gece") ?? saved[0])}
              >
                <span className="cover" style={{ background: "linear-gradient(160deg,#3d4c63,#8e7d9b)" }} />
                <span>
                  <b>Gece okuması</b>
                  <span className="meta">Unchain · örnek · Apache 2.0 · 2 dk</span>
                </span>
              </button>
            )}
            {CATALOG.filter((work) => shelf === "hepsi" || shelf === work.shelf)
              .filter((work) => !needle || `${work.title} ${work.author} ${work.text}`.toLocaleLowerCase("tr").includes(needle))
              .map((work) => {
                const owned = lib.books.some((item) => item.id === work.id);
                return (
                  <button key={work.id} className="bookline" onClick={() => openCatalog(work)}>
                    <span className="cover" style={{ background: work.shelf === "siir" ? "linear-gradient(160deg,#1f3d34,#7dcea0)" : "linear-gradient(160deg,#c4a46a,#6e4b2a)" }} />
                    <span>
                      <b>{work.title}</b>
                      <span className="meta">
                        {work.author} · {work.shelf === "siir" ? "şiir" : "hikâye"} · kamu malı
                        {owned ? " · kitaplıkta" : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
          </>
        )}

        {view === "library" && (
          <>
            <div className="head">
              <h1 style={{ flex: 1 }}>Kitaplık</h1>
              <button className="iconbtn" aria-label="İçe aktar" onClick={() => setSheet("import")}>
                +
              </button>
            </div>
            <input
              className="field"
              placeholder="Kitaplıkta ara"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Kitaplıkta ara"
            />
            <div className="pills" style={{ marginTop: 12 }}>
              {(
                [
                  ["saved", "Kayıtlı"],
                  ["collections", "Koleksiyonlar"],
                  ["archive", "Arşiv"]
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={tab === id ? "pill on" : "pill"}
                  onClick={() => {
                    setTab(id);
                    setOpenCollection(null);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab === "saved" && (
              <div className="pills" style={{ marginTop: 8 }}>
                {(
                  [
                    ["hepsi", "Hepsi"],
                    ["kitap", "Kitap"],
                    ["ice", "İçe aktarılan"],
                    ["link", "Bağlantı"],
                    ["metin", "Metin"]
                  ] as const
                ).map(([id, label]) => (
                  <button key={id} className={kind === id ? "pill on" : "pill"} onClick={() => setKind(id)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {tab === "collections" && !openCollection ? (
              <>
                <form
                  className="head"
                  style={{ marginTop: 16 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = collectionName.trim();
                    if (!name) return;
                    setLib((prev) => addCollection(prev, name));
                    setCollectionName("");
                    setOpenCollection(name);
                  }}
                >
                  <input
                    className="field"
                    placeholder="Koleksiyon adı"
                    value={collectionName}
                    onChange={(e) => setCollectionName(e.target.value)}
                    aria-label="Koleksiyon adı"
                  />
                  <button className="btn solid" type="submit">
                    Ekle
                  </button>
                </form>
                {collections
                  .filter((name) => !needle || name.toLocaleLowerCase("tr").includes(needle))
                  .map((name) => (
                    <button key={name} className="listbtn" onClick={() => setOpenCollection(name)}>
                      {name}
                      <div className="meta">{saved.filter((item) => item.collection === name).length} kitap</div>
                    </button>
                  ))}
                {collections.length === 0 && <p className="note">Henüz koleksiyon yok. Ad, hiçbir kitaba kendiliğinden yazılmaz.</p>}
              </>
            ) : (
              <>
                {openCollection && (
                  <button className="ghost" style={{ marginTop: 12 }} onClick={() => setOpenCollection(null)}>
                    {openCollection}
                  </button>
                )}
                {listed.map((item) => (
                <div key={item.id}>
                  <button className="bookline" onClick={() => openReader(item)}>
                    <span className="cover" style={{ background: item.cover }} />
                    <span>
                      <span className="meta">{item.source}</span>
                      <br />
                      <b>{item.title}</b>
                      <br />
                      <span className="meta">
                        {item.author} · {item.minutes} dk {item.unread ? "" : "· okundu"}
                      </span>
                    </span>
                  </button>
                  {openBook === item.id && (
                    <div className="actions-inline">
                      {lib.collections.map((name) => (
                        <button
                          key={name}
                          onClick={() => setLib((prev) => assignCollection(prev, item.id, item.collection === name ? null : name))}
                        >
                          {item.collection === name ? `${name} çıkar` : name}
                        </button>
                      ))}
                      {!lib.collections.includes("Sonra oku") && (
                        <button onClick={() => setLib((prev) => assignCollection(prev, item.id, "Sonra oku"))}>Sonra oku</button>
                      )}
                      <button onClick={() => patchBook(item.id, { unread: !item.unread })}>
                        {item.unread ? "Okundu işaretle" : "Okunmadı işaretle"}
                      </button>
                      <button onClick={() => patchBook(item.id, { archived: !item.archived })}>
                        {item.archived ? "Geri al" : "Arşivle"}
                      </button>
                    </div>
                  )}
                  <button className="ghost" onClick={() => setOpenBook(openBook === item.id ? null : item.id)}>
                    İşlemler
                  </button>
                </div>
              ))}
                {listed.length === 0 && <p className="note">Bu rafta kitap yok.</p>}
              </>
            )}
          </>
        )}

        {view === "voice" && (
          <>
            <h1>Ses</h1>
            <div className="pills">
              <span className="pill on">Ema</span>
              <span className="pill">Söyleyiş</span>
            </div>
            <article className="card" style={{ marginTop: 18 }}>
              <b>Ema</b>
              <p className="note">
                Tek Türkçe anlatıcı. EMA Lightning, yaklaşık 34 MB. Duygu ve ikinci ses yok. Hız {lib.speed.toFixed(2)}x.
              </p>
              <input
                className="slider"
                type="range"
                min={0.5}
                max={1.5}
                step={0.05}
                value={lib.speed}
                onChange={(e) => setLib((prev) => ({ ...prev, speed: Number(e.target.value) }))}
              />
              <p className="note">
                Ema bu tarayıcıda üretilir.{" "}
                {sessionEmail ? "Giriş yaptığın kitaplığın kopyası Vercel’de durur." : "Giriş yokken metin cihazdan çıkmaz."} Üretim
                olmazsa okuyucu tarayıcı önizlemesi yazar.
              </p>
            </article>
            <p className="section-label">Söyleyiş sözlüğü</p>
            <form
              className="cardgrid"
              onSubmit={(e) => {
                e.preventDefault();
                if (!pronFrom.trim() || !pronTo.trim()) return;
                setLib((prev) => ({
                  ...prev,
                  pronunciations: [...prev.pronunciations, { from: pronFrom.trim(), to: pronTo.trim() }]
                }));
                setPronFrom("");
                setPronTo("");
              }}
            >
              <input className="field" placeholder="Yazılış" value={pronFrom} onChange={(e) => setPronFrom(e.target.value)} />
              <input className="field" placeholder="Okunuş" value={pronTo} onChange={(e) => setPronTo(e.target.value)} />
              <button className="btn solid" type="submit">
                Ekle
              </button>
            </form>
            {lib.pronunciations.map((pair) => (
              <p key={pair.from + pair.to} className="meta">
                {pair.from} → {pair.to}
              </p>
            ))}
          </>
        )}

        {view === "account" && (
          <>
            <h1>Profil</h1>
            {sessionEmail ? (
              <>
                <p className="note">{sessionEmail}</p>
                <button
                  className="listbtn"
                  onClick={() => {
                    void logout().then(() => {
                      setSessionEmail(null);
                      setGirisNote("Çıkış sunucudaki kopyayı silmez.");
                    });
                  }}
                >
                  Çıkış
                </button>
                <p className="note">Çıkış sunucudaki kopyayı silmez.</p>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void requestLink(emailDraft).then((result) => setGirisNote(result.mesaj));
                }}
              >
                <p className="note">Giriş yapınca kitaplık Vercel’de durur.</p>
                <input
                  className="field"
                  type="email"
                  placeholder="E-posta"
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  aria-label="E-posta"
                />
                <button className="btn solid" type="submit" style={{ marginTop: 12 }}>
                  Bağlantı gönder
                </button>
              </form>
            )}
            {girisNote && <p className="note">{girisNote}</p>}
            <p className="note">
              {sessionEmail
                ? "Bu ad giriş yaptığın kitaplıkla birlikte Vercel’de durur."
                : "Bu ad yalnız bu tarayıcıda durur. Telefon uygulamasında profil aygıtta kalır."}
            </p>
            <input
              className="field"
              value={lib.profileName}
              onChange={(e) => setLib((prev) => ({ ...prev, profileName: e.target.value }))}
            />
            <p className="section-label">Kullanım</p>
            <p className="note">
              {sessionEmail
                ? `Ema ile üretilen ses: ${formatSpoken(lib.spokenSeconds)}. Önbellekten gelen parça ve tarayıcı önizlemesi bu süreye yazılmaz.`
                : `Bu tarayıcıda Ema ile üretilen ses: ${formatSpoken(lib.spokenSeconds)}. Tarayıcı önizlemesi bu süreye yazılmaz.`}
            </p>
            <p className="section-label">Gizlilik</p>
            <p className="note">
              {sessionEmail
                ? "Giriş yaptığın kitaplık, ilerleme ve yüklediğin dosya Vercel’de durur. Ses tarayıcıda üretilir; üretilen parça özel depoda saklanır ki ikinci dinleyiş yeniden üretmesin. Çıkış sunucudaki kopyayı silmez. Android ile web eşitlemesi yoktur."
                : "Kitaplık, ilerleme, profil adı ve üretilen süre bu tarayıcının yerel deposunda durur. Dosya yükleme sunucuya gitmez. Bağlantı yapıştırınca sayfa metni sunucuda okunur ve tarayıcıya döner; Unchain bu metni saklamaz. Giriş yapınca kitaplık Vercel’de durur. Android ile web eşitlemesi yoktur."}
            </p>
            <p className="section-label">Lisanslar</p>
            <p className="note">Unchain — github.com/ayzekhdawy/unchain. Apache 2.0.</p>
            {CATALOG.map((work) => (
              <p key={work.id} className="note">
                {work.title}, {work.author}. Kamu malı, 5846 m. 27, süre sonu {work.termEnd}. {work.sourceUrl}
              </p>
            ))}
            <p className="note">EMA Lightning, Canberk Aslan, Apache 2.0. normalizer-tr, Erdem Tuna. ONNX Runtime Web, Microsoft, MIT.</p>
            <p className="note">Ortam döngüleri Yağmur, Ocak ve Oda, CC0. Anlatıcının altında kalır.</p>
            <p className="section-label">Tema</p>
            <div className="pills" role="group" aria-label="Tema">
              {THEMES.map((item) => (
                <button
                  key={item.id}
                  className={lib.theme === item.id ? "pill on" : "pill"}
                  onClick={() => setLib((prev) => ({ ...prev, theme: item.id }))}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="note">Varsayılan gece okumasıdır. Kâğıt açık zemindir.</p>
            <button className="listbtn" onClick={() => setView("voice")}>
              Ses
            </button>
            <button
              className="listbtn danger"
              onClick={() => {
                void (async () => {
                  if (sessionEmail) {
                    cloudGen.current += 1;
                    const ok = await deleteLibrary();
                    if (!ok) {
                      setGirisNote("Vercel kopyası silinemedi.");
                      return;
                    }
                  }
                  localStorage.removeItem("unchain.library.v1");
                  setLib(emptyLibrary());
                  setPlaying(false);
                })();
              }}
            >
              Veriyi sil
            </button>
          </>
        )}

        {view === "write" && (
          <>
            <div className="head">
              <button className="ghost" onClick={() => setView("home")}>
                Geri
              </button>
              <b>Metin yaz</b>
              <button
                className="btn solid"
                style={{ marginLeft: "auto" }}
                disabled={!draft.trim()}
                onClick={() => stageBook(bookFromText(draft.split("\n")[0].slice(0, 80), lib.profileName, draft, "text"))}
              >
                Dinle
              </button>
            </div>
            <textarea
              style={{ marginTop: 16 }}
              placeholder="Dinlenecek metni yapıştır"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </>
        )}

        {view === "link" && (
          <>
            <div className="head">
              <button className="ghost" onClick={() => setView("home")}>
                Geri
              </button>
              <b>Bağlantı yapıştır</b>
            </div>
            <input className="field" style={{ marginTop: 16 }} value={link} onChange={(e) => setLink(e.target.value)} />
            <button className="btn solid" style={{ marginTop: 12 }} onClick={submitLink}>
              İleri
            </button>
            {linkError && <p className="note">{linkError}</p>}
            <p className="note">
              {sessionEmail
                ? "Sayfa metni bu site üzerinden okunur. Kaydedince bu kopya Vercel’de durur. İç ağ adresleri kabul edilmez."
                : "Sayfa metni bu site üzerinden okunur. Metin saklanmaz. İç ağ adresleri kabul edilmez."}
            </p>
          </>
        )}

        {view === "reader" && book && cursor && (
          <div className="reader">
            <div className="head">
              <button className="ghost" onClick={() => setView("home")}>
                Kapat
              </button>
              <div style={{ flex: 1 }}>
                <b>{book.title}</b>
                <div className="meta">{book.author}</div>
              </div>
              <button className="iconbtn" aria-label="Menü" onClick={() => setSheet("more")}>
                …
              </button>
            </div>
            <p className="note" data-voice={voice} data-ema-wait={emaSeconds ?? ""} data-ema-error={voiceError}>
              {voice === "fallback"
                ? "Tarayıcı önizlemesi. Ema sesi değil. Bu ürünün sesi yapay zekâ ile üretilecektir."
                : voice === "generating"
                  ? sessionEmail
                    ? "Ema üretiyor. Ses bu tarayıcıda üretilir."
                    : "Ema üretiyor. Metin bu tarayıcıda kalır."
                  : voice === "loading"
                    ? sessionEmail
                      ? "Ema yükleniyor. Ses bu tarayıcıda üretilir."
                      : "Ema yükleniyor. Metin bu tarayıcıda kalır."
                    : `Ema. Bu ses yapay zekâ ile üretilmiştir.${emaSeconds !== null ? ` İlk cümle ${emaSeconds.toFixed(1)} saniyede üretildi.` : ""}`}
            </p>
            {importNote && <p className="note">{importNote}</p>}
            <p className="sr" aria-live="polite" aria-atomic="true">
              {playing ? `Okunan cümle. ${book.chapters[cursor.chapter]?.sentences[cursor.sentence]?.text ?? ""}` : ""}
            </p>
            <article>
              {book.chapters.map((chapter, ci) => (
                <section key={chapter.id}>
                  <h2 style={{ fontFamily: "var(--font-ui)", fontSize: 14, letterSpacing: "0.08em" }}>{chapter.title}</h2>
                  {chapter.sentences.map((sentence, si) => {
                    const live = cursor.chapter === ci && cursor.sentence === si;
                    const tokens = sentence.text.split(/\s+/);
                    return (
                      <p
                        key={sentence.id}
                        className={live ? "live" : undefined}
                        aria-current={live ? "true" : undefined}
                        onClick={() => seek({ bookId: book.id, chapter: ci, sentence: si, word: 0 })}
                      >
                        {tokens.map((token, wi) => (
                          <span key={`${sentence.id}-${wi}`} className={live && wi === word ? "word on" : undefined}>
                            {token}{" "}
                          </span>
                        ))}
                      </p>
                    );
                  })}
                </section>
              ))}
            </article>
            <div className="transport">
              <button className="ghost" onClick={() => setSheet("contents")}>
                {chapterTitle}
              </button>
              <div className="bar" aria-hidden="true">
                <span style={{ width: `${Math.round(progress * 100)}%` }} />
              </div>
              <div className="times">
                <span>{Math.round(progress * book.minutes)} dk</span>
                <span>{Math.max(0, book.minutes - Math.round(progress * book.minutes))} dk kaldı</span>
              </div>
              <div className="controls">
                <button className="ghost" onClick={() => setSheet("sleep")}>
                  Uyku
                </button>
                <button className="ghost" onClick={() => skip(-15)} aria-label="15 saniye geri">
                  15
                </button>
                <button className="play" onClick={togglePlay} aria-label={playing ? "Durdur" : "Oynat"}>
                  {playing ? "II" : "▶"}
                </button>
                <button className="ghost" onClick={() => skip(30)} aria-label="30 saniye ileri">
                  30
                </button>
                <button
                  className="ghost"
                  onClick={() =>
                    setLib((prev) => ({ ...prev, speed: prev.speed >= 1.5 ? 0.8 : Math.round((prev.speed + 0.2) * 10) / 10 }))
                  }
                >
                  {lib.speed.toFixed(1)}x
                </button>
              </div>
              <p className="note">Boşluk oynatır veya durdurur. Oklar 15 saniye, Shift ile 30 saniye.</p>
              <AmbientRow
                ambient={lib.ambient}
                level={lib.ambientLevel}
                onPick={(ambient) => setLib((prev) => ({ ...prev, ambient }))}
                onLevel={(ambientLevel) => setLib((prev) => ({ ...prev, ambientLevel }))}
              />
            </div>
          </div>
        )}
      </main>

      <aside className="now">
        <p className="section-label">Şimdi</p>
        {book ? (
          <>
            <span className="cover" style={{ background: book.cover, width: 120, height: 168 }} />
            <h2 style={{ fontSize: 22 }}>{book.title}</h2>
            <p className="meta">{book.author}</p>
            <p className="meta">{chapterTitle}</p>
            <button className="btn solid" onClick={() => (view === "reader" ? togglePlay() : openReader(book))}>
              {playing ? "Durdur" : "Dinle"}
            </button>
            <p className="note">
              {sessionEmail
                ? "Masaüstünde okuyucu bu kolonun yanında açılır. Giriş yaptığın kitaplık Vercel’de durur."
                : "Masaüstünde okuyucu bu kolonun yanında açılır. Kitaplık verisi bu tarayıcıda tutulur."}
            </p>
            <AmbientRow
              ambient={lib.ambient}
              level={lib.ambientLevel}
              onPick={(ambient) => setLib((prev) => ({ ...prev, ambient }))}
              onLevel={(ambientLevel) => setLib((prev) => ({ ...prev, ambientLevel }))}
            />
          </>
        ) : (
          <p className="note">Kitaplık boş.</p>
        )}
      </aside>

      {book && view !== "reader" && (
        <div className="dock">
          <span className="cover" style={{ width: 42, height: 42, background: book.cover }} />
          <button style={{ flex: 1, textAlign: "left", background: "transparent", border: 0 }} onClick={() => openReader(book)}>
            <b>{book.title}</b>
            <div className="meta">{chapterTitle}</div>
          </button>
          <button className="ghost" onClick={() => skip(-15)}>
            15
          </button>
          <button className="play" onClick={togglePlay} aria-label={playing ? "Durdur" : "Oynat"}>
            {playing ? "II" : "▶"}
          </button>
        </div>
      )}

      <nav className="tabs" aria-label="Alt gezinti">
        {NAV.slice(0, 2).map((item) => (
          <button key={item.id} className={view === item.id ? "on" : ""} onClick={() => setView(item.id)}>
            {item.label}
          </button>
        ))}
        <button onClick={() => setSheet("import")} aria-label="İçe aktar">
          <span className="plus">+</span>
        </button>
        {NAV.slice(2).map((item) => (
          <button key={item.id} className={view === item.id ? "on" : ""} onClick={() => setView(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      {pending && (
        <div className="sheet">
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <b>Bu kopya Vercel’de durur.</b>
            <p className="note">
              {pending.book.title} giriş yaptığın hesapta saklanır. Yüklemeden önce bu söylenir. Telefon uygulaması bu kopyayı kullanmaz.
            </p>
            <button className="btn solid" onClick={() => void confirmPending()}>
              Kaydet
            </button>
            <button className="ghost" style={{ marginLeft: 8 }} onClick={() => setPending(null)}>
              Vazgeç
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.epub,.docx,.odt,.rtf,.fb2,.txt,.md,application/pdf,application/epub+zip,text/plain"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
      <input
        ref={scanRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onScan(file);
          e.target.value = "";
        }}
      />

      {sheet === "import" && (
        <div className="sheet" onClick={() => setSheet(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <div className="head">
              <b>İçe aktar</b>
              <button className="ghost" style={{ marginLeft: "auto" }} onClick={() => setSheet(null)}>
                Kapat
              </button>
            </div>
            <p className="note">Nasıl getirmek istediğini seç.</p>
            <div className="import-grid">
              <button
                onClick={() => {
                  setSheet(null);
                  setView("link");
                }}
              >
                Bağlantı yapıştır
              </button>
              <button disabled={importing} onClick={() => fileRef.current?.click()}>
                {importing ? "Ayrıştırılıyor…" : "Dosya yükle"}
              </button>
              <button disabled={scanning} onClick={() => scanRef.current?.click()}>
                {scanning ? "Okunuyor…" : "Metin tara"}
              </button>
              <button
                onClick={() => {
                  setSheet(null);
                  setView("write");
                }}
              >
                Metin yaz
              </button>
            </div>
            <button
              className="wide"
              onClick={() => {
                setSheet(null);
                setView("link");
              }}
            >
              Web sayfası aç
              <div className="meta">Haber, blog, herkese açık sayfa</div>
            </button>
            <p className="note">
              {sessionEmail
                ? `${FORMAT_NOTE} Kaydetmeden önce kopyanın Vercel’de duracağı söylenir.`
                : `${FORMAT_NOTE} Dosya sunucuya gitmez.`}
            </p>
            <p className="note">
              {sessionEmail ? `${SCAN_NOTE} Okunan metin kaydedilince Vercel’de durur.` : `${SCAN_NOTE} Okunan metin bu tarayıcıda kalır.`}
            </p>
            {importError && <p className="note">{importError}</p>}
          </div>
        </div>
      )}

      {sheet === "contents" && book && (
        <div className="sheet" onClick={() => setSheet(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <div className="head">
              <b>İçindekiler</b>
              <button className="ghost" style={{ marginLeft: "auto" }} onClick={() => setSheet(null)}>
                Kapat
              </button>
            </div>
            {book.chapters.map((chapter, index) => (
              <button
                key={chapter.id}
                className="listbtn"
                onClick={() => {
                  seek({ bookId: book.id, chapter: index, sentence: 0, word: 0 });
                  setSheet(null);
                }}
              >
                {chapter.title}
                <div className="meta">{chapter.sentences.length} cümle</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {sheet === "sleep" && (
        <div className="sheet" onClick={() => setSheet(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <b>Uykuya kal</b>
            {SLEEP.map((item) => (
              <button key={item.id} className="listbtn" onClick={() => chooseSleep(item.id)}>
                {item.label}
                {sleep === item.id ? " · seçili" : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {sheet === "more" && book && (
        <div className="sheet" onClick={() => setSheet(null)}>
          <div className="reader-menu" onClick={(e) => e.stopPropagation()}>
            <div className="head">
              <b>{book.title}</b>
              <button className="ghost" style={{ marginLeft: "auto" }} onClick={() => setSheet(null)}>
                Kapat
              </button>
            </div>
            <button className="listbtn" onClick={() => setSheet("contents")}>
              İçindekiler
            </button>
            <button className="listbtn" onClick={() => setSheet("sleep")}>
              Uyku zamanlayıcısı
            </button>
            <button
              className="listbtn"
              onClick={() => {
                setSheet(null);
                setView("voice");
              }}
            >
              Ses
            </button>
            {lib.collections.map((name) => (
              <button
                key={name}
                className="listbtn"
                onClick={() => setLib((prev) => assignCollection(prev, book.id, book.collection === name ? null : name))}
              >
                {book.collection === name ? `${name} koleksiyonundan çıkar` : `${name} koleksiyonuna ekle`}
              </button>
            ))}
            {!lib.collections.includes("Sonra oku") && (
              <button className="listbtn" onClick={() => setLib((prev) => assignCollection(prev, book.id, "Sonra oku"))}>
                Sonra oku
              </button>
            )}
            <button
              className="listbtn danger"
              onClick={() => {
                setPlaying(false);
                setLib((prev) => {
                  const books = prev.books.filter((b) => b.id !== book.id);
                  const fallback = books[0];
                  return {
                    ...prev,
                    books,
                    currentId: fallback?.id ?? null,
                    cursor: fallback ? { bookId: fallback.id, chapter: 0, sentence: 0, word: 0 } : null
                  };
                });
                setView("library");
                setSheet(null);
              }}
            >
              Sil
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AmbientRow({
  ambient,
  level,
  onPick,
  onLevel
}: {
  ambient: AmbientName;
  level: number;
  onPick: (ambient: AmbientName) => void;
  onLevel: (level: number) => void;
}) {
  return (
    <div data-ambient={ambient}>
      <div className="pills" role="group" aria-label="Ortam">
        {AMBIENTS.map((item) => (
          <button key={item.id} className={ambient === item.id ? "pill on" : "pill"} onClick={() => onPick(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <input
        className="slider"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={level}
        aria-label="Ortam düzeyi"
        disabled={ambient === "yok"}
        onChange={(e) => onLevel(Number(e.target.value))}
      />
      <p className="note">Ortam anlatıcının altında kalır. Döngüler CC0.</p>
    </div>
  );
}
