import type { Library } from "./books";
import { emaSpeak, type EmaClip } from "./ema";
import { AUDIO_MAX } from "./hesap";
import { clipKey, decodeClip, encodeClip } from "./klip";

export type SessionInfo = { giris: boolean; email: string | null };

export async function fetchSession(): Promise<SessionInfo> {
  const response = await fetch("/api/oturum");
  if (!response.ok) return { giris: false, email: null };
  const data = (await response.json()) as Partial<SessionInfo>;
  return { giris: Boolean(data.giris), email: typeof data.email === "string" ? data.email : null };
}

export async function fetchLibrary() {
  const response = await fetch("/api/kitaplik");
  if (!response.ok) return null;
  const data = (await response.json()) as { library?: Library | null };
  return data.library ?? null;
}

export async function putLibrary(library: Library) {
  const response = await fetch("/api/kitaplik", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(library)
  });
  return response.ok;
}

export async function deleteLibrary() {
  const response = await fetch("/api/kitaplik", { method: "DELETE" });
  return response.ok;
}

export async function logout() {
  await fetch("/api/oturum", { method: "DELETE" });
}

export async function requestLink(email: string) {
  const response = await fetch("/api/giris", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email })
  });
  const data = (await response.json()) as { mesaj?: string; error?: string };
  return { ok: response.ok, mesaj: data.mesaj ?? data.error ?? "Bağlantı gönderilemedi." };
}

export async function uploadOriginal(bookId: string, file: File) {
  const response = await fetch("/api/dosya", {
    method: "PUT",
    headers: {
      "content-type": "application/octet-stream",
      "x-unchain-book": bookId,
      "x-unchain-name": encodeURIComponent(file.name)
    },
    body: file
  });
  if (response.ok) return null;
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return data.error ?? "Dosya Vercel’e yazılamadı.";
}

export async function speakCached(text: string, speed: number, signedIn: boolean): Promise<EmaClip & { fromCache: boolean }> {
  if (signedIn) {
    try {
      const key = await clipKey(text, speed);
      const got = await fetch(`/api/ses?h=${key}`);
      if (got.ok) {
        const decoded = decodeClip(new Uint8Array(await got.arrayBuffer()));
        if (decoded) return { ...decoded, spoken: text, fromCache: true };
      }
      const clip = await emaSpeak(text, speed, 0);
      const bytes = encodeClip(clip);
      if (bytes.byteLength <= AUDIO_MAX) {
        void fetch("/api/ses", {
          method: "PUT",
          headers: { "content-type": "application/octet-stream", "x-unchain-hash": key },
          body: new Blob([bytes])
        }).catch(() => undefined);
      }
      return { ...clip, fromCache: false };
    } catch {
      const clip = await emaSpeak(text, speed, 0);
      return { ...clip, fromCache: false };
    }
  }
  const clip = await emaSpeak(text, speed, 0);
  return { ...clip, fromCache: false };
}
