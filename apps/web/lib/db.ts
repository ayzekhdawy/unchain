import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

let client: Sql | null = null;
let schema: Promise<void> | null = null;

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function sql(): Sql | null {
  const url = databaseUrl();
  if (!url) return null;
  if (!client) client = neon(url);
  return client;
}

async function ensure(db: Sql) {
  await db`CREATE TABLE IF NOT EXISTS unchain_user (
    id text PRIMARY KEY,
    email text UNIQUE NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await db`CREATE TABLE IF NOT EXISTS unchain_magic (
    token_hash text PRIMARY KEY,
    user_id text NOT NULL REFERENCES unchain_user(id),
    email text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await db`CREATE TABLE IF NOT EXISTS unchain_oturum (
    token_hash text PRIMARY KEY,
    user_id text NOT NULL REFERENCES unchain_user(id),
    expires_at timestamptz NOT NULL
  )`;
  await db`CREATE TABLE IF NOT EXISTS unchain_kitaplik (
    user_id text PRIMARY KEY REFERENCES unchain_user(id),
    body text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await db`CREATE TABLE IF NOT EXISTS unchain_dosya (
    user_id text NOT NULL REFERENCES unchain_user(id),
    book_id text NOT NULL,
    pathname text NOT NULL,
    PRIMARY KEY (user_id, book_id)
  )`;
}

export async function ready() {
  const db = sql();
  if (!db) return null;
  if (!schema) {
    schema = ensure(db).catch((err) => {
      schema = null;
      throw err;
    });
  }
  await schema;
  return db;
}
