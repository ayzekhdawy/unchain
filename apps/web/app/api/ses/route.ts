import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { blobReady, readPrivate, writePrivate } from "@/lib/depo";
import { AUDIO_MAX, audioPath, COOKIE, isSha256, sameSiteMutation } from "@/lib/hesap";
import { decodeClip } from "@/lib/klip";
import { userFromToken } from "@/lib/oturum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function current() {
  const jar = await cookies();
  return userFromToken(jar.get(COOKIE)?.value);
}

export async function GET(request: Request) {
  const user = await current();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!blobReady()) return NextResponse.json({ error: "Dosya deposu kapalı." }, { status: 503 });
  const hash = new URL(request.url).searchParams.get("h");
  if (!isSha256(hash)) return NextResponse.json({ error: "Ses bulunamadı." }, { status: 400 });
  const stream = await readPrivate(audioPath(user.id, hash));
  if (!stream) return NextResponse.json({ error: "Ses bulunamadı." }, { status: 404 });
  return new NextResponse(stream, {
    status: 200,
    headers: { "content-type": "application/octet-stream", "cache-control": "private, no-store" }
  });
}

export async function PUT(request: Request) {
  if (!sameSiteMutation(request)) return NextResponse.json({ error: "İstek kabul edilmedi." }, { status: 403 });
  const user = await current();
  if (!user) return NextResponse.json({ error: "Giriş gerekli." }, { status: 401 });
  if (!blobReady()) return NextResponse.json({ error: "Dosya deposu kapalı." }, { status: 503 });
  const hash = request.headers.get("x-unchain-hash");
  if (!isSha256(hash)) return NextResponse.json({ error: "Ses bulunamadı." }, { status: 400 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!bytes.byteLength || bytes.byteLength > AUDIO_MAX || !decodeClip(bytes)) {
    return NextResponse.json({ error: "Ses parçası kabul edilmedi." }, { status: 400 });
  }
  try {
    await writePrivate(audioPath(user.id, hash), bytes, "application/octet-stream");
  } catch {
    return NextResponse.json({ error: "Ses Vercel’e yazılamadı." }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
