import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ready } from "@/lib/db";
import { wipeUser } from "@/lib/depo";
import { COOKIE, LIBRARY_MAX, sameSiteMutation } from "@/lib/hesap";
import { acceptLibrary, parseStored } from "@/lib/kitaplik";
import { userFromToken } from "@/lib/oturum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function user() {
  const jar = await cookies();
  return userFromToken(jar.get(COOKIE)?.value);
}

export async function GET() {
  const current = await user();
  if (!current) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const db = await ready();
  if (!db) return NextResponse.json({ error: "Giriş bu ortamda kapalı." }, { status: 503 });
  const rows = await db`SELECT body FROM unchain_kitaplik WHERE user_id = ${current.id}`;
  const body = (rows[0] as { body?: string } | undefined)?.body ?? null;
  return NextResponse.json({ library: parseStored(body) });
}

export async function PUT(request: Request) {
  if (!sameSiteMutation(request)) return NextResponse.json({ error: "İstek kabul edilmedi." }, { status: 403 });
  const current = await user();
  if (!current) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  const text = await request.text();
  if (text.length > LIBRARY_MAX) return NextResponse.json({ error: "Kitaplık bu kopya için büyük." }, { status: 413 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json({ error: "Kitaplık okunamadı." }, { status: 400 });
  }
  const accepted = acceptLibrary(parsed);
  if (!accepted.ok) return NextResponse.json({ error: accepted.error }, { status: 400 });
  const db = await ready();
  if (!db) return NextResponse.json({ error: "Giriş bu ortamda kapalı." }, { status: 503 });
  const body = JSON.stringify(accepted.library);
  await db`INSERT INTO unchain_kitaplik (user_id, body, updated_at) VALUES (${current.id}, ${body}, now())
    ON CONFLICT (user_id) DO UPDATE SET body = EXCLUDED.body, updated_at = now()`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!sameSiteMutation(request)) return NextResponse.json({ error: "İstek kabul edilmedi." }, { status: 403 });
  const current = await user();
  if (!current) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  try {
    await wipeUser(current.id);
  } catch {
    return NextResponse.json({ error: "Kopyalar silinemedi." }, { status: 502 });
  }
  const db = await ready();
  if (!db) return NextResponse.json({ error: "Giriş bu ortamda kapalı." }, { status: 503 });
  await db`DELETE FROM unchain_dosya WHERE user_id = ${current.id}`;
  await db`DELETE FROM unchain_kitaplik WHERE user_id = ${current.id}`;
  return NextResponse.json({ ok: true });
}
