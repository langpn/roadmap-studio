import { afterEach, describe, expect, it, vi } from "vitest";
import LessonStudyPage from "@/app/bai-hoc/[lessonId]/page";

afterEach(() => vi.unstubAllEnvs());

function render(lessonId: string, search: Record<string, string> = {}) {
  return LessonStudyPage({
    params: Promise.resolve({ lessonId }),
    searchParams: Promise.resolve(search),
  });
}

describe("định tuyến trang học bài", () => {
  it("máy chủ demo mở bài mẫu, giữ ?demo=1 cho bài trước và bài tiếp", async () => {
    vi.stubEnv("APP_MODE", "demo");
    const page = await render("90000") as unknown as { props: Record<string, unknown> };
    expect(page.props.mode).toBe("demo");
    expect(page.props.homeHref).toBe("/demo");
    expect(page.props.studySuffix).toBe("?demo=1");
    expect((page.props.nextLesson as { id: string }).id).toBe("90001");
  });

  it("máy chủ demo không mở mã bài thật", async () => {
    vi.stubEnv("APP_MODE", "demo");
    await expect(render("5860")).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });

  it("mã bài mẫu vẫn mở ở bản thử nghiệm dù có hoặc không có ?demo=1", async () => {
    vi.stubEnv("APP_MODE", "demo");
    const withQuery = await render("90003", { demo: "1" }) as unknown as { props: Record<string, unknown> };
    expect(withQuery.props.mode).toBe("demo");
  });

  it("mã không phải số bị coi là không tồn tại", async () => {
    vi.stubEnv("APP_MODE", "demo");
    await expect(render("abc")).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });

  it("yêu cầu bài demo không chuyển sang danh mục cá nhân khi mã không có trong demo", async () => {
    vi.stubEnv("APP_MODE", "private");
    await expect(render("5860", { demo: "1" })).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });
});
