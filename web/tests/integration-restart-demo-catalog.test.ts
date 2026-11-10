import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { initializeDatabase } from "@/lib/db/migrate";
import { account, user } from "@/lib/db/schema";
import { createAuth } from "@/lib/auth/config";
import { bootstrapFirstAdmin } from "@/lib/auth/bootstrap";
import { importCatalog, readImportedCatalog } from "@/lib/catalog/import";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { normalizeCatalog, searchLessons, type Catalog } from "@/lib/catalog/normalize";
import { getRelatedLessons } from "@/lib/catalog/lesson-links";
import { getProgress, setLessonProgress } from "@/lib/progress/store";
import { Workspace } from "@/components/workspace";
import { LessonDetail } from "@/components/lesson-detail";
import { PRACTICE_IDS } from "@/lib/progress/practice-ids";
import { hasPrivateCatalog } from "./private-catalog";

const secret = "{{SECRET_r3st4rt4}}";
const origin = "http://127.0.0.1:3000";
const password = "{{SECRET_r3st4rtp}}";
const email = "restart@example.invalid";

let dataDir = "";

// Hai "lần khởi động" chia sẻ cùng thư mục PGlite trên đĩa, nhưng không đụng .data của máy.
async function openOnDisk() {
  const client = new PGlite(path.join(dataDir, "postgres"));
  const db = drizzle(client);
  await initializeDatabase(db);
  return { client, db };
}

beforeAll(async () => {
  vi.stubEnv("APP_MODE", "private");
  vi.stubEnv("BETTER_AUTH_URL", origin);
  vi.stubEnv("BETTER_AUTH_SECRET", secret);
  dataDir = await mkdtemp(path.join(tmpdir(), "roadmap-restart-"));
});

afterAll(async () => {
  vi.unstubAllEnvs();
  await rm(dataDir, { recursive: true, force: true });
});

const rawCourse = (slug: string, id: string) => ({
  slug,
  course: { name: `Khóa giả ${slug}`, url: `https://seankangmvp.com/courses/${slug}` },
  chapters: [{
    chapter_id: "1",
    title: "Chương giả",
    url: `https://seankangmvp.com/courses/${slug}/chapters/1/lessons`,
    lessons: [{ lesson_id: id, name: `Bài giả ${id}`, url: `https://seankangmvp.com/courses/${slug}/chapters/1/lessons/${id}` }],
  }],
});

const fakeCatalog = (slug: string, id: string): Catalog => normalizeCatalog([rawCourse(slug, id)]);

describe("7.2 khởi động lại và phục hồi trên dữ liệu thử", () => {
  it("đóng rồi mở lại database trên đĩa vẫn giữ tài khoản, tiến độ và danh mục", async () => {
    const first = await openOnDisk();
    const auth = createAuth(first.db, { secret, baseURL: origin });
    await bootstrapFirstAdmin(first.db, auth, secret, { name: "Chủ máy", email, password });
    const [owner] = await first.db.select().from(user);
    await setLessonProgress(first.db, owner.id, "5860", "completed", null);
    await setLessonProgress(first.db, owner.id, "2207", "in_progress", null);

    const catalog = fakeCatalog("khoa-gia-restart", "880001");
    await importCatalog(first.db, catalog);
    const before = await getProgress(first.db, owner.id);
    await first.client.close();

    // "Khởi động lại": tiến trình mới, thư mục dữ liệu cũ.
    const second = await openOnDisk();
    const signIn = await createAuth(second.db, { secret, baseURL: origin }).api.signInEmail({
      body: { email, password },
    });
    expect(signIn.user.id).toBe(owner.id);
    expect(await getProgress(second.db, signIn.user.id)).toEqual(before);
    expect((await readImportedCatalog(second.db))!.courses.map((course) => course.slug)).toEqual(["khoa-gia-restart"]);
    // Mật khẩu vẫn ở dạng băm sau khi khởi động lại.
    const [credentials] = await second.db.select().from(account);
    expect(credentials.password).not.toContain(password);
    await second.client.close();
  }, 120_000);

  it("sao lưu rồi phục hồi sang database thử khác mà không đổi dữ liệu gốc", async () => {
    const source = await openOnDisk();
    const [owner] = await source.db.select().from(user);
    const before = await getProgress(source.db, owner.id);
    const beforeCatalog = await readImportedCatalog(source.db);

    const dump = await source.client.dumpDataDir("gzip");
    // Dữ liệu gốc vẫn ghi được sau khi sao lưu (bản dump là ảnh chụp, không khoá).
    await setLessonProgress(source.db, owner.id, "880001", "completed", null);
    expect((await getProgress(source.db, owner.id)).lessons["880001"]).toBe("completed");
    await source.client.close();

    // Phục hồi vào instance riêng, không trỏ vào thư mục đang dùng.
    const restored = new PGlite({ loadDataDir: dump instanceof Blob ? dump : new Blob([dump]) });
    const restoredDb = drizzle(restored);
    expect(await getProgress(restoredDb, owner.id)).toEqual(before);
    expect(await readImportedCatalog(restoredDb)).toEqual(beforeCatalog);
    const signIn = await createAuth(restoredDb, { secret, baseURL: origin }).api.signInEmail({ body: { email, password } });
    expect(signIn.user.id).toBe(owner.id);
    await restored.close();

    // Bản gốc vẫn giữ thay đổi sau khi phục hồi ở nơi khác.
    const reopened = await openOnDisk();
    expect((await getProgress(reopened.db, owner.id)).lessons["880001"]).toBe("completed");
    await reopened.client.close();
  }, 120_000);

  it("nguồn danh mục bị thiếu thì vẫn mở ảnh chụp đã lưu, không tự nhập lại", async () => {
    const { client, db } = await openOnDisk();
    const saved = fakeCatalog("khoa-gia-nguon-thieu", "880002");
    await importCatalog(db, saved);

    vi.stubEnv("CATALOG_MANIFEST", path.join(dataDir, "khong-ton-tai.json"));
    vi.stubEnv("CATALOG_SOURCE_ROOT", dataDir);
    // Nếu test lỡ mở database thật, PGlite sẽ tạo thư mục này.
    vi.stubEnv("PGLITE_DATA_DIR", path.join(dataDir, "khong-duoc-dung"));
    vi.doMock("@/lib/db", () => ({ getDatabase: async () => db }));
    try {
      // getActiveCatalog dùng getDatabase; mock chỉ áp cho lần import dưới đây.
      vi.resetModules();
      const { getActiveCatalog: withDb } = await import("@/lib/catalog/active");
      expect((await withDb()).courses.map((course) => course.slug)).toEqual(["khoa-gia-nguon-thieu"]);
      expect(existsSync(path.join(dataDir, "khong-duoc-dung"))).toBe(false);
    } finally {
      vi.doUnmock("@/lib/db");
      vi.resetModules();
      vi.stubEnv("CATALOG_MANIFEST", "");
      vi.stubEnv("CATALOG_SOURCE_ROOT", "");
      vi.stubEnv("PGLITE_DATA_DIR", "");
      await client.close();
    }
  }, 60_000);
});

describe("12.2 các trường hợp danh mục và giao diện bằng fixture", () => {
  it("tìm được bài trong cả mười khóa giả, kể cả khóa thêm sau", () => {
    const courses = Array.from({ length: 10 }, (_, index) => fakeCatalog(`khoa-gia-${index + 1}`, `77000${index}`).courses[0]);
    const catalog: Catalog = {
      courses,
      lessonCount: courses.length,
      chapterCount: courses.length,
    };
    expect(catalog.courses).toHaveLength(10);
    expect(searchLessons(catalog, "bài giả 770009").map((lesson) => lesson.id)).toEqual(["770009"]);
    // Không có bài nào bị loại khi vượt chín khóa.
    expect(searchLessons(catalog, "bài giả").length).toBe(10);
  });

  it("bài không có liên kết hiển thị danh sách rỗng thay vì liên kết hỏng", () => {
    const lesson = demoCatalog.courses[0].chapters[0].lessons[0];
    const html = renderToStaticMarkup(createElement(LessonDetail, {
      lesson,
      course: demoCatalog.courses[0],
      chapter: demoCatalog.courses[0].chapters[0],
      currentState: "not_updated" as const,
      mode: "demo" as const,
      onStateChange: () => {},
      onClose: () => {},
      relatedLessons: [],
      showRelatedLessons: true,
    }));
    expect(html).toContain("Chưa có bài liên kết gợi ý.");
    expect(html).not.toContain("undefined");
  });

  it("khóa mới xuất hiện trong không gian học mà không cần sửa số khóa", () => {
    const catalog = structuredClone(demoCatalog);
    const extra = structuredClone(demoCatalog.courses[0]);
    extra.slug = "demo-extra";
    extra.title = "Khóa giả thêm sau";
    extra.chapters = extra.chapters.map((chapter) => ({
      ...chapter, lessons: chapter.lessons.map((lesson) => ({ ...lesson, courseSlug: "demo-extra" })),
    }));
    catalog.courses = [...catalog.courses, extra];
    const html = renderToStaticMarkup(createElement(Workspace, {
      catalog,
      roadmap: demoRoadmap,
      initialProgress: { lessons: {}, practices: {}, lastOpenedLessonId: null },
      mode: "demo",
      userName: "bạn",
    }));
    expect(html).toContain("Giáo trình (4 khóa)");
    expect(html).toContain("Khóa giả thêm sau");
    expect(html).toContain(`0/${PRACTICE_IDS.length}`);
  });

  it("danh mục rỗng không làm sập trang", () => {
    const html = renderToStaticMarkup(createElement(Workspace, {
      catalog: { courses: [], lessonCount: 0, chapterCount: 0 },
      roadmap: demoRoadmap,
      initialProgress: { lessons: {}, practices: {}, lastOpenedLessonId: null },
      mode: "private",
      userName: "A",
    }));
    expect(html).toContain("Không gian học dựng video");
  });

  it("hộp thoại và nhóm trạng thái giữ hợp đồng bàn phím/trợ năng", () => {
    const lesson = demoCatalog.courses[0].chapters[0].lessons[0];
    const html = renderToStaticMarkup(createElement(LessonDetail, {
      lesson,
      course: demoCatalog.courses[0],
      chapter: demoCatalog.courses[0].chapters[0],
      currentState: "in_progress" as const,
      mode: "demo" as const,
      onStateChange: () => {},
      onClose: () => {},
    }));
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="lesson-detail-title"');
    expect(html).toContain('aria-label="Đóng bảng chi tiết bài học"');
    expect(html).toContain('role="group"');
    // Trạng thái hiện tại được đánh dấu cho trình đọc màn hình.
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    // Nút đóng đứng trước phần thân hộp thoại trong DOM.
    expect(html.indexOf("Đóng bảng chi tiết bài học")).toBeLessThan(html.indexOf("<main"));
  });

  it.skipIf(!hasPrivateCatalog)("bài thật không có liên kết vẫn mở được với danh sách rỗng", async () => {
    const { loadCatalog } = await import("@/lib/catalog/source");
    const { eliteRelatedLinks } = await import("@/lib/catalog/elite-related-links");
    const catalog = await loadCatalog();
    const lessons = catalog.courses.flatMap((course) => course.chapters.flatMap((chapter) =>
      chapter.lessons.map((lesson) => ({ course, lesson }))));
    const lonely = lessons.find(({ course, lesson }) =>
      getRelatedLessons(catalog, eliteRelatedLinks, course.slug, lesson.id).length === 0);
    expect(lonely).toBeTruthy();
    expect(getRelatedLessons(catalog, eliteRelatedLinks, lonely!.course.slug, lonely!.lesson.id)).toEqual([]);
  }, 60_000);

  it("giữ demo tách khỏi dữ liệu thử đã nhập", async () => {
    const { client, db } = await openOnDisk();
    await importCatalog(db, fakeCatalog("khoa-gia-demo", "660001"));
    const saved = (await readImportedCatalog(db))!;
    const demo = JSON.stringify({ demoCatalog, demoRoadmap });
    for (const course of saved.courses) expect(demo).not.toContain(course.slug);
    expect(demo).not.toContain("660001");
    await client.close();
  }, 60_000);
});
