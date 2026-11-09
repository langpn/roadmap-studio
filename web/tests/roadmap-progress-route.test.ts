import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { initializeDatabase } from "@/lib/db/migrate";
import { user } from "@/lib/db/schema";
import { getProgress } from "@/lib/progress/store";
import { POST } from "@/app/api/progress/route";

const client = new PGlite();
const db = drizzle(client);
vi.mock("@/lib/db", () => ({ getDatabase: async () => db }));
vi.mock("@/lib/auth/server", () => ({
  getAuth: async () => ({ api: { getSession: async () => ({ user: { id: "learner" } }) } }),
}));

beforeAll(async () => {
  vi.stubEnv("APP_MODE", "private");
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
  await initializeDatabase(db);
  await db.insert(user).values({ id: "learner", name: "Người thử", email: "learner@example.invalid" });
});
afterAll(async () => { vi.unstubAllEnvs(); await client.close(); });

async function request(id: string, expectedAccount: string | null = "learner") {
  const expectedVersion = (await getProgress(db, "learner")).versions!.practices[id] ?? null;
  return new Request("http://localhost:3000/api/progress", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json", ...(expectedAccount ? { "x-roadmap-account": expectedAccount } : {}) },
    body: JSON.stringify({ kind: "practice", id, state: "completed", expectedVersion }),
  });
}

describe("lưu tiến độ các nhiệm vụ roadmap", () => {
  it("lưu riêng các bước dự án mới mà không mất tiến độ những mốc cũ", async () => {
    const oldIds = ["clip-first", "clip-brief", "advanced-level-two", "advanced-longform", "advanced-motion"];
    const newIds = ["shortform-cut", "shortform-hook", "longform-cut", "longform-assembly", "motion-plan", "motion-first-scene"];
    for (const id of [...oldIds, ...newIds]) {
      expect((await POST(await request(id))).status).toBe(200);
    }
    const progress = await getProgress(db, "learner");
    for (const id of [...oldIds, ...newIds]) {
      expect(progress.practices[id]).toBe("completed");
    }
  });

  it("lưu một nhiệm vụ mới và giữ tiến độ bài tập cũ", async () => {
    expect((await POST(await request("clip-first"))).status).toBe(200);
    expect((await POST(await request("edit-cut"))).status).toBe(200);
    const progress = await getProgress(db, "learner");
    expect(progress.practices).toMatchObject({ "clip-first": "completed", "edit-cut": "completed" });
    expect(progress.lessons).toEqual({});
  });

  it("từ chối ID nhiệm vụ không có trong roadmap", async () => {
    expect((await POST(await request("not-a-roadmap-task"))).status).toBe(400);
    expect((await getProgress(db, "learner")).practices["not-a-roadmap-task"]).toBeUndefined();
  });

  it("từ chối ghi khi tab thuộc tài khoản khác hoặc không xác định được tài khoản", async () => {
    expect((await POST(await request("edit-cut", "other-account"))).status).toBe(409);
    expect((await POST(await request("prepare-project", null))).status).toBe(409);
    for (const kind of ["lesson", "opened"]) {
      const response = await POST(new Request("http://localhost:3000/api/progress", {
        method: "POST",
        headers: { origin: "http://localhost:3000", "content-type": "application/json", "x-roadmap-account": "other-account" },
        body: JSON.stringify({ kind, id: "2207", ...(kind === "lesson" ? { state: "completed" } : {}) }),
      }));
      expect(response.status).toBe(409);
    }
    expect((await getProgress(db, "learner")).practices["prepare-project"]).toBeUndefined();
    expect((await getProgress(db, "learner")).lessons).toEqual({});
    expect((await getProgress(db, "learner")).lastOpenedLessonId).toBeNull();
  });
});
