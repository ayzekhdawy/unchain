import { normalizeLibrary, type Library } from "./books";
import { LIBRARY_MAX } from "./hesap";

export function acceptLibrary(raw: unknown): { ok: true; library: Library } | { ok: false; error: string } {
  let text = "";
  try {
    text = JSON.stringify(raw);
  } catch {
    return { ok: false, error: "Kitaplık okunamadı." };
  }
  if (text.length > LIBRARY_MAX) return { ok: false, error: "Kitaplık bu kopya için büyük." };
  if (!raw || typeof raw !== "object") return { ok: false, error: "Kitaplık okunamadı." };
  const body = raw as Partial<Library>;
  if (!Array.isArray(body.books) || body.books.length === 0 || body.books.length > 200) {
    return { ok: false, error: "Kitaplık okunamadı." };
  }
  for (const book of body.books) {
    if (!book || typeof book.id !== "string" || typeof book.title !== "string" || !Array.isArray(book.chapters)) {
      return { ok: false, error: "Kitaplık okunamadı." };
    }
  }
  return { ok: true, library: normalizeLibrary(body) };
}

export function parseStored(raw: string | null) {
  if (!raw) return null;
  try {
    const accepted = acceptLibrary(JSON.parse(raw) as unknown);
    return accepted.ok ? accepted.library : null;
  } catch {
    return null;
  }
}
