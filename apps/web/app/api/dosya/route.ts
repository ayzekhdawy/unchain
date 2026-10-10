import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ready } from "@/lib/db";
import { blobReady, writePrivate } from "@/lib/depo";
import { COOKIE, FILE_MAX, filePath, safeBookId, safeFileName, sameSiteMutation } from "@/lib/hesap";
import { userFromToken } from "@/lib/oturum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  if (!sameSiteMutation(request)) return NextResponse.json({ error: "İstek kabul edilmedi." }, { status: 403 });
  const jar = await cookies();
  const current = await userFromToken(jar.get(COOKIE)?.value);
  if (!current) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!blobReady()) return NextResponse.json({ error: "Dosya deposu kapalı." }, { status: 503 });
  const bookId = safeBookId(request.headers.get("x-unchain-book"));
  if (!bookId) return NextResponse.json({ error: "Dosya adı kabul edilmedi." }, { status: 400 });
  const name = safeFileName(request.headers.get("x-unchain-name"));
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > FILE_MAX) {
    return NextResponse.json({ error: "4 MB üstü dosya bu web kopyasına sığmaz." }, { status: 413 });
  }
  const pathname = filePath(current.id, bookId, name);
  try {
    await writePrivate(pathname, bytes, "application/octet-stream");
    const db = await ready();
    if (db) {
      await db`INSERT INTO unchain_dosya (user_id, book_id, pathname) VALUES (${current.id}, ${bookId}, ${pathname})
        ON CONFLICT (user_id, book_id) DO UPDATE SET pathname = EXCLUDED.pathname`;
    }
  } catch {
    return NextResponse.json({ error: "Dosya Vercel’e yazılamadı." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
