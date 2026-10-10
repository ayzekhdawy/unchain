import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { databaseUrl, ready } from "@/lib/db";
import { COOKIE, cookieSecure, sameSiteMutation, sha256Hex } from "@/lib/hesap";
import { userFromToken } from "@/lib/oturum";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!databaseUrl()) return NextResponse.json({ giris: false, email: null });
  try {
    const jar = await cookies();
    const user = await userFromToken(jar.get(COOKIE)?.value);
    return NextResponse.json({ giris: true, email: user?.email ?? null });
  } catch {
    return NextResponse.json({ giris: false, email: null });
  }
}

export async function DELETE(request: Request) {
  if (!sameSiteMutation(request)) return NextResponse.json({ error: "İstek kabul edilmedi." }, { status: 403 });
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token && databaseUrl()) {
    try {
      const db = await ready();
      if (db) {
        const hash = await sha256Hex(token);
        await db`DELETE FROM unchain_oturum WHERE token_hash = ${hash}`;
      }
    } catch {
      /* çerez yine de silinir */
    }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 0
  });
  return response;
}
