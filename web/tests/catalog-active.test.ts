import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoCatalog } from "@/lib/catalog/demo";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const dependencies = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  readImportedCatalog: vi.fn(),
  importCatalog: vi.fn(),
  loadCatalog: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ getDatabase: dependencies.getDatabase }));
vi.mock("@/lib/catalog/import", () => ({
  readImportedCatalog: dependencies.readImportedCatalog,
  importCatalog: dependencies.importCatalog,
}));
vi.mock("@/lib/catalog/source", () => ({ loadCatalog: dependencies.loadCatalog }));

import { getActiveCatalog } from "@/lib/catalog/active";

describe("danh mục cá nhân đã nhập", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dependencies.getDatabase.mockResolvedValue({});
  });
  afterEach(() => vi.unstubAllEnvs());

  it("hiển thị chữ trang Elite đã lưu cho bài cùng URL mà không sửa ảnh chụp", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "roadmap-description-"));
    await mkdir(path.join(root, "courses/elite"), { recursive: true });
    const saved = structuredClone(demoCatalog);
    const course = saved.courses[0];
    course.slug = "elite";
    const chapter = course.chapters[0];
    const lesson = chapter.lessons[0];
    lesson.courseSlug = "elite";
    lesson.url = "https://seankangmvp.com/courses/davinci-elite/chapters/42/lessons/3511";
    lesson.id = "3511";
    lesson.summary = null;
    const other = chapter.lessons[1];
    other.url = "https://seankangmvp.com/courses/davinci-elite/chapters/42/lessons/3512";
    other.summary = null;
    const original = structuredClone(saved);
    await writeFile(path.join(root, "courses/elite/noi-dung.json"), JSON.stringify({ chapters: [{ lessons: [
      { url: lesson.url, captured: true, content_status: "read", hydration: "content-present", text: "Nội dung trang đã lưu." },
      { url: other.url, captured: true, content_status: "empty-after-hydration-wait", hydration: "empty-after-wait", text: "Không được hiển thị." },
    ] }] }));
    vi.stubEnv("CATALOG_SOURCE_ROOT", root);
    dependencies.readImportedCatalog.mockResolvedValue(saved);

    const active = await getActiveCatalog();
    expect(active.courses[0].chapters[0].lessons[0].summary).toBe("Nội dung trang đã lưu.");
    expect(active.courses[0].chapters[0].lessons[1].summary).toBeNull();
    expect(saved).toEqual(original);
    expect(dependencies.importCatalog).not.toHaveBeenCalled();
  });

  it("bản sao mới chưa có danh mục riêng vẫn mở được với danh mục trống", async () => {
    vi.stubEnv("CATALOG_MANIFEST", "");
    vi.stubEnv("CATALOG_SOURCE_ROOT", "");
    dependencies.readImportedCatalog.mockResolvedValue(null);
    dependencies.loadCatalog.mockRejectedValue(Object.assign(new Error("missing source"), { code: "ENOENT" }));

    expect(await getActiveCatalog()).toEqual({ courses: [], chapterCount: 0, lessonCount: 0 });
    expect(dependencies.importCatalog).not.toHaveBeenCalled();
  });

  it("không che lỗi khi nguồn riêng được cấu hình nhưng thiếu tệp", async () => {
    vi.stubEnv("CATALOG_MANIFEST", "/some/local/manifest.json");
    dependencies.readImportedCatalog.mockResolvedValue(null);
    dependencies.loadCatalog.mockRejectedValue(Object.assign(new Error("missing source"), { code: "ENOENT" }));
    await expect(getActiveCatalog()).rejects.toThrow("missing source");
  });

  it("phục hồi tiêu đề bị ẩn từ nguồn cùng bài mà không đổi ảnh chụp đã lưu", async () => {
    const source = structuredClone(demoCatalog);
    const saved = structuredClone(demoCatalog);
    const hidden = saved.courses[0].chapters[0].lessons[0];
    hidden.title = "Bài 1";
    hidden.titleWithheld = true;
    source.courses[0].chapters[0].lessons[0].title = "Hồ sơ học viên mẫu";
    saved.courses[0].chapters[0].lessons[1].title = "Tên đã lưu của người học";
    const original = structuredClone(saved);
    dependencies.readImportedCatalog.mockResolvedValue(saved);
    dependencies.loadCatalog.mockResolvedValue(source);

    const active = await getActiveCatalog();

    expect(active.courses[0].chapters[0].lessons[0]).toMatchObject({
      id: hidden.id, title: "Hồ sơ học viên mẫu", titleWithheld: false,
    });
    expect(active.courses[0].chapters[0].lessons[1].title).toBe("Tên đã lưu của người học");
    expect(saved).toEqual(original);
    expect(dependencies.importCatalog).not.toHaveBeenCalled();
  });

  it("giữ nhãn cũ nếu nguồn có cùng mã bài nhưng khác chương", async () => {
    const source = structuredClone(demoCatalog);
    const saved = structuredClone(demoCatalog);
    const hidden = saved.courses[0].chapters[0].lessons[0];
    hidden.title = "Bài 1";
    hidden.titleWithheld = true;
    source.courses[0].chapters[0].id = "khac";
    dependencies.readImportedCatalog.mockResolvedValue(saved);
    dependencies.loadCatalog.mockResolvedValue(source);

    expect((await getActiveCatalog()).courses[0].chapters[0].lessons[0]).toMatchObject({
      title: "Bài 1", titleWithheld: true,
    });
  });

  it.each(["ENOENT", "EACCES", "ENOTDIR"])("vẫn mở được danh mục đã nhập khi nguồn không đọc được (%s)", async (code) => {
    const saved = structuredClone(demoCatalog);
    saved.courses[0].chapters[0].lessons[0].titleWithheld = true;
    dependencies.readImportedCatalog.mockResolvedValue(saved);
    dependencies.loadCatalog.mockRejectedValue(Object.assign(new Error("unavailable"), { code }));

    expect(await getActiveCatalog()).toEqual(saved);
  });

  it.each([new SyntaxError("JSON không hợp lệ"), new Error("Đường dẫn nguồn không hợp lệ")])(
    "vẫn mở ảnh chụp đã lưu khi nội dung nguồn bị lỗi: %s", async (error) => {
      const saved = structuredClone(demoCatalog);
      saved.courses[0].chapters[0].lessons[0].titleWithheld = true;
      dependencies.readImportedCatalog.mockResolvedValue(saved);
      dependencies.loadCatalog.mockRejectedValue(error);

      expect(await getActiveCatalog()).toEqual(saved);
      expect(dependencies.importCatalog).not.toHaveBeenCalled();
    },
  );
});
