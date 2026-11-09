import type { PgliteDatabase } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";

const statements = [
  `CREATE TABLE IF NOT EXISTS "user" (id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE, email_verified boolean NOT NULL DEFAULT false, image text, role text NOT NULL DEFAULT 'user', created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS "session" (id text PRIMARY KEY, expires_at timestamp NOT NULL, token text NOT NULL UNIQUE, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), ip_address text, user_agent text, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "account" (id text PRIMARY KEY, account_id text NOT NULL, provider_id text NOT NULL, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, access_token text, refresh_token text, id_token text, access_token_expires_at timestamp, refresh_token_expires_at timestamp, scope text, password text, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS "verification" (id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamp NOT NULL, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS lesson_progress (user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, lesson_id text NOT NULL, state text NOT NULL DEFAULT 'not_updated' CHECK (state IN ('not_updated','in_progress','completed')), opened_at timestamp, updated_at timestamp NOT NULL DEFAULT now(), PRIMARY KEY (user_id, lesson_id))`,
  `CREATE TABLE IF NOT EXISTS practice_progress (user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, practice_id text NOT NULL, state text NOT NULL DEFAULT 'not_updated' CHECK (state IN ('not_updated','in_progress','completed')), updated_at timestamp NOT NULL DEFAULT now(), PRIMARY KEY (user_id, practice_id))`,
  `CREATE TABLE IF NOT EXISTS invitation (hash text PRIMARY KEY, created_by text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, expires_at timestamp NOT NULL, used_at timestamp)`,
  `CREATE TABLE IF NOT EXISTS setup_guard (id text PRIMARY KEY CHECK (id = 'first-admin'))`,
  `CREATE TABLE IF NOT EXISTS catalog_snapshot (id text PRIMARY KEY CHECK (id = 'active'), content text NOT NULL, digest text NOT NULL, imported_at timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS catalog_history (digest text PRIMARY KEY, content text NOT NULL, imported_at timestamp NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS lesson_media (user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, lesson_id text NOT NULL, kind text NOT NULL CHECK (kind IN ('bunny','youtube')), video_id text NOT NULL, embed_url text NOT NULL, collected_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), PRIMARY KEY (user_id, lesson_id))`,
];

export async function initializeDatabase(db: PgliteDatabase): Promise<void> {
  for (const statement of statements) await db.execute(sql.raw(statement));
}
