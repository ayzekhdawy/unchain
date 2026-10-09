export type TextBlock = { kind: "heading" | "paragraph"; text: string };

export type PdfLine = { text: string; size: number; y: number };
export type PdfPage = { number: number; height: number; lines: PdfLine[] };

const NAMED: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  laquo: "«",
  raquo: "»"
};

export function isPageChrome(text: string): boolean {
  const value = text.replace(/\s+/g, " ").trim();
  if (!value || value.length > 40) return false;
  if (/^\d{1,4}$/.test(value)) return true;
  if (/^(sayfa|page)\s*\d{1,4}$/i.test(value)) return true;
  if (/^[-–—]\s*\d{1,4}\s*[-–—]$/.test(value)) return true;
  if (/^\d{1,4}\s*[/|]\s*\d{1,4}$/.test(value)) return true;
  return false;
}

export function decodeEntities(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&([a-z]+);/gi, (all, name: string) => NAMED[name.toLowerCase()] ?? all)
    .replace(/&#(\d+);/g, (_, n) => fromCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => fromCode(parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function fromCode(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return "";
  return String.fromCodePoint(n);
}

export function htmlToBlocks(html: string): TextBlock[] {
  const cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<(header|footer|nav)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<([a-z0-9]+)[^>]*(?:class|epub:type)=["'][^"']*(?:pagenum|page-number|pagenumber|pagebreak)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi, "");
  const blocks: TextBlock[] = [];
  const re = /<(h[1-3]|p|li|div)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned))) {
    const tag = match[1].toLowerCase();
    const inner = match[2];
    if (tag === "div" && /<(?:p|h[1-3]|div)\b/i.test(inner)) continue;
    const text = decodeEntities(inner);
    if (!text || isPageChrome(text)) continue;
    blocks.push({ kind: tag.startsWith("h") ? "heading" : "paragraph", text });
  }
  if (!blocks.length) {
    const text = decodeEntities(cleaned);
    if (text && !isPageChrome(text)) blocks.push({ kind: "paragraph", text });
  }
  return blocks;
}

function normalizeChrome(text: string): string {
  return text.toLocaleLowerCase("tr").replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}

function repeatedChrome(pages: PdfPage[]): Set<string> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    for (const line of page.lines) {
      const zone = line.y > page.height * 0.9 || line.y < page.height * 0.08;
      if (!zone) continue;
      const key = normalizeChrome(line.text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const need = Math.max(2, Math.ceil(pages.length * 0.5));
  const keys = new Set<string>();
  for (const [key, count] of counts) {
    if (count >= need) keys.add(key);
  }
  return keys;
}

function isHeading(line: PdfLine, cut: number): boolean {
  return line.size >= cut && line.text.length < 90 && !/[.!?…]$/.test(line.text);
}

function paragraphs(lines: PdfLine[]): TextBlock[] {
  const blocks: TextBlock[] = [];
  let group: PdfLine[] = [];
  const flush = () => {
    if (!group.length) return;
    blocks.push({ kind: "paragraph", text: group.map((line) => line.text).join(" ") });
    group = [];
  };
  for (const line of lines) {
    const prev = group[group.length - 1];
    if (prev && prev.y - line.y > Math.max(prev.size, line.size) * 1.9) flush();
    group.push(line);
  }
  flush();
  return blocks;
}

export function pagesToBlocks(pages: PdfPage[]): { blocks: TextBlock[]; emptyPages: number } {
  const chrome = repeatedChrome(pages);
  const cleaned = pages.map((page) => ({
    number: page.number,
    height: page.height,
    lines: page.lines.filter((line) => {
      if (!line.text.trim() || isPageChrome(line.text)) return false;
      const zone = line.y > page.height * 0.9 || line.y < page.height * 0.08;
      return !(zone && chrome.has(normalizeChrome(line.text)));
    })
  }));
  const emptyPages = cleaned.filter((page) => page.lines.length === 0).length;
  const body = cleaned.filter((page) => page.lines.length > 0);
  const sizes = body
    .flatMap((page) => page.lines.map((line) => line.size))
    .filter((size) => size > 0)
    .sort((a, b) => a - b);
  const median = sizes[Math.floor((sizes.length - 1) / 2)] ?? 12;
  const cut = median * 1.34;
  const headed = body.some((page) => page.lines.some((line) => isHeading(line, cut)));
  const blocks: TextBlock[] = [];
  if (!headed) {
    for (const page of body) {
      blocks.push({ kind: "heading", text: `Sayfa ${page.number}` });
      blocks.push(...paragraphs(page.lines));
    }
    return { blocks, emptyPages };
  }
  for (const page of body) {
    let group: PdfLine[] = [];
    const flush = () => {
      if (!group.length) return;
      blocks.push({ kind: "paragraph", text: group.map((line) => line.text).join(" ") });
      group = [];
    };
    for (const line of page.lines) {
      if (isHeading(line, cut)) {
        flush();
        blocks.push({ kind: "heading", text: line.text });
        continue;
      }
      const prev = group[group.length - 1];
      if (prev && prev.y - line.y > Math.max(prev.size, line.size) * 1.9) flush();
      group.push(line);
    }
    flush();
  }
  return { blocks, emptyPages };
}
