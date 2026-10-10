import { NextResponse } from "next/server";
import { ready } from "@/lib/db";
import { COOKIE, cookieSecure, mailOrigin, randomHex, sha256Hex } from "@/lib/hesap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function go(request: Request, failed: boolean) {
  const origin = mailOrigin(request.headers.get("host"), process.env.VERCEL_ENV, process.env.VERCEL_URL);
  const url = new URL("/uygulama", origin);
  if (failed) url.searchParams.set("giris", "gecersiz");
  return NextResponse.redirect(url, 303);
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return go(request, true);
  let db;
  try {
    db = await ready();
  } catch {
    return go(request, true);
  }
  if (!db) return go(request, true);
  const hash = await sha256Hex(token);
  const used = await db`UPDATE unchain_magic SET used_at = now()
    WHERE token_hash = ${hash} AND used_at IS NULL AND expires_at > now()
    RETURNING user_id`;
  const userId = (used[0] as { user_id?: string } | undefined)?.user_id;
  if (!userId) return go(request, true);
  const session = randomHex(32);
  const sessionHash = await sha256Hex(session);
  await db`INSERT INTO unchain_oturum (token_hash, user_id, expires_at)
    VALUES (${sessionHash}, ${userId}, now() + interval '30 days')`;
  const response = go(request, false);
  response.cookies.set(COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  return response;
}
