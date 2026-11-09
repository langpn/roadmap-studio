import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { initializeDatabase } from "@/lib/db/migrate";
import { user } from "@/lib/db/schema";
import { GET, POST } from "@/app/api/progress/route";

const client = new PGlite();
const db = drizzle(client);
vi.mock("@/lib/db", () => ({ getDatabase: async () => db }));
vi.mock("@/lib/auth/server", () => ({
  getAuth: async () => ({ api: { getSession: async ({ headers }: { headers: Headers }) => ({
    user: { id: headers.get("x-test-session") ?? "conflict-learner" },
  }) } }),
}));
vi.mock("@/lib/catalog/active", () => ({
  getActiveCatalog: async () => ({ courses: [{ chapters: [{ lessons: [{ id: "42" }, { id: "43" }] }] }] }),
}));

beforeAll(async () => {
  vi.stubEnv("APP_MODE", "private");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  await initializeDatabase(db);
  await db.insert(user).values([
    { id: "conflict-learner", name: "Người thử A", email: "conflict-a@example.invalid" },
    { id: "other-learner", name: "Người thử B", email: "conflict-b@example.invalid" },
  ]);
});
afterAll(async () => { vi.unstubAllEnvs(); await client.close(); });

function getRequest(account = "conflict-learner") {
  return new Request("http://localhost:3000/api/progress", { headers: { "x-test-session": account } });
}

function postRequest(
  state: string, expectedVersion: string | null | undefined, id = "edit-cut",
  kind: "practice" | "lesson" | "opened" = "practice", account = "conflict-learner", expectedAccount = account,
) {
  return new Request("http://localhost:3000/api/progress", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json", "x-roadmap-account": expectedAccount, "x-test-session": account },
    body: JSON.stringify({ kind, id, ...(kind === "opened" ? {} : { state, expectedVersion }) }),
  });
}

describe("xung đột tiến độ giữa hai tab", () => {
  it("không để tab cũ ghi đè bài thực hành vừa hoàn thành", async () => {
    const tabA = await (await GET(getRequest())).json();
    const tabB = await (await GET(getRequest())).json();
    expect(tabA.practices["edit-cut"]).toBeUndefined();
    expect(tabB.practices["edit-cut"]).toBeUndefined();

    expect((await POST(postRequest("completed", tabA.versions?.practices["edit-cut"] ?? null))).status).toBe(200);
    const staleWrite = await POST(postRequest("in_progress", tabB.versions?.practices["edit-cut"] ?? null));

    expect({ status: staleWrite.status, saved: (await (await GET(getRequest())).json()).practices["edit-cut"] })
      .toEqual({ status: 409, saved: "completed" });
    expect(await staleWrite.json()).toMatchObject({ code: "PROGRESS_CONFLICT", current: { state: "completed", version: expect.any(String) } });
  });

  it("từ chối an toàn tab cũ không gửi phiên bản và tab đã đổi tài khoản", async () => {
    const before = await (await GET(getRequest())).json();
    for (const kind of ["practice", "lesson"] as const) {
      const response = await POST(postRequest("in_progress", undefined, kind === "lesson" ? "42" : "edit-cut", kind));
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "CLIENT_OUTDATED", error: expect.stringContaining("tải lại") });
    }
    for (const kind of ["practice", "lesson", "opened"] as const) {
      const response = await POST(postRequest("in_progress", null, kind === "practice" ? "edit-cut" : "42", kind, "other-learner", "conflict-learner"));
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ code: "ACCOUNT_CHANGED" });
    }
    expect(await (await GET(getRequest())).json()).toEqual(before);
    const other = await (await GET(getRequest("other-learner"))).json();
    expect(other.practices).toEqual({});
    expect(other.lessons).toEqual({});
  });

  it("phân biệt chưa có bản ghi với not_updated đã lưu và phát hiện trạng thái đổi rồi trở lại", async () => {
    const id = "prepare-project";
    const first = await POST(postRequest("not_updated", null, id));
    expect(first.status).toBe(200);
    const firstVersion = (await first.json()).version;
    const absentView = await POST(postRequest("completed", null, id));
    expect(absentView.status).toBe(409);
    expect(await absentView.json()).toMatchObject({ current: { state: "not_updated", version: firstVersion } });

    const middle = await POST(postRequest("completed", firstVersion, id));
    expect(middle.status).toBe(200);
    const last = await POST(postRequest("not_updated", (await middle.json()).version, id));
    expect(last.status).toBe(200);
    const lastVersion = (await last.json()).version;
    expect(lastVersion).not.toBe(firstVersion);
    const aba = await POST(postRequest("in_progress", firstVersion, id));
    expect(aba.status).toBe(409);
    expect(await aba.json()).toMatchObject({ current: { state: "not_updated", version: lastVersion } });
  });

  it("chỉ chấp nhận một ghi đồng thời với cùng phiên bản, cả khi thêm và cập nhật", async () => {
    const id = "edit-frame";
    const first = await Promise.all([
      POST(postRequest("completed", null, id)),
      POST(postRequest("in_progress", null, id)),
    ]);
    expect(first.map((response) => response.status).sort()).toEqual([200, 409]);
    const initial = await (await GET(getRequest())).json();
    const version = initial.versions.practices[id];
    const second = await Promise.all([
      POST(postRequest("completed", version, id)),
      POST(postRequest("not_updated", version, id)),
    ]);
    expect(second.map((response) => response.status).sort()).toEqual([200, 409]);
    const success = second.find((response) => response.status === 200)!;
    const conflict = second.find((response) => response.status === 409)!;
    const saved = await (await GET(getRequest())).json();
    expect(saved.versions.practices[id]).toBe((await success.json()).version);
    expect(await conflict.json()).toMatchObject({ code: "PROGRESS_CONFLICT" });
  });

  it("giữ tiến độ hai tài khoản độc lập cho cùng một ID", async () => {
    const id = "clip-first";
    expect((await POST(postRequest("completed", null, id))).status).toBe(200);
    expect((await POST(postRequest("in_progress", null, id, "practice", "other-learner"))).status).toBe(200);
    expect((await (await GET(getRequest())).json()).practices[id]).toBe("completed");
    expect((await (await GET(getRequest("other-learner"))).json()).practices[id]).toBe("in_progress");
  });

  it("đọc và so sánh đầy đủ microsecond của bản ghi đã có", async () => {
    const id = "edit-subtitles";
    expect((await POST(postRequest("not_updated", null, id))).status).toBe(200);
    await db.execute(sql`update practice_progress set updated_at = timestamp '2020-01-02 03:04:05.123456' where user_id = 'conflict-learner' and practice_id = 'edit-subtitles'`);
    const before = await (await GET(getRequest())).json();
    expect(before.versions.practices[id]).toBe("2020-01-02 03:04:05.123456");
    const response = await POST(postRequest("completed", before.versions.practices[id], id));
    expect(response.status).toBe(200);
    expect((await (await GET(getRequest())).json()).practices[id]).toBe("completed");
  });

  it("ghi mở bài học cung cấp phiên bản và không cho tab cũ ghi đè", async () => {
    const id = "42";
    const opened = await POST(postRequest("", undefined, id, "opened"));
    expect(opened.status).toBe(200);
    const initial = (await opened.json()).lesson;
    expect(initial).toMatchObject({ state: "not_updated", version: expect.any(String) });
    const absentView = await POST(postRequest("in_progress", null, id, "lesson"));
    expect(absentView.status).toBe(409);
    expect(await absentView.json()).toMatchObject({ current: initial });
    const complete = await POST(postRequest("completed", initial.version, id, "lesson"));
    expect(complete.status).toBe(200);
    const newVersion = (await complete.json()).version;
    const stale = await POST(postRequest("in_progress", initial.version, id, "lesson"));
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ current: { state: "completed", version: newVersion } });
    const reopened = await POST(postRequest("", undefined, id, "opened"));
    expect((await reopened.json()).lesson).toEqual({ state: "completed", version: newVersion });
    const saved = await (await GET(getRequest())).json();
    expect(saved.lessons[id]).toBe("completed");
    expect(saved.lastOpenedLessonId).toBe(id);
  });

  it("chỉ chấp nhận một cập nhật bài học đồng thời", async () => {
    const id = "43";
    const opened = await POST(postRequest("", undefined, id, "opened"));
    const version = (await opened.json()).lesson.version;
    const results = await Promise.all([
      POST(postRequest("completed", version, id, "lesson")),
      POST(postRequest("in_progress", version, id, "lesson")),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
  });
});
