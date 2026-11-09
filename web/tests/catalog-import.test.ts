import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { initializeDatabase } from "@/lib/db/migrate";
import { catalogHistory, user } from "@/lib/db/schema";
import { demoCatalog } from "@/lib/catalog/demo";
import { importCatalog, readImportedCatalog, previewCatalogChanges } from "@/lib/catalog/import";
import { getProgress, setLessonProgress } from "@/lib/progress/store";
import { loadCatalog } from "@/lib/catalog/source";
import { getActiveCatalog } from "@/lib/catalog/active";
import { hasPrivateCatalog } from "./private-catalog";

const client = new PGlite();
const db = drizzle(client);
vi.mock("@/lib/db", () => ({ getDatabase: async () => db }));
beforeAll(async () => {
  await initializeDatabase(db);
  await db.insert(user).values({ id: "learner", name: "A", email: "a@example.invalid" });
});
afterAll(async () => { await client.close(); });

describe("nhập lại danh mục", () => {
  it("xem chênh lệch, giữ tiến độ khi bài đổi tên, đổi vị trí hoặc biến mất", async () => {
    await importCatalog(db, demoCatalog);
    const lessonId = demoCatalog.courses[0].chapters[0].lessons[0].id;
    await setLessonProgress(db, "learner", lessonId, "completed", (await getProgress(db, "learner")).versions!.lessons[lessonId] ?? null);
    const changed = structuredClone(demoCatalog);
    const chapterLessons = changed.courses[0].chapters[0].lessons;
    chapterLessons[0].title = "Tên đã đổi";
    chapterLessons[0].position = 1;
    chapterLessons[1].position = 0;
    [chapterLessons[0], chapterLessons[1]] = [chapterLessons[1], chapterLessons[0]];
    chapterLessons.pop();
    changed.courses[0].lessonCount -= 1;
    changed.lessonCount -= 1;
    const preview = previewCatalogChanges(demoCatalog, changed);
    expect(preview.changed).toBe(2);
    expect(preview.removed).toBe(1);
    await importCatalog(db, changed);
    const imported = (await readImportedCatalog(db))!.courses[0].chapters[0].lessons;
    expect(imported.find((lesson) => lesson.id === lessonId)).toMatchObject({ title: "Tên đã đổi", position: 1 });
    expect((await getProgress(db, "learner")).lessons[lessonId]).toBe("completed");
    await importCatalog(db, changed);
    expect((await readImportedCatalog(db))!.lessonCount).toBe(changed.lessonCount);
    expect(await db.select().from(catalogHistory)).toHaveLength(2);
  });

  it("từ chối mã bài trùng trước khi ghi đè ảnh chụp", async () => {
    const before = await readImportedCatalog(db);
    const invalid = structuredClone(demoCatalog);
    invalid.courses[0].chapters[0].lessons[1].id = invalid.courses[0].chapters[0].lessons[0].id;
    await expect(importCatalog(db, invalid)).rejects.toThrow();
    expect(await readImportedCatalog(db)).toEqual(before);

    invalid.courses[0].chapters[0].lessons[1].id = "";
    await expect(importCatalog(db, invalid)).rejects.toThrow();
    expect(await readImportedCatalog(db)).toEqual(before);
  });

  it.skipIf(!hasPrivateCatalog)("giữ trạng thái mô tả và nguồn quan sát qua ảnh chụp đã lưu", async () => {
    const source = await loadCatalog();
    await importCatalog(db, source);
    const restored = await readImportedCatalog(db);
    const lesson = (id: string) => restored!.courses
      .flatMap((course) => course.chapters.flatMap((chapter) => chapter.lessons))
      .find((entry) => entry.id === id);
    expect(lesson("5705")?.descriptionStatus).toBe("placeholder");
    expect(lesson("2860")?.descriptionStatus).toBe("link_only");
    expect(lesson("1994")?.observation?.from).toBe("2026-11-05T06:53:24.831Z");
  });

  it.skipIf(!hasPrivateCatalog)("hiện lại tiêu đề snapshot cũ mà không thay database hoặc tiến độ", async () => {
    const source = await loadCatalog();
    const saved = structuredClone(source);
    const feedback = saved.courses.find((course) => course.slug === "elite-pro")!
      .chapters.find((chapter) => chapter.id === "29")!.lessons[0];
    const originalTitle = feedback.title;
    feedback.title = "Bài 1";
    feedback.titleWithheld = true;
    await importCatalog(db, saved);
    await setLessonProgress(db, "learner", feedback.id, "completed", (await getProgress(db, "learner")).versions!.lessons[feedback.id] ?? null);

    const active = await getActiveCatalog();
    const restored = active.courses.find((course) => course.slug === "elite-pro")!
      .chapters.find((chapter) => chapter.id === "29")!.lessons[0];
    expect(restored).toMatchObject({ id: feedback.id, title: originalTitle, titleWithheld: false });
    expect(await readImportedCatalog(db)).toEqual(saved);
    expect((await getProgress(db, "learner")).lessons[feedback.id]).toBe("completed");
  });
});
