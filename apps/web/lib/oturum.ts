import { sha256Hex } from "./hesap";
import { ready } from "./db";

export async function userFromToken(token: string | undefined) {
  if (!token) return null;
  const db = await ready();
  if (!db) return null;
  const hash = await sha256Hex(token);
  const rows = await db`SELECT u.id, u.email
    FROM unchain_oturum o
    JOIN unchain_user u ON u.id = o.user_id
    WHERE o.token_hash = ${hash} AND o.expires_at > now()`;
  const row = rows[0] as { id: string; email: string } | undefined;
  return row ?? null;
}
