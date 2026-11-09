import { realpath, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { initializeDatabase } from "../../src/lib/db/migrate";
import { createAuth } from "../../src/lib/auth/config";
import { importCatalog } from "../../src/lib/catalog/import";
import { demoCatalog } from "../../src/lib/catalog/demo";

const root = process.env.E2E_SOURCE_ROOT;
const allowedRoot = process.env.E2E_ALLOWED_TEMP_ROOT;
if (process.env.E2E_SOURCE !== "1" || process.env.NODE_ENV !== "test" || !root || !allowedRoot || process.env.DATABASE_URL) {
  throw new Error("Cần database thử riêng cho bài học từ nguồn.");
}
const directory = await realpath(root);
const allowed = await realpath(allowedRoot);
if (!directory.startsWith(`${allowed}${path.sep}`) || (await readdir(directory)).length) {
  throw new Error("Database thử phải nằm trong thư mục tạm và đang trống.");
}

const client = new PGlite(path.join(directory, "postgres"));
const db = drizzle(client);
try {
  await initializeDatabase(db);
  const catalog = structuredClone(demoCatalog);
  catalog.courses[0].chapters[0].lessons[0].url = "https://seankangmvp.com/courses/synthetic/chapters/900/lessons/90000";
  await importCatalog(db, catalog);
  const secret = "source-fixture-secret-for-local-testing-only";
  const auth = createAuth(db, { secret, baseURL: "http://127.0.0.1:3243" });
  await auth.api.signUpEmail({
    headers: new Headers({ "x-roadmap-internal": secret }),
    body: { name: "Người thử", email: "source@example.invalid", password: "source-fixture-password-only" },
  });
} finally {
  await client.close();
}
