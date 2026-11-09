import { expect, test, type APIRequestContext, type Page, type Response } from "@playwright/test";
import { PRACTICE_IDS } from "../../src/lib/progress/practice-ids";
import type { Progress } from "../../src/lib/progress/store";
import { loadCatalog } from "../../src/lib/catalog/source";

test.skip(process.env.E2E_PRIVATE !== "1", "Cần máy chủ và cơ sở dữ liệu thử riêng.");

const prepareProjectTitle = "Chọn footage và chuẩn bị project dựng";
const firstClipTitle = "Bài tập số 1: Dựng clip talking-head ngắn";
const secondClipTitle = "Bài tập số 2: Dựng clip có hình minh họa theo brief";

async function openPractices(page: Page) {
  await page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(
    (button) => button.textContent?.includes("Bài thực hành") && Object.keys(button).some((key) => key.startsWith("__reactProps")),
  ));
  await page.getByRole("button", { name: /Bài thực hành/ }).click();
  await expect(page.getByRole("heading", { name: "Các bài thực hành" })).toBeVisible();
}

function practiceCard(page: Page, title: string) {
  return page.getByRole("heading", { name: title, exact: true }).locator("..").locator("..");
}

async function readProgress(request: APIRequestContext): Promise<Progress> {
  const response = await request.get("/api/progress");
  expect(response.status()).toBe(200);
  return response.json() as Promise<Progress>;
}

function isProgressResponse(response: Response, kind: string, id: string, status: number): boolean {
  const request = response.request();
  if (!response.url().endsWith("/api/progress") || request.method() !== "POST" || response.status() !== status) return false;
  const data = request.postDataJSON();
  return data?.kind === kind && data?.id === id;
}

async function signOutAndIn(page: Page, email: string, password: string) {
  await page.getByRole("link", { name: "Cài đặt tài khoản" }).click();
  // Next renders HTML before its client event handlers are attached.
  await page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(
    (button) => button.textContent?.includes("Đăng xuất") && Object.keys(button).some((key) => key.startsWith("__reactProps")),
  ));
  await page.getByRole("button", { name: "Đăng xuất tài khoản" }).click();
  await expect(page).toHaveURL(/\/dang-nhap/);
  await page.getByLabel("Địa chỉ email").fill(email);
  await page.getByLabel("Mật khẩu").fill(password);
  const login = page.getByRole("button", { name: "Đăng nhập", exact: true });
  const [response] = await Promise.all([
    page.waitForResponse((item) => item.url().endsWith("/api/auth/sign-in/email") && item.request().method() === "POST"),
    login.click(),
  ]);
  // Both isolated browser contexts share the local IP and its sign-in rate limit.
  if (response.status() === 429) {
    const retryAfter = Number(response.headers()["x-retry-after"]);
    expect(retryAfter).toBeGreaterThan(0);
    await page.waitForTimeout((retryAfter + 1) * 1000);
    await login.click();
  } else {
    expect(response.status()).toBe(200);
  }
  await expect(page.getByRole("heading", { name: /Không gian học dựng video/ })).toBeVisible();
}

test("lời mời, tiến độ thực hành độc lập và thử lại khi lưu lỗi", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const ownerContext = await browser.newContext({ baseURL });
  const learnerContext = await browser.newContext({ baseURL });
  const visitorContext = await browser.newContext({ baseURL });
  const owner = await ownerContext.newPage();
  const learner = await learnerContext.newPage();
  const origin = new URL(baseURL!).origin;
  const ownerEmail = "owner@example.invalid";
  const ownerPassword = "{{SECRET_a3c4dqu6}}";
  const learnerEmail = `learner-${Date.now()}@example.invalid`;
  const learnerPassword = "{{SECRET_j4snk4mq}}";

  const unauthorized = await visitorContext.request.post("/api/progress", {
    headers: { origin },
    data: { kind: "lesson", id: "2207", state: "completed" },
  });
  expect(unauthorized.status()).toBe(401);
  expect((await visitorContext.request.get("/api/progress")).status()).toBe(401);

  await owner.goto("/dang-nhap");
  await owner.getByLabel("Địa chỉ email").fill(ownerEmail);
  await owner.getByLabel("Mật khẩu").fill(ownerPassword);
  await owner.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(owner.getByRole("heading", { name: /Không gian học dựng video/ })).toBeVisible();
  const ownerSession = await (await owner.request.get("/api/auth/get-session")).json();

  // Exercise the actual private graph while keeping navigation inside this app.
  const catalog = await loadCatalog();
  const titleOf = (slug: string, id: string) => catalog.courses.find((course) => course.slug === slug)!
    .chapters.flatMap((chapter) => chapter.lessons).find((lesson) => lesson.id === id)!.title;
  const anchorTitle = titleOf("elite", "5860");
  const targetTitle = titleOf("baby-resolve", "2207");
  await openPractices(owner);
  await owner.getByRole("button", { name: "Tạo bản cắt thô cho clip ngắn" }).click();
  const ownerBrief = owner.getByRole("dialog", { name: "Tạo bản cắt thô cho clip ngắn" });
  await Promise.all([
    owner.waitForResponse((response) => isProgressResponse(response, "opened", "5860", 200)),
    ownerBrief.getByRole("button", { name: "Elite — Cắt RAW" }).click(),
  ]);
  let ownerDetail = owner.getByRole("dialog");
  await Promise.all([
    owner.waitForResponse((response) => isProgressResponse(response, "lesson", "5860", 200)),
    ownerDetail.getByRole("button", { name: "Đang học" }).click(),
  ]);
  await Promise.all([
    owner.waitForResponse((response) => isProgressResponse(response, "opened", "2207", 200)),
    ownerDetail.getByRole("button", { name: targetTitle, exact: true }).click(),
  ]);
  ownerDetail = owner.getByRole("dialog");
  await expect(ownerDetail.getByRole("heading", { name: targetTitle })).toBeVisible();
  await expect(ownerDetail.getByRole("button", { name: anchorTitle, exact: true })).toBeVisible();
  await ownerDetail.getByRole("button", { name: `Quay lại: ${anchorTitle}` }).click();
  ownerDetail = owner.getByRole("dialog");
  await expect(ownerDetail.getByRole("button", { name: "Đang học" })).toHaveAttribute("aria-pressed", "true");
  await ownerDetail.getByRole("button", { name: "Đóng bảng chi tiết bài học" }).click();
  await expect(ownerBrief).toBeVisible();
  await ownerBrief.getByRole("button", { name: /Đóng bảng hướng dẫn bài thực hành/ }).click();
  expect((await readProgress(owner.request)).lessons["5860"]).toBe("in_progress");

  const trackingTitle = titleOf("elite", "2160");
  const proTrackingTitle = titleOf("elite-pro", "3304");
  await owner.getByLabel("Tìm kiếm bài học toàn hệ thống").fill(trackingTitle);
  await Promise.all([
    owner.waitForResponse((response) => isProgressResponse(response, "opened", "2160", 200)),
    owner.getByRole("region", { name: "Kết quả tìm kiếm bài học" }).getByText(trackingTitle, { exact: true }).click(),
  ]);
  ownerDetail = owner.getByRole("dialog");
  await Promise.all([
    owner.waitForResponse((response) => isProgressResponse(response, "opened", "3304", 200)),
    ownerDetail.getByRole("button", { name: proTrackingTitle, exact: true }).click(),
  ]);
  ownerDetail = owner.getByRole("dialog");
  await expect(ownerDetail.getByRole("heading", { name: proTrackingTitle })).toBeVisible();
  await expect(ownerDetail.getByRole("button", { name: trackingTitle, exact: true })).toBeVisible();
  await ownerDetail.getByRole("button", { name: "Đóng bảng chi tiết bài học" }).click();
  await owner.getByRole("button", { name: "Xóa tìm kiếm" }).click();

  const ownerBefore = await readProgress(owner.request);
  await owner.getByRole("link", { name: "Cài đặt tài khoản" }).click();
  // Wait for the settings page to hydrate before clicking its client-side action.
  await owner.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(
    (button) => button.textContent?.includes("Tạo liên kết mời mới") && Object.keys(button).some((key) => key.startsWith("__reactProps")),
  ));
  await owner.getByRole("button", { name: "Tạo liên kết mời mới" }).click();
  const inviteInput = owner.getByLabel("Địa chỉ liên kết mời");
  await expect(inviteInput).toHaveValue(/\/dang-ky#invite=/);
  const inviteUrl = await inviteInput.inputValue();

  await learner.goto(inviteUrl);
  await expect(learner).toHaveURL(/\/dang-ky$/);
  await learner.getByLabel("Họ và tên").fill("Người thử học");
  await learner.getByLabel("Địa chỉ email").fill(learnerEmail);
  await learner.getByLabel("Mật khẩu", { exact: true }).fill(learnerPassword);
  await learner.getByLabel("Xác nhận mật khẩu").fill(learnerPassword);
  await learner.getByRole("button", { name: /Hoàn tất đăng ký/ }).click();
  await expect(learner.getByRole("heading", { name: /Không gian học dựng video/ })).toBeVisible();
  const learnerSession = await (await learner.request.get("/api/auth/get-session")).json();
  expect(learnerSession.user.id).not.toBe(ownerSession.user.id);
  expect((await readProgress(learner.request)).practices).toEqual({});
  await expect(learner.getByRole("button", { name: new RegExp(`Bài thực hành\\s*0/${PRACTICE_IDS.length}`) })).toBeVisible();
  await openPractices(learner);
  await expect(practiceCard(learner, prepareProjectTitle)).toBeVisible();

  // Simulate records saved under the two original practice IDs before the roadmap changed.
  const legacyPractices = { "clip-first": "completed", "clip-brief": "in_progress" } as const;
  for (const [id, state] of Object.entries(legacyPractices)) {
    const response = await learner.request.post("/api/progress", {
      headers: { origin, "x-roadmap-account": learnerSession.user.id },
      data: { kind: "practice", id, state, expectedVersion: (await readProgress(learner.request)).versions?.practices[id] ?? null },
    });
    expect(response.status()).toBe(200);
  }
  await learner.reload();
  await openPractices(learner);
  await learner.waitForFunction((title) => Array.from(document.querySelectorAll("button")).some(
    (button) => button.getAttribute("aria-label")?.includes(title) && Object.keys(button).some((key) => key.startsWith("__reactProps")),
  ), prepareProjectTitle);
  await expect(learner.getByRole("button", { name: new RegExp(`Bài thực hành\\s*1/${PRACTICE_IDS.length}`) })).toBeVisible();
  await expect(practiceCard(learner, firstClipTitle)).toContainText("Đã hoàn thành");
  await expect(practiceCard(learner, secondClipTitle)).toContainText("Đang làm");

  let failPracticeOnce = true;
  await learner.route("**/api/progress", async (route) => {
    const request = route.request();
    const data = request.method() === "POST" ? request.postDataJSON() : null;
    if (data?.kind === "practice" && data.id === "prepare-project" && failPracticeOnce) {
      failPracticeOnce = false;
      await route.fulfill({ status: 500, json: { error: "Lỗi giả lập" } });
    } else {
      await route.continue();
    }
  });
  await learner.getByRole("button", { name: prepareProjectTitle }).click();
  const brief = learner.getByRole("dialog", { name: prepareProjectTitle });
  await expect(brief.getByRole("button", { name: "Chưa làm" })).toHaveAttribute("aria-pressed", "true");
  await Promise.all([
    learner.waitForResponse((response) => isProgressResponse(response, "practice", "prepare-project", 500)),
    brief.getByRole("button", { name: "Đã hoàn thành" }).click(),
  ]);
  const error = learner.getByRole("alert", { name: "Thông báo lỗi lưu tiến độ" });
  await expect(error).toBeVisible();
  await expect(brief.getByRole("button", { name: "Chưa làm" })).toHaveAttribute("aria-pressed", "true");
  await expect(brief.getByRole("button", { name: "Đã hoàn thành" })).toHaveAttribute("aria-pressed", "false");
  expect((await readProgress(learner.request)).practices).toEqual(legacyPractices);

  await Promise.all([
    learner.waitForResponse((response) => isProgressResponse(response, "practice", "prepare-project", 200)),
    error.getByRole("button", { name: "Thử lại thao tác vừa thất bại" }).click(),
  ]);
  await expect(error).toHaveCount(0);
  await expect(brief.getByRole("button", { name: "Đã hoàn thành" })).toHaveAttribute("aria-pressed", "true");
  const savedPractices = { ...legacyPractices, "prepare-project": "completed" };
  expect((await readProgress(learner.request)).practices).toEqual(savedPractices);

  // Open the related lesson inside this application, without opening its source website.
  await Promise.all([
    learner.waitForResponse((response) => isProgressResponse(response, "opened", "2207", 200)),
    brief.getByRole("button", { name: "Baby Resolve — Edit Page" }).click(),
  ]);
  const detail = learner.getByRole("dialog").filter({
    has: learner.getByRole("button", { name: "Đóng bảng chi tiết bài học" }),
  });
  await expect(detail.getByRole("heading", { level: 2 })).toBeVisible();
  const afterOpeningLesson = await readProgress(learner.request);
  expect(afterOpeningLesson.practices).toEqual(savedPractices);
  expect(afterOpeningLesson.lastOpenedLessonId).toBe("2207");
  await Promise.all([
    learner.waitForResponse((response) => isProgressResponse(response, "lesson", "2207", 200)),
    detail.getByRole("button", { name: "Đã hoàn thành" }).click(),
  ]);
  await expect(detail.getByRole("button", { name: "Đã hoàn thành" })).toHaveAttribute("aria-pressed", "true");
  await detail.getByRole("button", { name: "Đóng bảng chi tiết bài học" }).click();
  await expect(brief.getByRole("button", { name: "Đã hoàn thành" })).toHaveAttribute("aria-pressed", "true");
  await brief.getByRole("button", { name: /Đóng bảng hướng dẫn bài thực hành/ }).click();
  await learner.reload();
  await expect(learner.getByRole("button", { name: new RegExp(`Bài thực hành\\s*2/${PRACTICE_IDS.length}`) })).toBeVisible();
  await openPractices(learner);
  await expect(practiceCard(learner, prepareProjectTitle)).toContainText("Đã hoàn thành");
  expect((await readProgress(learner.request)).lessons["2207"]).toBe("completed");

  // Choose a value different from the owner's current state so an illicit change is observable.
  const forgedState = ownerBefore.practices["edit-cut"] === "completed" ? "in_progress" : "completed";
  const attemptedOverride = await learner.request.post("/api/progress", {
    headers: { origin, "x-roadmap-account": learnerSession.user.id },
    data: { kind: "practice", id: "edit-cut", state: forgedState, expectedVersion: (await readProgress(learner.request)).versions?.practices["edit-cut"] ?? null, userId: ownerSession.user.id },
  });
  expect(attemptedOverride.status()).toBe(200);
  expect((await readProgress(learner.request)).practices).toEqual({ ...savedPractices, "edit-cut": forgedState });
  expect(await readProgress(owner.request)).toEqual(ownerBefore);

  const token = new URL(inviteUrl).hash.slice("#invite=".length);
  const reuse = await owner.request.post("/api/register", {
    headers: { origin },
    data: { name: "Khác", email: "other@example.invalid", password: learnerPassword, invitation: token },
  });
  expect(reuse.status()).toBe(400);

  await owner.goto("/");
  await signOutAndIn(owner, ownerEmail, ownerPassword);
  expect(await readProgress(owner.request)).toEqual(ownerBefore);
  await openPractices(owner);
  await expect(practiceCard(owner, "Tạo bản cắt thô cho clip ngắn")).toContainText(
    ownerBefore.practices["edit-cut"] === "completed" ? "Đã hoàn thành"
      : ownerBefore.practices["edit-cut"] === "in_progress" ? "Đang làm" : "Chưa làm",
  );

  await signOutAndIn(learner, learnerEmail, learnerPassword);
  const learnerAfterLogin = await readProgress(learner.request);
  expect(learnerAfterLogin.practices).toEqual({ ...savedPractices, "edit-cut": forgedState });
  expect(learnerAfterLogin.lessons["2207"]).toBe("completed");
  expect(learnerAfterLogin.lastOpenedLessonId).toBe("2207");
  await openPractices(learner);
  await expect(practiceCard(learner, prepareProjectTitle)).toContainText("Đã hoàn thành");
  await expect(practiceCard(learner, firstClipTitle)).toContainText("Đã hoàn thành");
  await expect(practiceCard(learner, secondClipTitle)).toContainText("Đang làm");
  await expect(practiceCard(learner, "Tạo bản cắt thô cho clip ngắn")).toContainText(
    forgedState === "completed" ? "Đã hoàn thành" : "Đang làm",
  );
  const completedCount = forgedState === "completed" ? 3 : 2;
  await expect(learner.getByRole("button", { name: new RegExp(`Bài thực hành\\s*${completedCount}/${PRACTICE_IDS.length}`) })).toBeVisible();

  // A stale tab belonging to the owner must not write into a newly signed-in account.
  const staleOwner = await ownerContext.newPage();
  await staleOwner.goto("/");
  await openPractices(staleOwner);
  await expect(staleOwner.getByRole("button", { name: prepareProjectTitle })).toBeVisible();
  await signOutAndIn(owner, learnerEmail, learnerPassword);
  await staleOwner.getByRole("button", { name: prepareProjectTitle }).click();
  const staleBrief = staleOwner.getByRole("dialog", { name: prepareProjectTitle });
  const ownerOldState = ownerBefore.practices["prepare-project"] ?? "not_updated";
  const attemptedState = ownerOldState === "completed" ? "Chưa làm" : "Đã hoàn thành";
  await Promise.all([
    staleOwner.waitForResponse((response) => isProgressResponse(response, "practice", "prepare-project", 409)),
    staleBrief.getByRole("button", { name: attemptedState }).click(),
  ]);
  await expect(staleOwner.getByRole("alert", { name: "Thông báo lỗi lưu tiến độ" })).toContainText("Tài khoản đăng nhập đã thay đổi");
  await expect(staleBrief.getByRole("button", { name: ownerOldState === "completed" ? "Đã hoàn thành" : ownerOldState === "in_progress" ? "Đang thực hiện" : "Chưa làm" })).toHaveAttribute("aria-pressed", "true");
  expect(await readProgress(learner.request)).toEqual(learnerAfterLogin);
  await signOutAndIn(owner, ownerEmail, ownerPassword);
  expect(await readProgress(owner.request)).toEqual(ownerBefore);

  // New roadmap IDs must persist without overwriting either account's older progress.
  const originalIds = new Set([
    "prepare-project", "edit-cut", "edit-frame-audio", "edit-subtitles", "clip-first", "clip-brief",
    "portfolio-case", "profile-draft", "find-job", "proposal-draft", "shortform-cut", "shortform-hook",
    "advanced-level-two", "longform-cut", "longform-assembly", "advanced-longform", "motion-plan",
    "motion-first-scene", "advanced-motion",
  ]);
  const newIds = PRACTICE_IDS.filter((id) => !originalIds.has(id));
  expect(newIds.length).toBeGreaterThan(0);
  for (const id of newIds) {
    const response = await learner.request.post("/api/progress", {
      headers: { origin, "x-roadmap-account": learnerSession.user.id },
      data: { kind: "practice", id, state: "in_progress", expectedVersion: (await readProgress(learner.request)).versions?.practices[id] ?? null },
    });
    expect(response.status()).toBe(200);
  }
  expect((await readProgress(learner.request)).practices).toEqual({
    ...learnerAfterLogin.practices,
    ...Object.fromEntries(newIds.map((id) => [id, "in_progress"])),
  });
  expect(await readProgress(owner.request)).toEqual(ownerBefore);
  expect(newIds).toContain("edit-frame");
  await learner.reload();
  await openPractices(learner);
  await expect(practiceCard(learner, "Đặt nội dung chính trong khung dọc")).toContainText("Đang làm");

  // Two tabs of this same test account cannot silently replace each other's progress.
  const otherTab = await learnerContext.newPage();
  await otherTab.goto("/");
  await openPractices(otherTab);
  await Promise.all([
    learner.getByRole("button", { name: prepareProjectTitle }).click(),
    otherTab.getByRole("button", { name: prepareProjectTitle }).click(),
  ]);
  const currentBrief = learner.getByRole("dialog", { name: prepareProjectTitle });
  const staleBriefSameAccount = otherTab.getByRole("dialog", { name: prepareProjectTitle });
  await Promise.all([
    learner.waitForResponse((response) => isProgressResponse(response, "practice", "prepare-project", 200)),
    currentBrief.getByRole("button", { name: "Chưa làm" }).click(),
  ]);
  await Promise.all([
    otherTab.waitForResponse((response) => isProgressResponse(response, "practice", "prepare-project", 409)),
    staleBriefSameAccount.getByRole("button", { name: "Đang thực hiện" }).click(),
  ]);
  await expect(otherTab.getByRole("alert", { name: "Thông báo lỗi lưu tiến độ" })).toContainText("Tiến độ đã thay đổi ở nơi khác");
  await expect(staleBriefSameAccount.getByRole("button", { name: "Chưa làm" })).toHaveAttribute("aria-pressed", "true");
  expect((await readProgress(learner.request)).practices["prepare-project"]).toBe("not_updated");
  expect(await readProgress(owner.request)).toEqual(ownerBefore);

  await Promise.all([ownerContext.close(), learnerContext.close(), visitorContext.close()]);
});
