import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { initializeDatabase } from "@/lib/db/migrate";
import { user } from "@/lib/db/schema";
import { demoCatalog } from "@/lib/catalog/demo";
import { importCatalog } from "@/lib/catalog/import";
import { importLessonMedia } from "@/lib/media/store";
import type { LessonMediaEntry } from "@/lib/media/lesson-media-map";
import { GET } from "@/app/api/lesson-media/[lessonId]/stream/route";
import { clearBunnyStreamCache, resolveBunnyStream } from "@/lib/media/bunny-stream";

const client = new PGlite();
const db = drizzle(client);
vi.mock("@/lib/db", () => ({ getDatabase: async () => db }));

let currentUser: string | null = "learner";
vi.mock("@/lib/auth/server", () => ({
  getAuth: async () => ({ api: { getSession: async () => (currentUser ? { user: { id: currentUser } } : null) } }),
}));

const lessonId = demoCatalog.courses[0].chapters[0].lessons[0].id;
const otherLessonId = demoCatalog.courses[0].chapters[0].lessons[1].id;
const VIDEO_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_VIDEO_ID = "00000000-0000-4000-8000-000000000002";
const EMBED_URL = `https://iframe.mediadelivery.net/embed/431650/${VIDEO_ID}`;
const PULL_ZONE = "https://vz-demo-unit.b-cdn.net";
const PLAYLIST_URL = `${PULL_ZONE}/${VIDEO_ID}/playlist.m3u8`;

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function htmlPage(value: string): string {
  return `<html><script>window.__PLAYER__={"playlist":"${value}"};</script></html>`;
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
}

function request(id: string | number = lessonId): Request {
  return new Request(`http://localhost:3000/api/lesson-media/${id}/stream`);
}

function call(id: string | number = lessonId) {
  return GET(request(id), { params: Promise.resolve({ lessonId: String(id) }) });
}

const entries: LessonMediaEntry[] = [
  { lessonId, kind: "bunny", videoId: VIDEO_ID, embedUrl: EMBED_URL },
  { lessonId: otherLessonId, kind: "youtube", videoId: "abcdefghijk", embedUrl: "https://www.youtube-nocookie.com/embed/abcdefghijk" },
];

beforeAll(async () => {
  vi.stubEnv("APP_MODE", "private");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  await initializeDatabase(db);
  await db.insert(user).values([
    { id: "learner", name: "Người học", email: "stream-route@example.invalid" },
    { id: "second", name: "Người thứ hai", email: "stream-route-2@example.invalid" },
  ]);
  await importCatalog(db, demoCatalog);
  await importLessonMedia(db, "learner", {
    version: 1,
    collectedAt: "2026-11-07T10:00:00.000Z",
    entries,
  }, demoCatalog);
});

afterEach(() => {
  clearBunnyStreamCache();
  vi.restoreAllMocks();
  fetchMock.mockReset();
  currentUser = "learner";
});
afterAll(async () => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); await client.close(); });

describe("API phát trực tiếp bài học", () => {
  it("chỉ nhớ URL không có token trong thời gian ngắn và vẫn kiểm tra quyền", async () => {
    const now = vi.spyOn(Date, "now");
    const firstTime = Date.now();
    now.mockReturnValue(firstTime);
    fetchMock.mockImplementation(async () => htmlResponse(htmlPage(PLAYLIST_URL)));
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    currentUser = "second";
    expect((await call()).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    currentUser = "learner";
    now.mockReturnValue(firstTime + 11 * 60 * 1000);
    expect((await call()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("không lưu URL playlist có tham số có thể hết hạn", async () => {
    fetchMock.mockImplementation(async () => htmlResponse(htmlPage(`${PLAYLIST_URL}?token=temporary`)));
    expect((await call()).status).toBe(200);
    expect((await call()).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("không để cache bỏ qua giới hạn đọc HTML được yêu cầu", async () => {
    fetchMock.mockImplementation(async () => htmlResponse(htmlPage(PLAYLIST_URL)));
    expect((await call()).status).toBe(200);
    expect(await resolveBunnyStream({
      embedUrl: EMBED_URL,
      videoId: VIDEO_ID,
      refererOrigin: "http://localhost:3000",
      maxBytes: 8,
    })).toEqual({ ok: false, reason: "too-large" });
  });

  it("trả URL playlist khi phiên hợp lệ, kèm no-store", async () => {
    fetchMock.mockResolvedValue(htmlResponse(htmlPage(PLAYLIST_URL)));
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ url: PLAYLIST_URL });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(EMBED_URL);
    expect(init.redirect).toBe("error");
    expect(init.cache).toBe("no-store");
    expect((init.headers as Record<string, string>).referer).toBe("http://localhost:3000/");
  });

  it("không cho người khác đọc liên kết của chủ tài khoản", async () => {
    fetchMock.mockResolvedValue(htmlResponse(htmlPage(PLAYLIST_URL)));
    currentUser = "second";
    const response = await call();
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trả 401 khi chưa đăng nhập và 404 ở chế độ demo", async () => {
    currentUser = null;
    expect((await call()).status).toBe(401);
    currentUser = "learner";
    vi.stubEnv("APP_MODE", "demo");
    try {
      expect((await call()).status).toBe(404);
    } finally {
      vi.stubEnv("APP_MODE", "private");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("từ chối mã bài học không phải số hoặc không tồn tại", async () => {
    expect((await call("abc")).status).toBe(404);
    expect((await call("999999")).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("từ chối nguồn không phải bunny hoặc video id lệch với embed url", async () => {
    fetchMock.mockResolvedValue(htmlResponse(htmlPage(PLAYLIST_URL)));
    expect((await call(otherLessonId)).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();

    await importLessonMedia(db, "learner", {
      version: 1,
      collectedAt: "2026-11-07T10:00:00.000Z",
      entries: [{ lessonId, kind: "bunny", videoId: OTHER_VIDEO_ID, embedUrl: EMBED_URL }],
    }, demoCatalog);
    const mismatched = await call();
    expect(mismatched.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();

    // Trả lại dữ liệu đúng cho các kiểm thử sau.
    await importLessonMedia(db, "learner", {
      version: 1,
      collectedAt: "2026-11-07T10:00:00.000Z",
      entries,
    }, demoCatalog);
  });

  it("không bao giờ chuyển tiếp URL thô từ client", async () => {
    fetchMock.mockResolvedValue(htmlResponse(htmlPage(PLAYLIST_URL)));
    const withQuery = await GET(
      new Request(`http://localhost:3000/api/lesson-media/${lessonId}/stream?url=https://evil.invalid/playlist.m3u8`),
      { params: Promise.resolve({ lessonId }) },
    );
    expect(await withQuery.json()).toEqual({ url: PLAYLIST_URL });
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(EMBED_URL);
  });

  it("từ chối playlist ở host lạ hoặc sai mã video", async () => {
    for (const value of [
      `https://evil.invalid/${VIDEO_ID}/playlist.m3u8`,
      `${PULL_ZONE}/${OTHER_VIDEO_ID}/playlist.m3u8`,
      "https://evil.invalid/stream",
    ]) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValue(htmlResponse(htmlPage(value)));
      const response = await call();
      // Không có ứng viên hợp lệ: client quay lại iframe, không nhận URL lạ.
      expect(response.status, value).toBe(422);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.text()).not.toContain("evil.invalid");
    }
  });

  it("không lộ nội dung upstream hay mã video trong lỗi", async () => {
    const assertNoLeak = async (response: Response) => {
      const text = await response.text();
      expect(text).not.toContain(VIDEO_ID);
      expect(text).not.toContain("evil.invalid");
      expect(text).not.toContain("leak=demo");
      expect(text).not.toContain("<html>");
      expect(text).not.toContain("status:");
    };

    fetchMock.mockResolvedValue(htmlResponse(htmlPage(`https://evil.invalid/${VIDEO_ID}/playlist.m3u8?leak=demo`)));
    const unparsed = await call();
    expect(unparsed.status).toBe(422);
    await assertNoLeak(unparsed);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(`<html>${VIDEO_ID} leak=demo</html>`, {
      status: 403,
      headers: { "content-type": "text/html" },
    }));
    const upstreamError = await call();
    expect(upstreamError.status).toBe(502);
    await assertNoLeak(upstreamError);
  });

  it("không gửi cookie của người học sang iframe", async () => {
    fetchMock.mockResolvedValue(htmlResponse(htmlPage(PLAYLIST_URL)));
    const response = await GET(
      new Request(`http://localhost:3000/api/lesson-media/${lessonId}/stream`, {
        headers: { cookie: "session=demo-not-real", authorization: "Bearer demo" },
      }),
      { params: Promise.resolve({ lessonId }) },
    );
    expect(response.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.stringify(init)).not.toMatch(/session=|Bearer demo/i);
  });

  it("từ chối URL nhúng đã lưu nhưng sai dạng trước khi gọi mạng", async () => {
    for (const embedUrl of [
      `http://iframe.mediadelivery.net/embed/431650/${VIDEO_ID}`,
      `https://iframe.mediadelivery.net:8443/embed/431650/${VIDEO_ID}`,
      `https://iframe.mediadelivery.net.evil.invalid/embed/431650/${VIDEO_ID}`,
      `https://evil.invalid/embed/431650/${VIDEO_ID}`,
      `https://iframe.mediadelivery.net/embed/431650/${VIDEO_ID}?autoplay=1`,
    ]) {
      await importLessonMedia(db, "learner", {
        version: 1,
        collectedAt: "2026-11-07T10:00:00.000Z",
        entries: [{ lessonId, kind: "bunny", videoId: VIDEO_ID, embedUrl }],
      }, demoCatalog);
      fetchMock.mockReset();
      const response = await call();
      expect(response.status, embedUrl).toBe(422);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(fetchMock).not.toHaveBeenCalled();
    }
    await importLessonMedia(db, "learner", {
      version: 1,
      collectedAt: "2026-11-07T10:00:00.000Z",
      entries,
    }, demoCatalog);
  });

  it("trả lỗi cấu hình khi BETTER_AUTH_URL không hợp lệ", async () => {
    vi.stubEnv("BETTER_AUTH_URL", "javascript:alert(1)");
    try {
      fetchMock.mockReset();
      expect((await call()).status).toBe(500);
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    }
  });

  it("trả 422 khi iframe không có playlist và 502 khi fetch hỏng hoặc redirect", async () => {
    fetchMock.mockResolvedValue(htmlResponse("<html>không có liên kết</html>"));
    const empty = await call();
    expect(empty.status).toBe(422);
    expect(await empty.text()).not.toContain("không có liên kết");

    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new TypeError("redirect not allowed"));
    expect((await call()).status).toBe(502);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response("forbidden", { status: 403 }));
    expect((await call()).status).toBe(502);
  });

  it("không đọc body upstream vượt giới hạn dung lượng", async () => {
    fetchMock.mockResolvedValue(new Response(htmlPage(PLAYLIST_URL) + "x".repeat(600 * 1024), {
      status: 200,
      headers: { "content-type": "text/html", "content-length": String(600 * 1024) },
    }));
    const response = await call();
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain(PLAYLIST_URL);
  });

  it("luôn trả cache-control no-store kể cả khi lỗi", async () => {
    currentUser = null;
    expect((await call()).headers.get("cache-control")).toBe("no-store");
  });
});
