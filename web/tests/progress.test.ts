import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { initializeDatabase } from "@/lib/db/migrate";
import { user } from "@/lib/db/schema";
import { getProgress, setLessonProgress, setPracticeProgress, recordLessonOpened } from "@/lib/progress/store";

const client = new PGlite();
const db = drizzle(client);

beforeAll(async () => {
  await initializeDatabase(db);
  await db.insert(user).values([
    { id: "user-a", name: "A", email: "a@example.invalid", emailVerified: true },
    { id: "user-b", name: "B", email: "b@example.invalid", emailVerified: true },
  ]);
});
afterAll(async () => { await client.close(); });

describe("tiến độ riêng theo tài khoản", () => {
  it("lưu và cập nhật một bài cho A mà không thay trạng thái của B", async () => {
    await setLessonProgress(db, "user-a", "2207", "completed", null);
    expect((await getProgress(db, "user-a")).lessons["2207"]).toBe("completed");
    expect((await getProgress(db, "user-b")).lessons["2207"]).toBeUndefined();
    const version = (await getProgress(db, "user-a")).versions!.lessons["2207"];
    await setLessonProgress(db, "user-a", "2207", "in_progress", version);
    expect((await getProgress(db, "user-a")).lessons["2207"]).toBe("in_progress");
  });

  it("lưu bài thực hành tách khỏi bài học và ghi lần mở gần nhất riêng", async () => {
    await setPracticeProgress(db, "user-b", "clip-first", "completed", null);
    await recordLessonOpened(db, "user-b", "2207");
    const progress = await getProgress(db, "user-b");
    expect(progress.practices["clip-first"]).toBe("completed");
    expect(progress.lessons["2207"]).toBe("not_updated");
    expect(progress.lastOpenedLessonId).toBe("2207");
  });
});
