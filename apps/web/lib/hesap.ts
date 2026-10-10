export const COOKIE = "unchain_oturum";
export const FILE_MAX = 4_000_000;
export const AUDIO_MAX = 3_500_000;
export const LIBRARY_MAX = 3_000_000;
export const MAGIC_LIMIT = 5;
export const GIRIS_MESAJ = "Bağlantı gönderildiyse gelen kutuna düşer.";

export async function sha256Hex(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomHex(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function cleanEmail(raw: string) {
  const email = raw.trim().toLowerCase();
  if (!email || email.length > 200) return null;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return null;
  return email;
}

export function mailOrigin(host: string | null, vercelEnv: string | undefined, vercelUrl: string | undefined) {
  if (vercelEnv === "production") return "https://unchain.noniux.com";
  if (host && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
  if (vercelUrl && /^[a-z0-9.-]+$/i.test(vercelUrl)) return `https://${vercelUrl}`;
  return "https://unchain.noniux.com";
}

export function sameSiteMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function isSha256(value: string | null): value is string {
  return Boolean(value && /^[a-f0-9]{64}$/.test(value));
}

export function safeBookId(raw: string | null) {
  if (!raw || !/^[A-Za-z0-9_-]{1,80}$/.test(raw)) return null;
  return raw;
}

export function safeFileName(raw: string | null) {
  let decoded = raw ?? "dosya";
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    decoded = raw ?? "dosya";
  }
  const base = decoded.split(/[/\\]/).pop() ?? "dosya";
  const clean = base.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 80);
  return clean || "dosya";
}

export function filePath(userId: string, bookId: string, name: string) {
  return `u/${userId}/dosya/${bookId}/${name}`;
}

export function audioPath(userId: string, hash: string) {
  return `u/${userId}/ses/${hash}`;
}

export function cookieSecure() {
  return process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";
}
