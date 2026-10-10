import { NextResponse } from "next/server";
import { ready } from "@/lib/db";
import { cleanEmail, GIRIS_MESAJ, MAGIC_LIMIT, mailOrigin, randomHex, sameSiteMutation, sha256Hex } from "@/lib/hesap";
import { sendMagic } from "@/lib/posta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!sameSiteMutation(request)) return NextResponse.json({ error: "İstek kabul edilmedi." }, { status: 403 });
  let emailRaw = "";
  try {
    const body = (await request.json()) as { email?: unknown };
    emailRaw = typeof body.email === "string" ? body.email : "";
  } catch {
    return NextResponse.json({ error: "E-posta adresi geçersiz." }, { status: 400 });
  }
  const email = cleanEmail(emailRaw);
  if (!email) return NextResponse.json({ error: "E-posta adresi geçersiz." }, { status: 400 });

  let db;
  try {
    db = await ready();
  } catch {
    return NextResponse.json({ error: "Giriş şu an açılamadı." }, { status: 503 });
  }
  if (!db) return NextResponse.json({ error: "Giriş bu ortamda kapalı." }, { status: 503 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "Giriş bu ortamda kapalı." }, { status: 503 });

  const recent = await db`SELECT count(*)::int AS n FROM unchain_magic
    WHERE email = ${email} AND created_at > now() - interval '1 hour'`;
  const count = Number((recent[0] as { n?: number } | undefined)?.n ?? 0);
  if (count >= MAGIC_LIMIT) return NextResponse.json({ ok: true, mesaj: GIRIS_MESAJ });

  const userId = `usr${randomHex(16)}`;
  const created = await db`INSERT INTO unchain_user (id, email) VALUES (${userId}, ${email})
    ON CONFLICT (email) DO UPDATE SET email = unchain_user.email
    RETURNING id`;
  const id = String((created[0] as { id: string }).id);
  const token = randomHex(32);
  const hash = await sha256Hex(token);
  await db`INSERT INTO unchain_magic (token_hash, user_id, email, expires_at)
    VALUES (${hash}, ${id}, ${email}, now() + interval '20 minutes')`;

  const origin = mailOrigin(request.headers.get("host"), process.env.VERCEL_ENV, process.env.VERCEL_URL);
  const sent = await sendMagic(email, `${origin}/api/giris/ac?t=${token}`);
  if (!sent) return NextResponse.json({ error: "Bağlantı gönderilemedi." }, { status: 502 });
  return NextResponse.json({ ok: true, mesaj: GIRIS_MESAJ });
}
