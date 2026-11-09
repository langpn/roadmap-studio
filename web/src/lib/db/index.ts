import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { initializeDatabase } from "./migrate";

const globalDb = globalThis as typeof globalThis & { roadmapDb?: Promise<PgliteDatabase>; roadmapCloseDb?: () => Promise<void> };

async function openDatabase(): Promise<PgliteDatabase> {
  let db: PgliteDatabase;
  if (process.env.DATABASE_URL) {
    const client = postgres(process.env.DATABASE_URL, { max: 5, prepare: false });
    globalDb.roadmapCloseDb = () => client.end();
    // Both Drizzle drivers implement the same PostgreSQL query contract used here.
    db = drizzlePostgres(client) as unknown as PgliteDatabase;
  } else {
    if (process.env.NODE_ENV === "production") throw new Error("Cần cấu hình DATABASE_URL khi triển khai.");
    const dataDir = path.resolve(/*turbopackIgnore: true*/ process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".data"));
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    const client = new PGlite(path.join(dataDir, "postgres"));
    globalDb.roadmapCloseDb = () => client.close();
    db = drizzlePglite(client);
  }
  await initializeDatabase(db);
  return db;
}

export function getDatabase(): Promise<PgliteDatabase> {
  globalDb.roadmapDb ??= openDatabase();
  return globalDb.roadmapDb;
}

export async function closeDatabase(): Promise<void> {
  await globalDb.roadmapCloseDb?.();
  delete globalDb.roadmapCloseDb;
  delete globalDb.roadmapDb;
}
