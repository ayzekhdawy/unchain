import { strFromU8, unzipSync } from "fflate";
import { bookFromBlocks, bookFromText, type Book, type BookSource } from "./books";
import { decodeEntities, htmlToBlocks, isPageChrome, pagesToBlocks, type PdfLine, type PdfPage, type TextBlock } from "./structure";

const MAX_BYTES = 40 * 1024 * 1024;
const MAX_CHARS = 1_200_000;

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

export type ImportResult = { book: Book; warning: string | null };

type ZipFiles = Record<string, Uint8Array>;
type ManifestItem = { id: string; href: string; media: string; properties: string };

export async function importFile(file: File, author: string): Promise<ImportResult> {
  if (file.size > MAX_BYTES) throw new ImportError("Dosya 40 MB sınırını aşıyor.");
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    const text = await file.text();
    assertLength(text);
    const source: BookSource = name.endsWith(".md") ? "md" : "txt";
    return { book: bookFromText(titleFromName(file.name), author, text, source), warning: null };
  }
  if (name.endsWith(".pdf")) return importPdf(await file.arrayBuffer(), file.name, author);
  if (name.endsWith(".epub")) return importEpub(new Uint8Array(await file.arrayBuffer()), file.name, author);
  if (name.endsWith(".docx")) return importDocx(await file.arrayBuffer(), file.name, author);
  throw new ImportError("Bu dosya türü henüz açılmıyor. PDF, EPUB, DOCX, TXT veya MD seç.");
}

export async function loadPdfPages(data: ArrayBuffer): Promise<{ pages: PdfPage[]; title: string; author: string }> {
  const pdfjs = await loadPdfjs();
  let doc;
  try {
    const loading = pdfjs.getDocument({
      data: new Uint8Array(data),
      verbosity: 0,
      disableFontFace: true,
      useSystemFonts: false
    });
    doc = await loading.promise;
  } catch (err) {
    if (typeof window === "undefined") console.error(err);
    const name = errorName(err);
    if (name === "PasswordException") throw new ImportError("Bu PDF parolalı. Parolasız bir kopya seç.");
    if (name === "InvalidPDFException") throw new ImportError("Bu dosya geçerli bir PDF değil.");
    throw new ImportError("PDF açılamadı.");
  }
  let title = "";
  let author = "";
  try {
    const meta = await doc.getMetadata();
    const info = meta.info as { Title?: unknown; Author?: unknown };
    title = cleanMeta(info?.Title);
    author = cleanMeta(info?.Author);
  } catch {
    title = "";
  }
  const pages: PdfPage[] = [];
  for (let number = 1; number <= doc.numPages; number += 1) {
    const page = await doc.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    pages.push({
      number,
      height: viewport.height,
      lines: linesFromItems(content.items)
    });
  }
  return { pages, title, author };
}

async function importPdf(data: ArrayBuffer, filename: string, fallbackAuthor: string): Promise<ImportResult> {
  const loaded = await loadPdfPages(data);
  const { blocks, emptyPages } = pagesToBlocks(loaded.pages);
  const spoken = blocks.map((block) => block.text).join(" ").trim();
  if (spoken.length < 20) {
    throw new ImportError("Bu PDF’te seçilebilir metin yok. Taranmış sayfa bu dilimde okunmaz.");
  }
  assertLength(spoken);
  const warning =
    emptyPages > 0
      ? emptyPages === 1
        ? "1 sayfada metin katmanı yoktu, atlandı."
        : `${emptyPages} sayfada metin katmanı yoktu, atlandı.`
      : null;
  return {
    book: bookFromBlocks(loaded.title || titleFromName(filename), loaded.author || fallbackAuthor, blocks, "pdf"),
    warning
  };
}

async function importEpub(bytes: Uint8Array, filename: string, fallbackAuthor: string): Promise<ImportResult> {
  const files = openZip(bytes, "Bu dosya geçerli bir EPUB değil.");
  const container = readZip(files, "META-INF/container.xml");
  if (!container) throw new ImportError("Bu dosya geçerli bir EPUB değil.");
  const opfHref = attr(strFromU8(container), "full-path");
  if (!opfHref) throw new ImportError("EPUB içinde kitap tanımı yok.");
  const opfPath = safeDecode(opfHref);
  const opfBytes = readZip(files, opfPath);
  if (!opfBytes) throw new ImportError("EPUB içinde kitap tanımı yok.");
  const opf = strFromU8(opfBytes);
  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const manifest = parseManifest(opf);
  const spine = parseSpine(opf);
  const navItem = Object.values(manifest).find((item) => item.properties.split(/\s+/).includes("nav"));
  const labels = navItem ? navLabels(files, opfDir, navItem.href) : new Map<string, string>();
  const blocks: TextBlock[] = [];
  let chapter = 0;
  for (const idref of spine) {
    const item = manifest[idref];
    if (!item || item.properties.split(/\s+/).includes("nav")) continue;
    if (!/xhtml|html/.test(item.media) && !/\.x?html?$/i.test(item.href)) continue;
    const href = joinZip(opfDir, item.href);
    const raw = readZip(files, href);
    if (!raw) continue;
    const chapterBlocks = htmlToBlocks(strFromU8(raw));
    const prose = chapterBlocks
      .filter((block) => block.kind === "paragraph")
      .map((block) => block.text)
      .join("")
      .trim();
    if (!prose) continue;
    chapter += 1;
    const own = chapterBlocks.find((block) => block.kind === "heading")?.text;
    const title = own || labels.get(item.href) || labels.get(href) || `Bölüm ${chapter}`;
    const firstHeading = chapterBlocks.findIndex((block) => block.kind === "heading" && block.text === own);
    blocks.push({ kind: "heading", text: title });
    chapterBlocks.forEach((block, index) => {
      if (index === firstHeading) return;
      blocks.push(block);
    });
  }
  const spoken = blocks.map((block) => block.text).join(" ").trim();
  if (spoken.length < 20) throw new ImportError("Bu EPUB içinde okunacak metin yok.");
  assertLength(spoken);
  const title = textTag(opf, "dc:title") || textTag(opf, "title") || titleFromName(filename);
  const creator = textTag(opf, "dc:creator") || textTag(opf, "creator") || fallbackAuthor;
  const cover = await epubCover(files, manifest, opf, opfDir);
  return { book: bookFromBlocks(title, creator, blocks, "epub", cover), warning: null };
}

async function importDocx(data: ArrayBuffer, filename: string, fallbackAuthor: string): Promise<ImportResult> {
  const mammoth = await import("mammoth");
  const convert = mammoth.convertToHtml ?? mammoth.default?.convertToHtml;
  if (!convert) throw new ImportError("DOCX ayrıştırıcısı yüklenemedi.");
  let html = "";
  try {
    const input = { buffer: new Uint8Array(data), arrayBuffer: data } as { arrayBuffer: ArrayBuffer };
    const result = await convert(input, { ignoreEmptyParagraphs: true });
    html = result.value;
  } catch {
    throw new ImportError("Bu dosya geçerli bir DOCX değil.");
  }
  const blocks = htmlToBlocks(html).filter((block) => !isPageChrome(block.text));
  const spoken = blocks.map((block) => block.text).join(" ").trim();
  if (spoken.length < 10) throw new ImportError("Bu DOCX içinde okunacak metin yok.");
  assertLength(spoken);
  let title = titleFromName(filename);
  let author = fallbackAuthor;
  try {
    const files = unzipSync(new Uint8Array(data));
    const core = readZip(files, "docProps/core.xml");
    if (core) {
      const xml = strFromU8(core);
      title = textTag(xml, "dc:title") || title;
      author = textTag(xml, "dc:creator") || author;
    }
  } catch {
    /* metadata isteğe bağlı */
  }
  return { book: bookFromBlocks(title, author, blocks, "docx"), warning: null };
}

async function loadPdfjs() {
  if (typeof window === "undefined") return import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs;
}

function linesFromItems(items: unknown[]): PdfLine[] {
  const rows: { y: number; size: number; parts: { x: number; text: string }[] }[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
    const item = raw as { str?: unknown; transform?: unknown; height?: unknown };
    if (typeof item.str !== "string") continue;
    const text = item.str.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const transform = Array.isArray(item.transform) ? item.transform : [];
    const x = typeof transform[4] === "number" ? transform[4] : 0;
    const y = typeof transform[5] === "number" ? transform[5] : 0;
    const size = typeof item.height === "number" && item.height > 0 ? item.height : 12;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= Math.max(size, candidate.size) * 0.45);
    if (!row) {
      row = { y, size, parts: [] };
      rows.push(row);
    }
    row.size = Math.max(row.size, size);
    row.parts.push({ x, text });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => ({
      text: row.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
      size: row.size,
      y: row.y
    }))
    .filter((line) => line.text);
}

function openZip(bytes: Uint8Array, message: string): ZipFiles {
  try {
    return unzipSync(bytes);
  } catch {
    throw new ImportError(message);
  }
}

function readZip(files: ZipFiles, wanted: string): Uint8Array | undefined {
  if (files[wanted]) return files[wanted];
  const needle = wanted.replace(/\\/g, "/").toLowerCase();
  const key = Object.keys(files).find((name) => name.replace(/\\/g, "/").toLowerCase() === needle);
  return key ? files[key] : undefined;
}

function parseManifest(opf: string): Record<string, ManifestItem> {
  const out: Record<string, ManifestItem> = {};
  for (const attrs of tagAttrs(opf, "item")) {
    const id = attr(attrs, "id");
    const href = attr(attrs, "href");
    if (!id || !href) continue;
    out[id] = {
      id,
      href: safeDecode(href),
      media: attr(attrs, "media-type"),
      properties: attr(attrs, "properties")
    };
  }
  return out;
}

function parseSpine(opf: string): string[] {
  const ids: string[] = [];
  for (const attrs of tagAttrs(opf, "itemref")) {
    if (attr(attrs, "linear").toLowerCase() === "no") continue;
    const id = attr(attrs, "idref");
    if (id) ids.push(id);
  }
  return ids;
}

function navLabels(files: ZipFiles, opfDir: string, navHref: string): Map<string, string> {
  const labels = new Map<string, string>();
  const full = joinZip(opfDir, navHref);
  const raw = readZip(files, full);
  if (!raw) return labels;
  const html = strFromU8(raw);
  const navDir = navHref.includes("/") ? navHref.slice(0, navHref.lastIndexOf("/") + 1) : "";
  const re = /<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const href = safeDecode(match[2].split("#")[0]);
    const text = decodeEntities(match[3]);
    if (!href || !text) continue;
    const fromOpf = joinZip(opfDir, joinZip(navDir, href));
    labels.set(href, text);
    labels.set(joinZip(navDir, href), text);
    labels.set(fromOpf, text);
  }
  return labels;
}

async function epubCover(
  files: ZipFiles,
  manifest: Record<string, ManifestItem>,
  opf: string,
  opfDir: string
): Promise<string | undefined> {
  const byProp = Object.values(manifest).find((item) => item.properties.split(/\s+/).includes("cover-image"));
  const coverId = attr(opf.match(/<meta\b[^>]*name=(["'])cover\1[^>]*>/i)?.[0] ?? "", "content");
  const item = byProp || (coverId ? manifest[coverId] : undefined);
  if (!item) return undefined;
  const raw = readZip(files, joinZip(opfDir, item.href));
  if (!raw) return undefined;
  return coverCss(raw, item.media || "image/png");
}

async function coverCss(bytes: Uint8Array, mime: string): Promise<string | undefined> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return undefined;
  try {
    const blob = new Blob([new Uint8Array(bytes)], { type: mime });
    const bitmap = await createImageBitmap(blob);
    const edge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, 160 / edge);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const url = canvas.toDataURL("image/jpeg", 0.72);
    if (url.length > 80_000) return undefined;
    return `center / cover no-repeat url("${url}")`;
  } catch {
    return undefined;
  }
}

function tagAttrs(xml: string, tag: string): string[] {
  const found: string[] = [];
  const re = new RegExp(`<${tag}\\b([^>]*)\\/?>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml))) found.push(match[1]);
  return found;
}

function attr(source: string, name: string): string {
  const match = source.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? safeDecode(match[2]).trim() : "";
}

function textTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return "";
  return decodeEntities(match[1]);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function titleFromName(name: string): string {
  const base = name.replace(/^.*[/\\]/, "").replace(/\.[^.]+$/, "");
  return base.trim() || "Adsız metin";
}

function cleanMeta(value: unknown): string {
  if (typeof value !== "string") return "";
  const text = value.replace(/\s+/g, " ").trim();
  return text && text.toLowerCase() !== "undefined" ? text : "";
}

function assertLength(text: string) {
  if (text.length > MAX_CHARS) throw new ImportError("Metin bu tarayıcının kitaplığına sığmayacak kadar uzun.");
}

function errorName(err: unknown): string {
  if (err && typeof err === "object" && "name" in err) return String((err as { name: unknown }).name);
  return "";
}

function joinZip(base: string, href: string): string {
  const clean = safeDecode(href.split("#")[0].split("?")[0]).trim();
  if (!clean) return "";
  const start = clean.startsWith("/") ? clean.slice(1) : `${base}${clean}`;
  const stack: string[] = [];
  for (const part of start.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}
