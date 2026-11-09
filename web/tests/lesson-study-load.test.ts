import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoCatalog } from "@/lib/catalog/demo";

const mocks = vi.hoisted(() => ({
  getProgress: vi.fn(),
  getLessonMediaForLesson: vi.fn(),
  getActiveCatalog: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth/server", () => ({
  getAuth: async () => ({ api: { getSession: async () => ({ user: { id: "learner", name: "Người học" } }) } }),
}));
vi.mock("@/lib/db", () => ({ getDatabase: async () => ({}) }));
vi.mock("@/lib/catalog/active", () => ({ getActiveCatalog: mocks.getActiveCatalog }));
vi.mock("@/lib/progress/store", () => ({ getProgress: mocks.getProgress }));
vi.mock("@/lib/media/store", () => ({ getLessonMediaForLesson: mocks.getLessonMediaForLesson }));
vi.mock("@/lib/media/source", () => ({ validatedLessonPageUrl: () => null }));
vi.mock("@/lib/catalog/lesson-links", () => ({ getRelatedLessons: () => [] }));

import LessonStudyPage from "@/app/bai-hoc/[lessonId]/page";

const lessonId = demoCatalog.courses[0].chapters[0].lessons[1].id;

function render(id = lessonId) {
  return LessonStudyPage({ params: Promise.resolve({ lessonId: id }), searchParams: Promise.resolve({}) });
}

beforeEach(() => {
  vi.stubEnv("APP_MODE", "private");
  mocks.getActiveCatalog.mockResolvedValue(demoCatalog);
  mocks.getProgress.mockResolvedValue({ lessons: { [lessonId]: "in_progress" }, practices: {}, lastOpenedLessonId: lessonId });
  mocks.getLessonMediaForLesson.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe("trang học khi danh mục hoặc dữ liệu phụ thay đổi", () => {
  it("bài không còn trong danh mục trả 404 thay vì trang trắng", async () => {
    await expect(render("999999")).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });

  it("bài bị bỏ khỏi ảnh chụp danh mục mới cũng trả 404", async () => {
    const trimmed = structuredClone(demoCatalog);
    trimmed.courses[0].chapters[0].lessons = trimmed.courses[0].chapters[0].lessons.filter((lesson) => lesson.id !== lessonId);
    mocks.getActiveCatalog.mockResolvedValue(trimmed);
    await expect(render()).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });

  it("lỗi đọc tiến độ không chặn bài: vẫn dựng trang kèm thông báo", async () => {
    mocks.getProgress.mockRejectedValue(new Error("db down"));
    const page = await render() as unknown as { props: Record<string, unknown> };
    expect(page.props.initialState).toBe("not_updated");
    expect(page.props.initialVersion).toBeNull();
    expect(page.props.loadNotice).toMatch(/Chưa đọc được tiến độ/);
  });

  it("lỗi đọc liên kết phát vẫn mở bài và báo đúng phần lỗi", async () => {
    mocks.getLessonMediaForLesson.mockRejectedValue(new Error("db down"));
    const page = await render() as unknown as { props: Record<string, unknown> };
    expect(page.props.media).toBeNull();
    expect(page.props.loadNotice).toMatch(/Chưa đọc được liên kết phát/);
    expect(page.props.initialState).toBe("in_progress");
  });

  it("đọc được dữ liệu thì không có thông báo lỗi", async () => {
    const page = await render() as unknown as { props: Record<string, unknown> };
    expect(page.props.loadNotice).toBeUndefined();
    expect(page.props.initialState).toBe("in_progress");
  });

  it("bản cá nhân truyền thực hành tham chiếu bài, khớp cả khóa lẫn mã", async () => {
    const elite = structuredClone(demoCatalog.courses[0]);
    elite.slug = "elite";
    const catalog = { ...demoCatalog, courses: [elite] };
    mocks.getActiveCatalog.mockResolvedValue(catalog);
    const eliteLesson = elite.chapters[0].lessons[0];
    eliteLesson.id = "5860";

    const page = await LessonStudyPage({
      params: Promise.resolve({ lessonId: "5860" }),
      searchParams: Promise.resolve({}),
    }) as unknown as { props: { relatedPractices: { practice: { id: string }; link: { courseSlug: string; id: string } }[] } };

    const ids = page.props.relatedPractices.map((item) => item.practice.id);
    expect(ids).toContain("edit-cut");
    expect(page.props.relatedPractices.every((item) => item.link.courseSlug === "elite" && item.link.id === "5860")).toBe(true);
  });
});
