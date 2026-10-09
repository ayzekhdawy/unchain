import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function blocked(ip: string) {
  const v = ip.toLowerCase();
  if (v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
  const parts = v.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return v.includes(":");
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

async function safeUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((r) => r.address);
  if (!ips.length || ips.some(blocked)) return null;
  return url;
}

function textFromHtml(html: string) {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? "Bağlantı";
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);
  return { title: title.slice(0, 180), text: body };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { url?: string } | null;
  let current = await safeUrl(body?.url?.trim() ?? "");
  if (!current) return NextResponse.json({ error: "Adres açılamadı." }, { status: 400 });

  for (let hop = 0; hop < 3; hop++) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": "Unchain/0.1" },
      signal: AbortSignal.timeout(8000)
    });
    if (response.status >= 300 && response.status < 400) {
      const next = await safeUrl(new URL(response.headers.get("location") ?? "", current).toString());
      if (!next) return NextResponse.json({ error: "Yönlendirme kabul edilmedi." }, { status: 400 });
      current = next;
      continue;
    }
    if (!response.ok) return NextResponse.json({ error: "Sayfa okunamadı." }, { status: 422 });
    const html = await response.text();
    const parsed = textFromHtml(html);
    if (parsed.text.length < 40) return NextResponse.json({ error: "Sayfada okunacak metin yok." }, { status: 422 });
    return NextResponse.json(parsed);
  }
  return NextResponse.json({ error: "Çok fazla yönlendirme." }, { status: 400 });
}
