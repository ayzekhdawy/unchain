"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  applySpeech,
  bookFromText,
  emptyLibrary,
  moveBySeconds,
  moveSentences,
  progressOf,
  sentenceAt,
  type Book,
  type Cursor,
  type Library
} from "@/lib/books";

type View = "home" | "explore" | "library" | "voice" | "account" | "reader" | "write" | "link";
type LibTab = "saved" | "collections" | "archive";
type Sheet = null | "import" | "contents" | "sleep" | "more";

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
  const [sleep, setSleep] = useState("off");
  const [draft, setDraft] = useState("");
  const [link, setLink] = useState("https://");
  const [linkError, setLinkError] = useState("");
  const [openBook, setOpenBook] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [pronFrom, setPronFrom] = useState("");
  const [pronTo, setPronTo] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const sleepUntil = useRef<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("unchain.library.v1");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Library;
        if (parsed.books?.length) setLib(parsed);
      } catch {
        /* tohum kitaplık kalır */
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem("unchain.library.v1", JSON.stringify(lib));
  }, [lib, ready]);

  const book = lib.books.find((b) => b.id === (lib.cursor?.bookId ?? lib.currentId)) ?? null;
  const cursor = lib.cursor;

  useEffect(() => {
    if (!playing || !book || !cursor) return;
    const spokenBook = sentenceAt(book, cursor);
    const spoken = applySpeech(spokenBook.sentence.text, lib.pronunciations);
    const tokens = spokenBook.sentence.text.split(/\s+/);
    const ms = Math.max(700, ((spoken.length / 900) * 60_000) / lib.speed);
    const utter = new SpeechSynthesisUtterance(spoken);
    utter.lang = "tr-TR";
    utter.rate = Math.min(2, Math.max(0.5, lib.speed));
    const voices = window.speechSynthesis.getVoices();
    const turkish = voices.find((v) => v.lang.toLowerCase().startsWith("tr"));
    if (turkish) utter.voice = turkish;
    let step = 0;
    const timer = window.setInterval(() => {
      step += 1;
      if (step < tokens.length) setWord(step);
    }, ms / Math.max(1, tokens.length));
    utter.onend = () => {
      window.clearInterval(timer);
      if (sleepUntil.current && Date.now() >= sleepUntil.current) {
        setPlaying(false);
        return;
      }
      const next = moveSentences(book, cursor, 1);
      const stuck = next.chapter === cursor.chapter && next.sentence === cursor.sentence;
      if (stuck || (sleep === "chapter" && next.chapter !== cursor.chapter)) {
        setPlaying(false);
        if (!stuck) setLib((prev) => ({ ...prev, cursor: next }));
        return;
      }
      setWord(0);
      setLib((prev) => ({ ...prev, cursor: next, currentId: book.id }));
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
    return () => {
      window.clearInterval(timer);
      window.speechSynthesis.cancel();
    };
  }, [playing, book, cursor, lib.speed, lib.pronunciations, sleep]);

  const saved = lib.books.filter((b) => !b.archived);
  const archived = lib.books.filter((b) => b.archived);
  const collections = useMemo(() => {
    const names = new Set(lib.books.map((b) => b.collection).filter((n): n is string => Boolean(n)));
    return [...names];
  }, [lib.books]);

  function patchBook(id: string, patch: Partial<Book>) {
    setLib((prev) => ({ ...prev, books: prev.books.map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  }

  function openReader(target: Book) {
    setLib((prev) => ({
      ...prev,
      currentId: target.id,
      cursor:
        prev.cursor?.bookId === target.id
          ? prev.cursor
          : { bookId: target.id, chapter: 0, sentence: 0, word: 0 }
    }));
    setWord(0);
    setView("reader");
    setSheet(null);
  }

  function seek(next: Cursor) {
    setWord(0);
    setLib((prev) => ({ ...prev, cursor: next, currentId: next.bookId }));
  }

  function skip(seconds: number) {
    if (!book || !cursor) return;
    seek(moveBySeconds(book, cursor, seconds, lib.speed));
  }

  function addBook(next: Book) {
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

  async function onFile(file: File) {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".txt") && !name.endsWith(".md")) {
      setLinkError("PDF, EPUB ve DOCX ayrıştırıcısı sıradaki dilimde. Şimdilik TXT veya MD.");
      setSheet("import");
      return;
    }
    const text = await file.text();
    addBook(bookFromText(file.name.replace(/\.(txt|md)$/i, ""), "Sen", text, name.endsWith(".md") ? "md" : "txt"));
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
    addBook(bookFromText(data.title ?? "Bağlantı", new URL(link).hostname, data.text, "link"));
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
            <p className="section-label">Dinlemeye devam</p>
            {book && (
              <button className="bookline" onClick={() => openReader(book)}>
                <span className="cover" style={{ background: book.cover }} />
                <span>
                  <b>{book.title}</b>
                  <span className="meta">
                    {book.author}
                    <br />
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
              <button className="chip" onClick={() => fileRef.current?.click()}>
                Dosya yükle
              </button>
            </div>
            <p className="section-label">Rafta</p>
            <div className="cardgrid">
              {saved.slice(0, 4).map((item) => (
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
            <div className="pills">
              {["Hepsi", "Deneme", "Örnek"].map((name, i) => (
                <button key={name} className={i === 0 ? "pill on" : "pill"}>
                  {name}
                </button>
              ))}
            </div>
            <p className="section-label">Açık metinler</p>
            <p className="note">
              Raf yalnız lisansı depoda yazılı metinleri taşır. Ticari kitap kapakları burada yok.
            </p>
            <button className="bookline" onClick={() => openReader(lib.books.find((b) => b.id === "sample-gece") ?? saved[0])}>
              <span className="cover" style={{ background: "linear-gradient(160deg,#3d4c63,#8e7d9b)" }} />
              <span>
                <b>Gece okuması</b>
                <span className="meta">Unchain · örnek · 2 dk</span>
              </span>
            </button>
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
            <div className="pills">
              {(
                [
                  ["saved", "Kayıtlı"],
                  ["collections", "Koleksiyonlar"],
                  ["archive", "Arşiv"]
                ] as const
              ).map(([id, label]) => (
                <button key={id} className={tab === id ? "pill on" : "pill"} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </div>
            {tab === "collections" ? (
              <>
                <form
                  className="head"
                  style={{ marginTop: 16 }}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!collectionName.trim() || !saved[0]) return;
                    patchBook(saved[0].id, { collection: collectionName.trim() });
                    setCollectionName("");
                  }}
                >
                  <input
                    className="field"
                    placeholder="Koleksiyon adı"
                    value={collectionName}
                    onChange={(e) => setCollectionName(e.target.value)}
                  />
                </form>
                {collections.map((name) => (
                  <button key={name} className="listbtn" onClick={() => setTab("saved")}>
                    {name}
                  </button>
                ))}
                {collections.length === 0 && <p className="note">Henüz koleksiyon yok.</p>}
              </>
            ) : (
              (tab === "archive" ? archived : saved).map((item) => (
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
                      <button onClick={() => patchBook(item.id, { collection: item.collection ? null : "Sonra oku" })}>
                        {item.collection ? "Koleksiyondan çıkar" : "Sonra oku"}
                      </button>
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
              ))
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
              <p className="note">Önizleme tarayıcı sesidir. Ema, ölçüm geçince bağlanır.</p>
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
            <p className="note">Bu ad yalnız bu tarayıcıda durur. Telefon uygulamasında profil aygıtta kalır.</p>
            <input
              className="field"
              value={lib.profileName}
              onChange={(e) => setLib((prev) => ({ ...prev, profileName: e.target.value }))}
            />
            <button className="listbtn" onClick={() => setView("voice")}>
              Lisanslar ve ses
            </button>
            <p className="note">Unchain — github.com/ayzekhdawy/unchain. EMA Lightning, Canberk Aslan, Apache 2.0. normalizer-tr, Erdem Tuna.</p>
            <button
              className="listbtn danger"
              onClick={() => {
                localStorage.removeItem("unchain.library.v1");
                setLib(emptyLibrary());
                setPlaying(false);
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
                onClick={() => addBook(bookFromText(draft.split("\n")[0].slice(0, 80), lib.profileName, draft, "text"))}
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
            <p className="note">Sayfa metni bu site üzerinden okunur. İç ağ adresleri kabul edilmez.</p>
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
            <p className="note">Tarayıcı önizlemesi. Ema sesi değil. Bu ürünün sesi yapay zekâ ile üretilecektir.</p>
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
                <button className="play" onClick={() => setPlaying((v) => !v)} aria-label={playing ? "Durdur" : "Oynat"}>
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
            <button className="btn solid" onClick={() => (view === "reader" ? setPlaying((v) => !v) : openReader(book))}>
              {playing ? "Durdur" : "Dinle"}
            </button>
            <p className="note">Masaüstünde okuyucu bu kolonun yanında açılır. Kitaplık verisi bu tarayıcıda tutulur.</p>
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
          <button className="play" onClick={() => setPlaying((v) => !v)} aria-label={playing ? "Durdur" : "Oynat"}>
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

      <input
        ref={fileRef}
        type="file"
        accept=".txt,.md,text/plain"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
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
              <button onClick={() => fileRef.current?.click()}>Dosya yükle</button>
              <button disabled title="Sıradaki dilim">
                Metin tara
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
            {linkError && <p className="note">{linkError}</p>}
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
            <button className="listbtn" onClick={() => patchBook(book.id, { collection: "Sonra oku" })}>
              Koleksiyona ekle
            </button>
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
