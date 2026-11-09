import { afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createAuth } from "@/lib/auth/config";
import { bootstrapFirstAdmin } from "@/lib/auth/bootstrap";
import { demoCatalog } from "@/lib/catalog/demo";
import { importCatalog, readImportedCatalog } from "@/lib/catalog/import";
import { initializeDatabase } from "@/lib/db/migrate";
import { account, catalogHistory, user } from "@/lib/db/schema";
import { getProgress, recordLessonOpened, setLessonProgress, setPracticeProgress } from "@/lib/progress/store";

const client = new PGlite();
const db = drizzle(client);
const secret = "migration-test-secret-for-isolated-database-only";
const password = "migration-test-password-only";
const email = "migration-test@example.invalid";

afterAll(async () => { await client.close(); });

it("chạy lặp migration trên database mới mà vẫn giữ tài khoản, danh mục và tiến độ", async () => {
  await initializeDatabase(db);
  await initializeDatabase(db);
  const auth = createAuth(db, { secret, baseURL: "http://localhost:3000" });
  await bootstrapFirstAdmin(db, auth, secret, { name: "Người thử", email, password });
  const [learner] = await db.select().from(user);
  const lessonId = demoCatalog.courses[0].chapters[0].lessons[0].id;
  await importCatalog(db, demoCatalog);
  await setLessonProgress(db, learner.id, lessonId, "completed", null);
  await recordLessonOpened(db, learner.id, lessonId);
  await setPracticeProgress(db, learner.id, "clip-first", "in_progress", null);
  const progress = await getProgress(db, learner.id);

  await initializeDatabase(db);
  await initializeDatabase(db);

  expect(await readImportedCatalog(db)).toEqual(demoCatalog);
  expect(await getProgress(db, learner.id)).toEqual(progress);
  expect(progress).toMatchObject({ lessons: { [lessonId]: "completed" }, practices: { "clip-first": "in_progress" }, lastOpenedLessonId: lessonId });
  expect(await db.select().from(user)).toHaveLength(1);
  expect(await db.select().from(account)).toHaveLength(1);
  expect(await db.select().from(catalogHistory)).toHaveLength(1);
  const signIn = await auth.api.signInEmail({ body: { email, password } });
  expect(signIn.user.id).toBe(learner.id);
});
