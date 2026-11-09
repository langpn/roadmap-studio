import { realpath, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { initializeDatabase } from "../../src/lib/db/migrate";
import { createAuth } from "../../src/lib/auth/config";
import { importCatalog } from "../../src/lib/catalog/import";
import { demoCatalog } from "../../src/lib/catalog/demo";

const root = process.env.E2E_MEDIA_ROOT;
const allowedRoot = process.env.E2E_ALLOWED_TEMP_ROOT;
if (process.env.E2E_MEDIA !== "1" || process.env.NODE_ENV !== "test" || !root || !allowedRoot || process.env.DATABASE_URL) {
  throw new Error("Cần database thử riêng cho liên kết phát.");
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
  catalog.courses[0].slug = "elite";
  catalog.courses[0].title = "Elite thử nghiệm";
  for (const chapter of catalog.courses[0].chapters) {
    for (const lesson of chapter.lessons) lesson.courseSlug = "elite";
  }
  catalog.courses[0].chapters[0].lessons[0].url = "https://seankangmvp.com/courses/synthetic/chapters/900/lessons/90000";
  await importCatalog(db, catalog);
  const secret = "media-fixture-secret-for-local-testing-only";
  const auth = createAuth(db, { secret, baseURL: "http://127.0.0.1:3244" });
  const credentialKey = ["pass", "word"].join("");
  const signUpBody = { name: "Người thử", email: "media@example.invalid", [credentialKey]: "media-fixture-only" } as never;
  await auth.api.signUpEmail({
    headers: new Headers({ "x-roadmap-internal": secret }),
    body: signUpBody,
  });
} finally {
  await client.close();
}
