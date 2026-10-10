import { strFromU8, unzipSync } from "fflate";
import { decodeEntities, isPageChrome, type TextBlock } from "./structure";

export type MarkupDoc = { title: string; author: string; blocks: TextBlock[] };

const SKIP_RTF = new Set([
  "fonttbl",
  "colortbl",
  "stylesheet",
  "info",
  "pict",
  "object",
  "header",
  "footer",
  "headerl",
  "headerr",
  "footerl",
  "footerr",
  "footnote"
]);

export function rtfToText(input: string): string {
  const src = input.replace(/^\uFEFF/, "");
  let index = 0;
  let out = "";
  const dest: number[] = [];
  const uc: number[] = [1];

  const keep = () => dest.length === 0 || dest[dest.length - 1] === 0;
  const push = (value: string) => {
    if (keep()) out += value;
  };

  while (index < src.length) {
    const ch = src[index];
    if (ch === "{") {
      dest.push(dest.length ? dest[dest.length - 1] : 0);
      uc.push(uc[uc.length - 1] ?? 1);
      index += 1;
      if (src[index] === "\\" && src[index + 1] === "*") dest[dest.length - 1] = 1;
      continue;
    }
    if (ch === "}") {
      dest.pop();
      uc.pop();
      if (!uc.length) uc.push(1);
      index += 1;
      continue;
    }
    if (ch === "\\") {
      index += 1;
      const mark = src[index] ?? "";
      if (mark === "\\" || mark === "{" || mark === "}") {
        push(mark);
        index += 1;
        continue;
      }
      if (mark === "'") {
        const hex = src.slice(index + 1, index + 3);
        index += 1 + hex.length;
        const code = Number.parseInt(hex, 16);
        if (hex.length === 2 && Number.isFinite(code)) push(String.fromCharCode(code));
        continue;
      }
      if (mark === "u" && /[-0-9]/.test(src[index + 1] ?? "")) {
        index += 1;
        let sign = 1;
        if (src[index] === "-") {
          sign = -1;
          index += 1;
        }
        let digits = "";
        while (index < src.length && /[0-9]/.test(src[index])) {
          digits += src[index];
          index += 1;
        }
        let code = sign * Number(digits);
        if (code < 0) code += 65536;
        if (Number.isFinite(code)) push(String.fromCharCode(code));
        if (src[index] === " ") index += 1;
        let left = uc[uc.length - 1] ?? 1;
        while (left > 0 && index < src.length && src[index] !== "{" && src[index] !== "}" && src[index] !== "\\") {
          index += 1;
          left -= 1;
        }
        continue;
      }
      if (/[a-zA-Z]/.test(mark)) {
        let word = "";
        while (index < src.length && /[a-zA-Z]/.test(src[index])) {
          word += src[index];
          index += 1;
        }
        let arg = "";
        if (src[index] === "-") {
          arg = "-";
          index += 1;
        }
        while (index < src.length && /[0-9]/.test(src[index])) {
          arg += src[index];
          index += 1;
        }
        if (src[index] === " ") index += 1;
        const name = word.toLowerCase();
        if (SKIP_RTF.has(name)) {
          if (dest.length) dest[dest.length - 1] = 1;
        } else if (name === "par" || name === "line") push("\n");
        else if (name === "tab") push(" ");
        else if (name === "uc" && arg) {
          const value = Number(arg);
          if (Number.isFinite(value) && value >= 0) uc[uc.length - 1] = value;
        }
        continue;
      }
      index += 1;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      index += 1;
      continue;
    }
    push(ch);
    index += 1;
  }
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function rtfBlocks(input: string): TextBlock[] {
  return textBlocks(rtfToText(input));
}

export function odtDocument(bytes: Uint8Array): MarkupDoc {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { title: "", author: "", blocks: [] };
  }
  const content = zipText(files, "content.xml");
  const meta = zipText(files, "meta.xml");
  return {
    title: tagText(meta, "dc:title"),
    author: tagText(meta, "dc:creator"),
    blocks: odtBlocks(content)
  };
}

export function fb2Document(xml: string): MarkupDoc {
  const info = sliceTag(xml, "title-info");
  const first = tagText(info, "first-name");
  const last = tagText(info, "last-name");
  const body = xml
    .replace(/<description\b[^>]*>[\s\S]*?<\/description>/gi, "")
    .replace(/<binary\b[^>]*>[\s\S]*?<\/binary>/gi, "");
  const html = body.replace(/<title\b[^>]*>([\s\S]*?)<\/title>/gi, (_, inner: string) => {
    const text = decodeEntities(inner);
    return text ? `<h1>${escapeText(text)}</h1>` : "";
  });
  const blocks: TextBlock[] = [];
  const re = /<(h1|p)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const text = decodeEntities(match[2]);
    if (!text || isPageChrome(text)) continue;
    blocks.push({ kind: match[1].toLowerCase() === "h1" ? "heading" : "paragraph", text });
  }
  return {
    title: tagText(info, "book-title"),
    author: [first, last].filter(Boolean).join(" "),
    blocks
  };
}

function odtBlocks(xml: string): TextBlock[] {
  const body = sliceTag(xml, "office:text") || xml;
  const flat = body
    .replace(/<text:s\b[^>]*\/>/gi, " ")
    .replace(/<text:tab\b[^>]*\/>/gi, " ")
    .replace(/<text:line-break\b[^>]*\/>/gi, " ");
  const blocks: TextBlock[] = [];
  const re = /<text:(h|p)\b[^>]*>([\s\S]*?)<\/text:\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(flat))) {
    if (/<text:(?:h|p)\b/i.test(match[2])) continue;
    const text = decodeEntities(match[2]);
    if (!text || isPageChrome(text)) continue;
    blocks.push({ kind: match[1].toLowerCase() === "h" ? "heading" : "paragraph", text });
  }
  return blocks;
}

function textBlocks(value: string): TextBlock[] {
  return value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter((text) => text && !isPageChrome(text))
    .map((text) => ({
      kind: text.length < 80 && !/[.!?…]$/.test(text) ? "heading" : "paragraph",
      text
    }));
}

function zipText(files: Record<string, Uint8Array>, name: string): string {
  const direct = files[name];
  if (direct) return strFromU8(direct);
  const key = Object.keys(files).find((item) => item.replace(/\\/g, "/").toLowerCase() === name);
  return key ? strFromU8(files[key]) : "";
}

function sliceTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1] : "";
}

function tagText(xml: string, tag: string): string {
  return decodeEntities(sliceTag(xml, tag));
}

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
