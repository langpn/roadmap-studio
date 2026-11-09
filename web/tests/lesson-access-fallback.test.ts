import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { LessonStudyView } from "@/app/bai-hoc/[lessonId]/lesson-study-view";
import { courseNeighbours, findLessonStudyContext } from "@/app/bai-hoc/[lessonId]/lesson-study";
import LessonMediaPlayer from "@/components/lesson-media-player";
import { GET } from "@/app/api/lesson-media/[lessonId]/stream/route";
import { initializeDatabase } from "@/lib/db/migrate";
import { user } from "@/lib/db/schema";
import { demoCatalog } from "@/lib/catalog/demo";
import { importCatalog } from "@/lib/catalog/import";
import { importLessonMedia } from "@/lib/media/store";
import { getProgress, setLessonProgress } from "@/lib/progress/store";
import { clearBunnyStreamCache } from "@/lib/media/bunny-stream";

const client = new PGlite();
const db = drizzle(client);
vi.mock("@/lib/db", () => ({ getDatabase: async () => db }));
vi.mock("@/lib/auth/server", () => ({
  getAuth: async () => ({ api: { getSession: async () => ({ user: { id: "learner" } }) } }),
}));

const VIDEO_ID = "00000000-0000-4000-8000-000000000001";
const EMBED_URL = `https://iframe.mediadelivery.net/embed/431650/${VIDEO_ID}`;
const lessonId = demoCatalog.courses[0].chapters[0].lessons[0].id;
const lesson = findLessonStudyContext(demoCatalog, lessonId)!.lesson;
const course = demoCatalog.courses[0];
const chapter = course.chapters[0];
const neighbours = courseNeighbours(course, lessonId);
const sourceUrl = `https://seankangmvp.com/courses/sample/chapters/1/lessons/${lessonId}`;

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function view(overrides: Partial<Parameters<typeof LessonStudyView>[0]> = {}) {
  return renderToStaticMarkup(createElement(LessonStudyView, {
    mode: "private" as const,
    homeHref: "/",
    lesson,
    course,
    chapter,
    position: neighbours.position,
    total: neighbours.total,
    previousLesson: neighbours.previous,
    nextLesson: neighbours.next,
    initialState: "not_updated" as const,
    initialVersion: null,
    media: null,
    sourceUrl,
    relatedLessons: [],
    ...overrides,
  }));
}

beforeAll(async () => {
  vi.stubEnv("APP_MODE", "private");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  await initializeDatabase(db);
  await db.insert(user).values({ id: "learner", name: "Người học", email: "fallback@example.invalid" });
  await importCatalog(db, demoCatalog);
});
afterEach(() => { clearBunnyStreamCache(); fetchMock.mockReset(); });
afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await client.close(); });

describe("trạng thái mở bài khi nguồn chưa hỗ trợ nhúng", () => {
  it("chưa có liên kết phát: giải thích và cho mở trang bài gốc, không có iframe", () => {
    const html = view();
    expect(html).toContain("Chưa có liên kết phát cho bài này");
    expect(html).toContain("Ứng dụng chưa nhúng được trình phát");
    expect(html).toContain(`href="${sourceUrl}"`);
    expect(html).toContain("Mở trang bài gốc");
    expect(html).not.toContain("<iframe");
  });

  it("có liên kết nhúng hợp lệ: mở trình phát và giữ liên kết dự phòng", () => {
    const player = renderToStaticMarkup(createElement(LessonMediaPlayer, {
      lessonId, title: lesson.title, kind: "youtube" as const,
      embedUrl: "https://www.youtube-nocookie.com/embed/KVmmLDVS_8o", sourceUrl,
    }));
    expect(player).toContain('src="https://www.youtube-nocookie.com/embed/KVmmLDVS_8o"');
    expect(player).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(player).toContain(`href="${sourceUrl}"`);
    expect(player).toContain("Mở trang bài gốc");
  });
});

describe("phiên nguồn hết hạn", () => {
  it("nguồn từ chối phiên thì trả lỗi chung và không đụng tiến độ trong ứng dụng", async () => {
    await importLessonMedia(db, "learner", {
      version: 1,
      collectedAt: "2026-11-07T10:00:00.000Z",
      entries: [{ lessonId, kind: "bunny", videoId: VIDEO_ID, embedUrl: EMBED_URL }],
    }, demoCatalog);
    await setLessonProgress(db, "learner", lessonId, "completed", null);
    const before = await getProgress(db, "learner");
    expect(before.lessons[lessonId]).toBe("completed");

    fetchMock.mockResolvedValue(new Response("<html>cần đăng nhập</html>", {
      status: 403,
      headers: { "content-type": "text/html" },
    }));
    const response = await GET(
      new Request(`http://localhost:3000/api/lesson-media/${lessonId}/stream`, {
        headers: { cookie: "session=fixture-not-real" },
      }),
      { params: Promise.resolve({ lessonId }) },
    );

    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("cần đăng nhập");
    // Chỉ hỏi trang nhúng chính thức, không gọi website nguồn, không chuyển tiếp phiên.
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe(EMBED_URL);
    expect(new URL(calls[0][0]).hostname).toBe("iframe.mediadelivery.net");
    expect(JSON.stringify(calls[0][1])).not.toMatch(/session=|Bearer/i);
    expect(await getProgress(db, "learner")).toEqual(before);
  });
});
