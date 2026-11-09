import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { initializeDatabase } from "@/lib/db/migrate";
import { user } from "@/lib/db/schema";
import { demoCatalog } from "@/lib/catalog/demo";
import { importCatalog } from "@/lib/catalog/import";
import { getLessonMedia } from "@/lib/media/store";
import { GET, POST } from "@/app/api/lesson-media/route";

const client = new PGlite();
const db = drizzle(client);
vi.mock("@/lib/db", () => ({ getDatabase: async () => db }));

let currentUser: string | null = "learner";
vi.mock("@/lib/auth/server", () => ({
  getAuth: async () => ({ api: { getSession: async () => (currentUser ? { user: { id: currentUser } } : null) } }),
}));

const lessonId = demoCatalog.courses[0].chapters[0].lessons[0].id;
const embed = "https://iframe.mediadelivery.net/embed/431650/00000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  vi.stubEnv("APP_MODE", "private");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  await initializeDatabase(db);
  await db.insert(user).values([
    { id: "learner", name: "Người học", email: "media-route@example.invalid" },
    { id: "second", name: "Người thứ hai", email: "media-route-2@example.invalid" },
  ]);
  await importCatalog(db, demoCatalog);
});
afterEach(() => { currentUser = "learner"; });
afterAll(async () => { vi.unstubAllEnvs(); await client.close(); });

function payload(entries: unknown[] = [{ lessonId, kind: "bunny", videoId: "00000000-0000-4000-8000-000000000001", embedUrl: embed }]) {
  return { version: 1, collectedAt: "2026-11-07T10:00:00.000Z", entries };
}

function post(body: unknown, options: { origin?: string | null; raw?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.origin !== null) headers.origin = options.origin ?? "http://localhost:3000";
  return new Request("http://localhost:3000/api/lesson-media", {
    method: "POST", headers, body: options.raw ?? JSON.stringify(body),
  });
}

describe("API nhập liên kết phát", () => {
  it("lưu liên kết hợp lệ của chính người đang đăng nhập", async () => {
    const response = await POST(post(payload()));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ imported: 1 });
    expect((await getLessonMedia(db, "learner")).map((entry) => entry.lessonId)).toEqual([lessonId]);
  });

  it("từ chối khi không có Origin tin cậy để chặn gửi chéo trang", async () => {
    expect((await POST(post(payload(), { origin: null }))).status).toBe(403);
    expect((await POST(post(payload(), { origin: "https://evil.invalid" }))).status).toBe(403);
  });

  it("từ chối khi chưa đăng nhập", async () => {
    currentUser = null;
    expect((await POST(post(payload()))).status).toBe(401);
  });

  it("từ chối JSON hỏng và dữ liệu sai cấu trúc", async () => {
    expect((await POST(post(null, { raw: "{khong-phai-json" }))).status).toBe(400);
    expect((await POST(post({ version: 2, entries: [] }))).status).toBe(400);
    expect((await POST(post({ version: 1, entries: "khong-phai-mang" }))).status).toBe(400);
  });

  it("từ chối tệp quá lớn trước khi đọc nội dung", async () => {
    const response = await POST(new Request("http://localhost:3000/api/lesson-media", {
      method: "POST",
      headers: { origin: "http://localhost:3000", "content-type": "application/json", "content-length": String(600 * 1024) },
      body: "{}",
    }));
    expect(response.status).toBe(413);
  });

  it("báo lỗi rõ khi không bài nào khớp danh mục hiện tại", async () => {
    const response = await POST(post(payload([{ lessonId: "999999", kind: "bunny", videoId: "00000000-0000-4000-8000-000000000001", embedUrl: embed }])));
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatch(/khớp/i);
  });

  it("chỉ trả liên kết của đúng tài khoản đang đăng nhập", async () => {
    const mine = await (await GET(new Request("http://localhost:3000/api/lesson-media"))).json();
    expect(mine.entries).toHaveLength(1);
    currentUser = "second";
    const theirs = await (await GET(new Request("http://localhost:3000/api/lesson-media"))).json();
    expect(theirs.entries).toEqual([]);
  });

  it("trả 404 ở chế độ demo để không ghi dữ liệu thật vào bản thử", async () => {
    vi.stubEnv("APP_MODE", "demo");
    try {
      expect((await POST(post(payload()))).status).toBe(404);
      expect((await GET(new Request("http://localhost:3000/api/lesson-media"))).status).toBe(404);
    } finally {
      vi.stubEnv("APP_MODE", "private");
    }
  });
});
