import { realpath, readdir } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createAuth } from "../../src/lib/auth/config";
import { demoCatalog } from "../../src/lib/catalog/demo";
import { importCatalog } from "../../src/lib/catalog/import";
import { initializeDatabase } from "../../src/lib/db/migrate";

// Explicit opt-in, empty temporary directory, fake accounts and no mail transport.
const root = process.env.E2E_CONFLICT_ROOT;
if (process.env.E2E_CONFLICT !== "1" || process.env.NODE_ENV !== "test" || !root || process.env.DATABASE_URL) {
  throw new Error("Cần cấu hình database PGlite thử riêng.");
}
const dataDir = await realpath(root);
const allowedRoot = await realpath(process.env.E2E_ALLOWED_TEMP_ROOT ?? "");
if (!dataDir.startsWith(`${allowedRoot}/`) || (await readdir(dataDir)).length !== 0) {
  throw new Error("Thư mục database thử phải nằm trong thư mục tạm và đang trống.");
}
const client = new PGlite(join(dataDir, "postgres"));
const db = drizzle(client);
try {
  await initializeDatabase(db);
  await importCatalog(db, demoCatalog);
  const secret = "isolated-progress-conflict-test-secret-only";
  const auth = createAuth(db, {
    secret, baseURL: "http://127.0.0.1:3237",
    mailer: { configured: false, send: async () => { throw new Error("Mail disabled"); } },
  });
  for (const [name, email] of [["Người thử A", "conflict-a@example.invalid"], ["Người thử B", "conflict-b@example.invalid"]]) {
    await auth.api.signUpEmail({
      headers: new Headers({ "x-roadmap-internal": secret }),
      body: { name, email, password: "isolated-only-fake-password" },
    });
  }
} finally {
  await client.close();
}
