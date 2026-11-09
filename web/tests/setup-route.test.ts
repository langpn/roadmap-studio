import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { initializeDatabase } from "@/lib/db/migrate";
import { setupGuard, user } from "@/lib/db/schema";
import { createAuth } from "@/lib/auth/config";
import { POST } from "@/app/api/setup/route";

const client = new PGlite();
const db = drizzle(client);
const secret = "test-setup-secret-0123456789abcdef0123456789abcdef";
const auth = createAuth(db, { secret, baseURL: "http://localhost:3000" });
let currentAuth: typeof auth = auth;
vi.mock("@/lib/db", () => ({ getDatabase: async () => db }));
vi.mock("@/lib/auth/server", () => ({ getAuth: async () => currentAuth, getAuthSecret: async () => secret }));

const origin = "http://localhost:3000";
const valid = {
  name: "Chủ máy",
  email: "owner@example.invalid",
  password: "correct-horse-battery-staple",
};

beforeAll(async () => {
  vi.stubEnv("APP_MODE", "private");
  vi.stubEnv("BETTER_AUTH_URL", origin);
  await initializeDatabase(db);
});
beforeEach(async () => {
  currentAuth = auth;
  await db.execute(sql.raw('TRUNCATE TABLE "user", setup_guard CASCADE'));
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await client.close();
});

function post(
  body: unknown,
  options: { origin?: string | null; raw?: string; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { "content-type": "application/json", ...options.headers };
  if (options.origin !== null) headers.origin = options.origin ?? origin;
  return new Request(`${origin}/api/setup`, {
    method: "POST",
    headers,
    body: options.raw ?? JSON.stringify(body),
  });
}

describe("POST /api/setup", () => {
  it("tạo quản trị viên đầu tiên khi database còn trống", async () => {
    const response = await POST(post(valid));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });

    const rows = await db.select().from(user);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Chủ máy",
      email: "owner@example.invalid",
      role: "admin",
    });
    expect(await db.select().from(setupGuard)).toHaveLength(1);
  });

  it("chỉ một trong hai yêu cầu đồng thời tạo được quản trị viên", async () => {
    const responses = await Promise.all([
      POST(post({ ...valid, email: "first@example.invalid" })),
      POST(post({ ...valid, email: "second@example.invalid" })),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);

    const rows = await db.select().from(user);
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("admin");
    expect(["first@example.invalid", "second@example.invalid"]).toContain(rows[0].email);
    expect(await db.select().from(setupGuard)).toHaveLength(1);
  });

  it("từ chối tạo tài khoản sau khi đã thiết lập", async () => {
    expect((await POST(post(valid))).status).toBe(201);
    const response = await POST(post({ ...valid, email: "second@example.invalid" }));
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain(valid.password);
    expect(await db.select().from(user)).toHaveLength(1);
  });

  it("không nâng quyền tài khoản đã tồn tại", async () => {
    await db.insert(user).values({ id: "existing", name: "Người cũ", email: "existing@example.invalid" });
    expect((await POST(post(valid))).status).toBe(409);
    const [existing] = await db.select().from(user);
    expect(existing.role).toBe("user");
  });

  it("từ chối khi một tiến trình thiết lập khác đang giữ khóa", async () => {
    await db.insert(setupGuard).values({ id: "first-admin" });
    expect((await POST(post(valid))).status).toBe(409);
    expect(await db.select().from(user)).toHaveLength(0);
  });

  it.each([
    ["mật khẩu ngắn", { ...valid, password: "123456789" }],
    ["mật khẩu quá dài", { ...valid, password: "a".repeat(129) }],
    ["email sai", { ...valid, email: "khong-phai-email" }],
    ["tên chỉ có khoảng trắng", { ...valid, name: "   " }],
    ["thiếu mật khẩu", { name: valid.name, email: valid.email }],
  ])("từ chối đầu vào lỗi: %s", async (_label, body) => {
    const response = await POST(post(body));
    expect(response.status).toBe(400);
    expect(await db.select().from(user)).toHaveLength(0);
  });

  it("từ chối JSON hỏng, JSON không phải object và nội dung quá lớn", async () => {
    expect((await POST(post(null, { raw: "{khong-phai-json" }))).status).toBe(400);
    expect((await POST(post([]))).status).toBe(400);
    expect((await POST(post(null, { raw: JSON.stringify({ ...valid, padding: "x".repeat(9000) }) }))).status).toBe(400);
    expect(await db.select().from(user)).toHaveLength(0);
  });

  it("từ chối yêu cầu không có Origin tin cậy trước khi ghi dữ liệu", async () => {
    expect((await POST(post(valid, { origin: null }))).status).toBe(403);
    expect((await POST(post(valid, { origin: "https://evil.invalid" }))).status).toBe(403);
    expect(await db.select().from(user)).toHaveLength(0);
    expect(await db.select().from(setupGuard)).toHaveLength(0);
  });

  it("trả 404 ở chế độ trình diễn", async () => {
    vi.stubEnv("APP_MODE", "demo");
    try {
      expect((await POST(post(valid))).status).toBe(404);
      expect(await db.select().from(user)).toHaveLength(0);
    } finally {
      vi.stubEnv("APP_MODE", "private");
    }
  });

  it("không trả mật khẩu hay khóa nội bộ trong phản hồi lỗi", async () => {
    await db.insert(user).values({ id: "existing", name: "Người cũ", email: "existing@example.invalid" });
    const text = await (await POST(post(valid))).text();
    expect(text).not.toContain(valid.password);
    expect(text).not.toContain(secret);
    expect(text.length).toBeLessThan(200);
  });

  it("trả lỗi chung khi tạo tài khoản thất bại mà không lộ chi tiết nội bộ", async () => {
    currentAuth = {
      api: {
        signUpEmail: async () => {
          throw new Error(`hỏng nội bộ ${secret}`);
        },
      },
    } as unknown as typeof auth;
    const response = await POST(post(valid));
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain(secret);
    expect(text).not.toContain("hỏng nội bộ");
    expect(await db.select().from(user)).toHaveLength(0);
  });
});
