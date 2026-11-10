import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { initializeDatabase } from "@/lib/db/migrate";
import { account, catalogHistory, user } from "@/lib/db/schema";
import { createAuth } from "@/lib/auth/config";
import { bootstrapFirstAdmin } from "@/lib/auth/bootstrap";
import { clearTestMailbox, createMailer, readTestMailbox } from "@/lib/mail";
import { importCatalog, readImportedCatalog } from "@/lib/catalog/import";
import { getActiveCatalog } from "@/lib/catalog/active";
import { loadCatalog } from "@/lib/catalog/source";
import { normalizeCatalog, searchLessons } from "@/lib/catalog/normalize";
import { getRelatedLessons } from "@/lib/catalog/lesson-links";
import { eliteRelatedLinks } from "@/lib/catalog/elite-related-links";
import { getProgress } from "@/lib/progress/store";
import { hasPrivateCatalog } from "./private-catalog";

// Database test trong bộ nhớ, tách khỏi .data của máy cá nhân.
const client = new PGlite();
const db = drizzle(client);
const secret = "{{SECRET_1nt3gr4t}}";
const origin = "http://127.0.0.1:3000";
const mailer = createMailer({ NODE_ENV: "test", MAIL_TRANSPORT: "memory" });
const auth = createAuth(db, { secret, baseURL: origin, mailer });

vi.mock("@/lib/db", () => ({ getDatabase: async () => db }));
vi.mock("@/lib/auth/server", () => ({
  getAuth: async () => auth,
  getAuthSecret: async () => secret,
}));

import { POST as register } from "@/app/api/register/route";
import { POST as verifyEmail } from "@/app/api/verify-email/route";
import { GET as progressGetRoute, POST as progressPostRoute } from "@/app/api/progress/route";
import { POST as invitations } from "@/app/api/invitations/route";

const password = "{{SECRET_ha2tacc0}}";
const ownerPassword = "{{SECRET_0wn3rp4s}}";
let ownerId = "";

type SignedIn = { id: string; email: string; cookie: string };

beforeAll(async () => {
  vi.stubEnv("APP_MODE", "private");
  vi.stubEnv("BETTER_AUTH_URL", origin);
  await initializeDatabase(db);
  await bootstrapFirstAdmin(db, auth, secret, { name: "Chủ máy", email: "owner@example.invalid", password: ownerPassword });
  ownerId = (await db.select().from(user).where(eq(user.email, "owner@example.invalid")))[0].id;
  clearTestMailbox();
}, 60_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  await client.close();
});

const cookieOf = (headers: Headers) =>
  headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");

async function signIn(email: string, candidate = password): Promise<SignedIn> {
  const result = await auth.api.signInEmail({ returnHeaders: true, body: { email, password: candidate } });
  return { id: result.response.user.id, email, cookie: cookieOf(result.headers) };
}

async function invite(ownerCookie: string): Promise<string> {
  const response = await invitations(new Request(`${origin}/api/invitations`, {
    method: "POST",
    headers: { origin, cookie: ownerCookie, "content-type": "application/json" },
    body: "{}",
  }));
  expect(response.status).toBe(200);
  const { url } = await response.json() as { url: string };
  return new URL(url).hash.slice("#invite=".length);
}

async function verifyFromMailbox(email: string): Promise<void> {
  const mail = readTestMailbox().find((item) => item.to === email);
  const link = mail?.text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error(`Không có thư xác minh cho ${email}`);
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get("token") ?? "";
  const response = await verifyEmail(new Request(`${origin}/api/verify-email`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ token }),
  }));
  expect(response.status).toBe(200);
}

function progressGet(cookie: string) {
  return progressGetRoute(new Request(`${origin}/api/progress`, { headers: { cookie } }));
}

function progressPost(cookie: string, accountId: string, body: unknown) {
  return progressPostRoute(new Request(`${origin}/api/progress`, {
    method: "POST",
    headers: { origin, cookie, "content-type": "application/json", "x-roadmap-account": accountId },
    body: JSON.stringify(body),
  }));
}

describe("7.1 hai tài khoản thử trên database tách biệt", () => {
  const accounts: Record<"a" | "b", SignedIn> = {} as Record<"a" | "b", SignedIn>;

  it("tạo hai tài khoản bằng lời mời và xác minh email giả", async () => {
    const ownerCookie = (await signIn("owner@example.invalid", ownerPassword)).cookie;
    for (const [key, email] of [["a", "learner-a@example.invalid"], ["b", "learner-b@example.invalid"]] as const) {
      const token = await invite(ownerCookie);
      const response = await register(new Request(`${origin}/api/register`, {
        method: "POST",
        headers: { origin, "content-type": "application/json" },
        body: JSON.stringify({ name: `Người học ${key.toUpperCase()}`, email, password, invitation: token }),
      }));
      expect(response.status).toBe(200);
    }

    const created = await db.select({ email: user.email, emailVerified: user.emailVerified }).from(user);
    expect(created.map((row) => row.email)).toEqual([
      "owner@example.invalid", "learner-a@example.invalid", "learner-b@example.invalid",
    ]);
    // Mật khẩu chỉ lưu dạng băm, không có bản rõ.
    const hashes = (await db.select({ password: account.password }).from(account)).map((row) => row.password ?? "");
    expect(hashes).toHaveLength(3);
    for (const hash of hashes) expect(hash).not.toContain(password);

    for (const email of ["learner-a@example.invalid", "learner-b@example.invalid"]) await verifyFromMailbox(email);
    const verified = await db.select({ email: user.email, emailVerified: user.emailVerified }).from(user);
    for (const row of verified.filter((row) => row.email.startsWith("learner-"))) expect(row.emailVerified).toBe(true);

    const owner = await signIn("owner@example.invalid", ownerPassword);
    expect(owner.id).toBe(ownerId);
  });

  it("A đánh dấu, B độc lập; đăng xuất rồi đăng nhập lại vẫn giữ tiến độ", async () => {
    accounts.a = await signIn("learner-a@example.invalid");
    accounts.b = await signIn("learner-b@example.invalid");
    expect(accounts.a.id).not.toBe(accounts.b.id);

    expect(await (await progressGet(accounts.a.cookie)).json()).toMatchObject({ lessons: {}, practices: {} });
    expect((await progressPost(accounts.a.cookie, accounts.a.id, { kind: "lesson", id: "5860", state: "completed", expectedVersion: null })).status).toBe(200);
    expect((await progressPost(accounts.b.cookie, accounts.b.id, { kind: "lesson", id: "2207", state: "in_progress", expectedVersion: null })).status).toBe(200);

    const a = await (await progressGet(accounts.a.cookie)).json();
    const b = await (await progressGet(accounts.b.cookie)).json();
    expect(a.lessons).toEqual({ "5860": "completed" });
    expect(b.lessons).toEqual({ "2207": "in_progress" });

    // Đăng xuất: phiên cũ không còn dùng được, API từ chối.
    await auth.api.signOut({ headers: new Headers({ cookie: accounts.a.cookie }) });
    expect(await auth.api.getSession({ headers: new Headers({ cookie: accounts.a.cookie }) })).toBeNull();
    expect((await progressGet(accounts.a.cookie)).status).toBe(401);

    // Đăng nhập lại: đúng tiến độ của A, vẫn không thấy dữ liệu của B.
    const again = await signIn("learner-a@example.invalid");
    expect(again.id).toBe(accounts.a.id);
    accounts.a = again;
    const restored = await (await progressGet(again.cookie)).json();
    expect(restored.lessons).toEqual({ "5860": "completed" });
    expect(restored.lessons["2207"]).toBeUndefined();

    // Cố ghi với mã tài khoản khác bị từ chối, không đổi dữ liệu của B.
    const forged = await progressPost(again.cookie, accounts.b.id, { kind: "lesson", id: "5860", state: "in_progress", expectedVersion: null });
    expect(forged.status).toBe(409);
    expect((await (await progressGet(accounts.b.cookie)).json()).lessons).toEqual({ "2207": "in_progress" });
  });

  it.skipIf(!hasPrivateCatalog)("nhập lại chín danh mục giữ nguyên tiến độ hai tài khoản", async () => {
    const catalog = await loadCatalog();
    expect(catalog.courses).toHaveLength(9);
    expect(catalog.chapterCount).toBe(53);
    expect(catalog.lessonCount).toBe(1622);

    await importCatalog(db, catalog);
    const beforeA = await getProgress(db, accounts.a.id);
    const beforeB = await getProgress(db, accounts.b.id);
    await importCatalog(db, catalog);

    expect(await db.select().from(catalogHistory)).toHaveLength(1);
    expect(await getProgress(db, accounts.a.id)).toEqual(beforeA);
    expect(await getProgress(db, accounts.b.id)).toEqual(beforeB);
    expect((await readImportedCatalog(db))!.lessonCount).toBe(1622);
  }, 60_000);

  it("thêm khóa giả thứ mười và giữ tiến độ của cả hai tài khoản", async () => {
    const saved = (await readImportedCatalog(db))!;
    const fake = normalizeCatalog([{
      slug: "khoa-gia-muoi",
      course: { name: "Khóa giả thứ mười", url: "https://seankangmvp.com/courses/khoa-gia-muoi" },
      chapters: [{
        chapter_id: "1",
        title: "Chương giả",
        url: "https://seankangmvp.com/courses/khoa-gia-muoi/chapters/1/lessons",
        lessons: [{
          lesson_id: "999001",
          name: "Bài giả thứ mười",
          url: "https://seankangmvp.com/courses/khoa-gia-muoi/chapters/1/lessons/999001",
        }],
      }],
    }]).courses[0];

    const merged = {
      courses: [...saved.courses, fake],
      lessonCount: saved.lessonCount + fake.lessonCount,
      chapterCount: saved.chapterCount + fake.chapters.length,
    };
    const beforeA = await getProgress(db, accounts.a.id);
    const beforeB = await getProgress(db, accounts.b.id);
    await importCatalog(db, merged);

    expect((await readImportedCatalog(db))!.courses.map((course) => course.slug)).toContain("khoa-gia-muoi");
    expect((await getProgress(db, accounts.a.id)).lessons).toEqual(beforeA.lessons);
    expect((await getProgress(db, accounts.b.id)).lessons).toEqual(beforeB.lessons);

    // Khóa mới tìm được và ghi được tiến độ mà không sửa điều kiện gắn cứng số khóa.
    const active = await getActiveCatalog();
    expect(active.courses).toHaveLength(10);
    expect(searchLessons(active, "giả thứ mười").map((lesson) => lesson.id)).toEqual(["999001"]);
    expect((await progressPost(accounts.a.cookie, accounts.a.id, { kind: "lesson", id: "999001", state: "completed", expectedVersion: null })).status).toBe(200);
    expect((await (await progressGet(accounts.a.cookie)).json()).lessons["999001"]).toBe("completed");
    expect((await getProgress(db, accounts.b.id)).lessons["999001"]).toBeUndefined();
  }, 60_000);

  it("tab roadmap cũ không ghi đè trạng thái tab học vừa lưu", async () => {
    // Tab roadmap đọc trước khi tab học mở bài: chưa có bản ghi nên phiên bản là null.
    const roadmapTab = await (await progressGet(accounts.b.cookie)).json();
    expect(roadmapTab.versions.lessons["2160"]).toBeUndefined();

    // Tab học mở bài rồi đánh dấu hoàn thành.
    expect((await progressPost(accounts.b.cookie, accounts.b.id, { kind: "opened", id: "2160" })).status).toBe(200);
    const opened = await (await progressGet(accounts.b.cookie)).json();
    expect((await progressPost(accounts.b.cookie, accounts.b.id, {
      kind: "lesson", id: "2160", state: "completed", expectedVersion: opened.versions.lessons["2160"],
    })).status).toBe(200);

    // Tab roadmap cũ ghi bằng phiên bản cũ: bị từ chối, dữ liệu vẫn là trạng thái mới.
    const stale = await progressPost(accounts.b.cookie, accounts.b.id, {
      kind: "lesson", id: "2160", state: "in_progress", expectedVersion: null,
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ code: "PROGRESS_CONFLICT", current: { state: "completed" } });
    expect((await (await progressGet(accounts.b.cookie)).json()).lessons["2160"]).toBe("completed");
  });

  it("mở lại bài từ tab roadmap cũ sẽ đối chiếu trạng thái máy chủ của đúng bài đó", async () => {
    // Đây là đường đồng bộ duy nhất ở bản cá nhân: tab roadmap không nghe sự kiện
    // giữa các tab, nhưng khi mở một bài nó gọi "opened" và nhận lại state/version hiện tại.
    const roadmapTab = await (await progressGet(accounts.a.cookie)).json();
    expect(roadmapTab.versions.lessons["2170"]).toBeUndefined();

    expect((await progressPost(accounts.a.cookie, accounts.a.id, {
      kind: "lesson", id: "2170", state: "completed", expectedVersion: null,
    })).status).toBe(200);

    const opened = await progressPost(accounts.a.cookie, accounts.a.id, { kind: "opened", id: "2170" });
    expect(opened.status).toBe(200);
    const { lesson } = await opened.json() as { lesson: { state: string; version: string } };
    expect(lesson.state).toBe("completed");
    // Phiên bản đổi khi mở bài, nên tab roadmap phải dùng phiên bản mới này cho lần ghi kế tiếp.
    expect(lesson.version).not.toBe(roadmapTab.versions.lessons["2170"]);
    expect((await progressPost(accounts.a.cookie, accounts.a.id, {
      kind: "lesson", id: "2170", state: "in_progress", expectedVersion: lesson.version,
    })).status).toBe(200);
    expect((await (await progressGet(accounts.a.cookie)).json()).lessons["2170"]).toBe("in_progress");
  });

  it("tab roadmap mở trước khi có bản ghi cũng không tạo bản ghi đè trạng thái mới", async () => {
    // Bài chưa từng có tiến độ: tab roadmap giữ expectedVersion=null và không có state.
    const before = await (await progressGet(accounts.a.cookie)).json();
    expect(before.lessons["2161"]).toBeUndefined();

    // Tab học (mở ở thẻ mới) lưu hoàn thành trước.
    expect((await progressPost(accounts.a.cookie, accounts.a.id, {
      kind: "lesson", id: "2161", state: "completed", expectedVersion: null,
    })).status).toBe(200);

    // Tab roadmap cũ chọn "đang học" với expectedVersion null: chèn bị bỏ qua, không ghi đè.
    const staleInsert = await progressPost(accounts.a.cookie, accounts.a.id, {
      kind: "lesson", id: "2161", state: "in_progress", expectedVersion: null,
    });
    expect(staleInsert.status).toBe(409);
    expect(await staleInsert.json()).toMatchObject({ code: "PROGRESS_CONFLICT", current: { state: "completed" } });
    expect((await (await progressGet(accounts.a.cookie)).json()).lessons["2161"]).toBe("completed");
  });
});

describe("7.2 quyền truy cập, demo và nguồn thiếu khi database đã có dữ liệu", () => {
  it("chưa đăng nhập không đọc hay ghi được tiến độ", async () => {
    const anonymous = new Request(`${origin}/api/progress`);
    expect((await progressGetRoute(anonymous)).status).toBe(401);
    const write = await progressPostRoute(new Request(`${origin}/api/progress`, {
      method: "POST",
      headers: { origin, "content-type": "application/json", "x-roadmap-account": ownerId },
      body: JSON.stringify({ kind: "lesson", id: "5860", state: "completed", expectedVersion: null }),
    }));
    expect(write.status).toBe(401);
    expect((await getProgress(db, ownerId)).lessons).toEqual({});
  });

  it("demo đóng API và không chứa mã, tên hay URL của danh mục thật đang có trong database", async () => {
    vi.stubEnv("APP_MODE", "demo");
    try {
      const responses = await Promise.all([
        progressGetRoute(new Request(`${origin}/api/progress`)),
        progressPostRoute(new Request(`${origin}/api/progress`, { method: "POST" })),
        register(new Request(`${origin}/api/register`, { method: "POST" })),
        verifyEmail(new Request(`${origin}/api/verify-email`, { method: "POST" })),
        progressGetRoute(new Request(`${origin}/api/progress`)),
      ]);
      expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404, 404]);

      const { demoCatalog } = await import("@/lib/catalog/demo");
      const real = (await readImportedCatalog(db))!;
      const realIds = new Set(real.courses.flatMap((course) => course.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id))));
      const demoIds = demoCatalog.courses.flatMap((course) => course.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id)));
      expect(demoIds.length).toBeGreaterThan(0);
      for (const id of demoIds) expect(realIds.has(id)).toBe(false);
      const payload = JSON.stringify(demoCatalog);
      expect(payload).not.toContain("seankangmvp.com");
      for (const course of real.courses) expect(payload).not.toContain(course.slug);
    } finally {
      vi.stubEnv("APP_MODE", "private");
    }
  });

  it("bài không có liên kết trả danh sách rỗng, bài có liên kết trả đúng chiều", async () => {
    const active = await getActiveCatalog();
    const elite = active.courses.find((course) => course.slug === "elite")!;
    const eliteLessons = elite.chapters.flatMap((chapter) => chapter.lessons);
    const withLinks = eliteLessons.find((lesson) => getRelatedLessons(active, eliteRelatedLinks, "elite", lesson.id).length > 0);
    const withoutLinks = eliteLessons.find((lesson) => getRelatedLessons(active, eliteRelatedLinks, "elite", lesson.id).length === 0);

    expect(withLinks).toBeTruthy();
    expect(withoutLinks).toBeTruthy();
    expect(getRelatedLessons(active, eliteRelatedLinks, "elite", withoutLinks!.id)).toEqual([]);
    // Mọi đích liên kết phải tồn tại trong danh mục; không có cạnh hỏng.
    const ids = new Set(active.courses.flatMap((course) => course.chapters.flatMap((chapter) =>
      chapter.lessons.map((lesson) => `${course.slug}\0${lesson.id}`))));
    for (const link of eliteRelatedLinks) {
      expect(ids.has(`${link.from.courseSlug}\0${link.from.lessonId}`)).toBe(true);
      expect(ids.has(`${link.to.courseSlug}\0${link.to.lessonId}`)).toBe(true);
    }
  });
});
