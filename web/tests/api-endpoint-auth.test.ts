import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { initializeDatabase } from "@/lib/db/migrate";
import { account, lessonProgress, practiceProgress, user } from "@/lib/db/schema";
import { createAuth } from "@/lib/auth/config";
import { GET as progressGet, POST as progressPost } from "@/app/api/progress/route";
import { GET as mediaGet, POST as mediaPost } from "@/app/api/lesson-media/route";
import { GET as streamGet } from "@/app/api/lesson-media/[lessonId]/stream/route";
import { POST as invitationsPost } from "@/app/api/invitations/route";
import { POST as registerPost } from "@/app/api/register/route";
import { POST as verifyEmailPost } from "@/app/api/verify-email/route";
import { POST as setupPost } from "@/app/api/setup/route";

const client = new PGlite();
const db = drizzle(client);
vi.mock("@/lib/db", () => ({ getDatabase: async () => db }));

const secret = "test-only-auth-secret-0123456789abcdef0123456789";
const origin = "http://localhost:3000";
const password = "mat-khau-thu-nghiem-chung";

// Endpoint tests below set this; the auth API tests use their own instance.
let currentUser: { user: { id: string } } | null = null;
vi.mock("@/lib/auth/server", () => ({
  getAuth: async () => ({ api: { getSession: async () => currentUser } }),
  getAuthSecret: async () => secret,
}));

const auth = createAuth(db, { secret, baseURL: origin });

beforeAll(async () => {
  vi.stubEnv("APP_MODE", "private");
  vi.stubEnv("BETTER_AUTH_URL", origin);
  await initializeDatabase(db);
  await db.insert(user).values([
    { id: "admin", name: "Quản trị viên", email: "endpoint-admin@example.invalid", role: "admin" },
    { id: "learner", name: "Người học", email: "endpoint-learner@example.invalid" },
  ]);
});
afterAll(async () => { vi.unstubAllEnvs(); await client.close(); });

function post(path: string, body: unknown, extra: Record<string, string> = {}) {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...extra },
    body: JSON.stringify(body),
  });
}

describe("mọi endpoint cần phiên đều từ chối truy cập không có phiên", () => {
  const protectedCalls: Array<[string, () => Promise<Response>]> = [
    ["GET /api/progress", () => progressGet(new Request(`${origin}/api/progress`))],
    ["POST /api/progress", () => progressPost(post("/api/progress", { kind: "opened", id: "42" }))],
    ["GET /api/lesson-media", () => mediaGet(new Request(`${origin}/api/lesson-media`))],
    ["POST /api/lesson-media", () => mediaPost(post("/api/lesson-media", { version: 1, entries: [] }))],
    ["GET /api/lesson-media/[lessonId]/stream", () => streamGet(
      new Request(`${origin}/api/lesson-media/42/stream`),
      { params: Promise.resolve({ lessonId: "42" }) },
    )],
    ["POST /api/invitations", () => invitationsPost(post("/api/invitations", {}))],
  ];

  it.each(protectedCalls)("%s trả 401 và không ghi tiến độ", async (_name, call) => {
    currentUser = null;
    const response = await call();
    expect(response.status).toBe(401);
    expect(await db.select().from(lessonProgress)).toHaveLength(0);
    expect(await db.select().from(practiceProgress)).toHaveLength(0);
  });

  it("chỉ quản trị viên tạo được lời mời qua route", async () => {
    currentUser = { user: { id: "learner" } };
    expect((await invitationsPost(post("/api/invitations", {}))).status).toBe(403);

    currentUser = { user: { id: "admin" } };
    const response = await invitationsPost(post("/api/invitations", {}));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).url).toContain("/dang-ky#invite=");
  });

  it("endpoint công khai vẫn chặn Origin lạ và lời mời/token sai", async () => {
    currentUser = null;
    const noOrigin = (path: string, body: unknown) =>
      new Request(`${origin}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

    expect((await registerPost(noOrigin("/api/register", {}))).status).toBe(403);
    expect((await verifyEmailPost(noOrigin("/api/verify-email", { token: "x" }))).status).toBe(403);
    expect((await setupPost(noOrigin("/api/setup", {}))).status).toBe(403);

    expect((await registerPost(post("/api/register", {
      name: "Người học", email: "new@example.invalid", password, invitation: "x".repeat(43),
    }))).status).toBe(400);
    expect((await verifyEmailPost(post("/api/verify-email", { token: "khong-hop-le" }))).status).toBe(400);
  });

  it("không trả cookie hay mật khẩu trong phản hồi từ chối", async () => {
    currentUser = null;
    const response = await progressGet(new Request(`${origin}/api/progress`));
    const text = await response.text();
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(text).not.toContain(password);
  });
});

describe("thuộc tính bảo mật của mật khẩu và cookie phiên", () => {
  it("băm có muối: cùng mật khẩu cho ra bản băm khác nhau và khác bản rõ", async () => {
    const headers = new Headers({ "x-roadmap-internal": secret });
    await auth.api.signUpEmail({ headers, body: { name: "Một", email: "hash-one@example.invalid", password } });
    await auth.api.signUpEmail({ headers, body: { name: "Hai", email: "hash-two@example.invalid", password } });

    const stored = await db.select({ password: account.password }).from(account);
    const hashes = stored.map((row) => row.password ?? "");
    expect(hashes).toHaveLength(2);
    for (const hash of hashes) {
      expect(hash.length).toBeGreaterThan(20);
      expect(hash).not.toBe(password);
      expect(hash).not.toContain(password);
    }
    expect(new Set(hashes).size).toBe(2);
  });

  it("từ chối cookie phiên bị sửa chữ ký", async () => {
    const login = await auth.api.signInEmail({ returnHeaders: true, body: { email: "hash-one@example.invalid", password } });
    const cookie = login.headers.getSetCookie().find((value) => value.includes("session_token="))!.split(";")[0];
    expect(await auth.api.getSession({ headers: new Headers({ cookie }) })).toBeTruthy();

    const [name, value] = cookie.split("=");
    const tampered = `${name}=${value.slice(0, -4)}AAAA`;
    expect(await auth.api.getSession({ headers: new Headers({ cookie: tampered }) })).toBeNull();
  });
});
