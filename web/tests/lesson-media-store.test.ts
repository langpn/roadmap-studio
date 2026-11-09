import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { initializeDatabase } from "@/lib/db/migrate";
import { user } from "@/lib/db/schema";
import { demoCatalog } from "@/lib/catalog/demo";
import { deleteLessonMedia, getLessonMedia, getLessonMediaForLesson, importLessonMedia } from "@/lib/media/store";

const client = new PGlite();
const db = drizzle(client);
const learner = "learner-media";
const other = "other-media";

const lessonA = demoCatalog.courses[0].chapters[0].lessons[0].id;
const lessonB = demoCatalog.courses[0].chapters[0].lessons[1].id;

function mapOf(entries: { lessonId: string; embedUrl: string }[]) {
  return {
    version: 1 as const,
    collectedAt: "2026-11-07T10:00:00.000Z",
    entries: entries.map((entry) => ({
      lessonId: entry.lessonId,
      kind: "bunny" as const,
      videoId: "00000000-0000-4000-8000-000000000001",
      embedUrl: entry.embedUrl,
    })),
  };
}

beforeAll(async () => {
  await initializeDatabase(db);
  await db.insert(user).values([
    { id: learner, name: "Người học", email: "media-learner@example.invalid" },
    { id: other, name: "Người khác", email: "media-other@example.invalid" },
  ]);
});
afterAll(async () => { await client.close(); });

describe("lưu liên kết phát của người học", () => {
  it("bỏ qua bài không có trong danh mục thay vì lưu dữ liệu mồ côi", async () => {
    const result = await importLessonMedia(db, learner, mapOf([
      { lessonId: lessonA, embedUrl: "https://iframe.mediadelivery.net/embed/431650/00000000-0000-4000-8000-000000000001" },
      { lessonId: "999999", embedUrl: "https://iframe.mediadelivery.net/embed/431650/00000000-0000-4000-8000-000000000001" },
    ]), demoCatalog);
    expect(result).toMatchObject({ imported: 1, replaced: 0, rejected: 1 });
    expect((await getLessonMedia(db, learner)).map((entry) => entry.lessonId)).toEqual([lessonA]);
  });

  it("nhập lại thì cập nhật chứ không nhân đôi bản ghi", async () => {
    const first = mapOf([{ lessonId: lessonA, embedUrl: "https://iframe.mediadelivery.net/embed/431650/00000000-0000-4000-8000-000000000001" }]);
    const again = mapOf([{ lessonId: lessonA, embedUrl: "https://iframe.mediadelivery.net/embed/431650/00000000-0000-4000-8000-000000000002" }]);
    const result = await importLessonMedia(db, learner, again, demoCatalog);
    expect(result).toMatchObject({ imported: 1, replaced: 1, rejected: 0 });
    expect(await getLessonMedia(db, learner)).toHaveLength(1);
    expect((await getLessonMediaForLesson(db, learner, lessonA))?.embedUrl).toContain("00000000-0000-4000-8000-000000000002");
    expect(first.entries[0].embedUrl).not.toBe(again.entries[0].embedUrl);
  });

  it("tách dữ liệu giữa hai tài khoản trên cùng máy", async () => {
    await importLessonMedia(db, other, mapOf([
      { lessonId: lessonB, embedUrl: "https://www.youtube-nocookie.com/embed/KVmmLDVS_8o" },
    ]), demoCatalog);
    const mine = await getLessonMedia(db, learner);
    const theirs = await getLessonMedia(db, other);
    expect(mine.some((entry) => entry.lessonId === lessonB)).toBe(false);
    expect(theirs.map((entry) => entry.lessonId)).toEqual([lessonB]);
    expect(await getLessonMediaForLesson(db, learner, lessonB)).toBeNull();
  });

  it("không lưu gì khi mọi bài đều không khớp danh mục", async () => {
    const result = await importLessonMedia(db, "learner-empty", mapOf([]), demoCatalog);
    expect(result).toEqual({ imported: 0, replaced: 0, rejected: 0 });
    expect(await getLessonMedia(db, "learner-empty")).toEqual([]);
  });

  it("xoá hết liên kết của một tài khoản mà không đụng tài khoản khác", async () => {
    await deleteLessonMedia(db, learner);
    expect(await getLessonMedia(db, learner)).toEqual([]);
    expect((await getLessonMedia(db, other)).length).toBeGreaterThan(0);
  });
});
