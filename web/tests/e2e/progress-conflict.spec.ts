import { expect, test, type BrowserContext, type Page, type Response } from "@playwright/test";

test.skip(process.env.E2E_CONFLICT !== "1", "Chỉ chạy với máy chủ và PGlite thử riêng.");

const origin = "http://127.0.0.1:3237";
const fakePassword = "isolated-only-fake-password";
const prepareTitle = "Chọn footage và chuẩn bị project dựng";
const cutTitle = "Tạo bản cắt thô cho clip ngắn";

async function signIn(context: BrowserContext, email: string) {
  const response = await context.request.post(`${origin}/api/auth/sign-in/email`, {
    headers: { origin }, data: { email, password: fakePassword },
  });
  expect(response.status()).toBe(200);
}

function progressResponse(response: Response, kind: string, id: string, status: number) {
  const request = response.request();
  if (!response.url().endsWith("/api/progress") || request.method() !== "POST" || response.status() !== status) return false;
  const body = request.postDataJSON();
  return body?.kind === kind && body?.id === id;
}

async function openLesson(page: Page) {
  await page.getByLabel("Tìm kiếm bài học toàn hệ thống").fill("Sắp xếp tư liệu");
  await Promise.all([
    page.waitForResponse((response) => progressResponse(response, "opened", "90000", 200)),
    page.getByRole("region", { name: "Kết quả tìm kiếm bài học" }).getByText("Sắp xếp tư liệu", { exact: true }).click(),
  ]);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Đã hoàn thành" })).toBeEnabled();
  return dialog;
}

test("hai tab nhận xung đột, xem trạng thái đã lưu và không tự ghi lại ý định cũ", async ({ browser, baseURL }) => {
  expect(baseURL).toBe(origin);
  const context = await browser.newContext({ baseURL });
  const otherContext = await browser.newContext({ baseURL });
  try {
    await signIn(context, "conflict-a@example.invalid");
    await signIn(otherContext, "conflict-b@example.invalid");
    const tabA = await context.newPage();
    const tabB = await context.newPage();
    await Promise.all([tabA.goto("/"), tabB.goto("/")]);
    await Promise.all([
      tabA.getByRole("button", { name: /Bài thực hành/ }).click(),
      tabB.getByRole("button", { name: /Bài thực hành/ }).click(),
    ]);
    await Promise.all([
      tabA.getByRole("button", { name: prepareTitle }).click(),
      tabB.getByRole("button", { name: prepareTitle }).click(),
    ]);
    let dialogA = tabA.getByRole("dialog");
    let dialogB = tabB.getByRole("dialog");
    await Promise.all([
      tabA.waitForResponse((response) => progressResponse(response, "practice", "prepare-project", 200)),
      dialogA.getByRole("button", { name: "Đã hoàn thành" }).click(),
    ]);
    await Promise.all([
      tabB.waitForResponse((response) => progressResponse(response, "practice", "prepare-project", 409)),
      dialogB.getByRole("button", { name: "Đang thực hiện" }).click(),
    ]);
    let alert = tabB.getByRole("alert", { name: "Thông báo lỗi lưu tiến độ" });
    await expect(alert).toContainText("Tiến độ đã thay đổi ở nơi khác");
    await expect(alert.getByRole("button", { name: "Thử lại thao tác vừa thất bại" })).toHaveCount(0);
    await expect(dialogB.getByRole("button", { name: "Đã hoàn thành" })).toHaveAttribute("aria-pressed", "true");
    expect((await (await context.request.get("/api/progress")).json()).practices["prepare-project"]).toBe("completed");
    expect((await (await otherContext.request.get("/api/progress")).json()).practices["prepare-project"]).toBeUndefined();
    await alert.getByRole("button", { name: "Đóng thông báo lỗi" }).click();
    await Promise.all([
      tabB.waitForResponse((response) => progressResponse(response, "practice", "prepare-project", 200)),
      dialogB.getByRole("button", { name: "Đang thực hiện" }).click(),
    ]);
    await expect(dialogB.getByRole("button", { name: "Đang thực hiện" })).toHaveAttribute("aria-pressed", "true");
    await Promise.all([
      dialogA.getByRole("button", { name: /Đóng bảng hướng dẫn/ }).click(),
      dialogB.getByRole("button", { name: /Đóng bảng hướng dẫn/ }).click(),
    ]);

    // A failed request may have raced with a write in another tab before the user retries it.
    await Promise.all([
      tabA.getByRole("button", { name: cutTitle }).click(),
      tabB.getByRole("button", { name: cutTitle }).click(),
    ]);
    dialogA = tabA.getByRole("dialog");
    dialogB = tabB.getByRole("dialog");
    let writesFromB = 0;
    await tabB.route("**/api/progress", async (route) => {
      const request = route.request();
      const body = request.method() === "POST" ? request.postDataJSON() : null;
      if (body?.kind === "practice" && body.id === "edit-cut") {
        writesFromB += 1;
        if (writesFromB === 1) {
          await route.fulfill({ status: 500, json: { error: "Lỗi giả lập" } });
          return;
        }
      }
      await route.continue();
    });
    await Promise.all([
      tabB.waitForResponse((response) => progressResponse(response, "practice", "edit-cut", 500)),
      dialogB.getByRole("button", { name: "Đang thực hiện" }).click(),
    ]);
    alert = tabB.getByRole("alert", { name: "Thông báo lỗi lưu tiến độ" });
    await expect(alert).toBeVisible();
    await Promise.all([
      tabA.waitForResponse((response) => progressResponse(response, "practice", "edit-cut", 200)),
      dialogA.getByRole("button", { name: "Đã hoàn thành" }).click(),
    ]);
    await Promise.all([
      tabB.waitForResponse((response) => progressResponse(response, "practice", "edit-cut", 409)),
      alert.getByRole("button", { name: "Thử lại thao tác vừa thất bại" }).click(),
    ]);
    await expect(alert).toContainText("Tiến độ đã thay đổi ở nơi khác");
    await expect(alert.getByRole("button", { name: "Thử lại thao tác vừa thất bại" })).toHaveCount(0);
    await expect(dialogB.getByRole("button", { name: "Đã hoàn thành" })).toHaveAttribute("aria-pressed", "true");
    expect(writesFromB).toBe(2);
    await alert.getByRole("button", { name: "Đóng thông báo lỗi" }).click();

    // If the server saved but its response was lost, retry must reveal the saved state.
    await tabA.unroute("**/api/progress");
    let loseSavedResponse = true;
    await tabA.route("**/api/progress", async (route) => {
      const request = route.request();
      const body = request.method() === "POST" ? request.postDataJSON() : null;
      if (body?.kind === "practice" && body.id === "edit-cut" && loseSavedResponse) {
        loseSavedResponse = false;
        const saved = await route.fetch();
        expect(saved.status()).toBe(200);
        await route.abort();
        return;
      }
      await route.continue();
    });
    await dialogA.getByRole("button", { name: "Đang thực hiện" }).click();
    const uncertain = tabA.getByRole("alert", { name: "Thông báo lỗi lưu tiến độ" });
    await expect(uncertain).toContainText("Không xác nhận được việc lưu tiến độ");
    await Promise.all([
      tabA.waitForResponse((response) => progressResponse(response, "practice", "edit-cut", 409)),
      uncertain.getByRole("button", { name: "Thử lại thao tác vừa thất bại" }).click(),
    ]);
    await expect(uncertain).toContainText("Tiến độ đã thay đổi ở nơi khác");
    await expect(dialogA.getByRole("button", { name: "Đang thực hiện" })).toHaveAttribute("aria-pressed", "true");
    expect((await (await context.request.get("/api/progress")).json()).practices["edit-cut"]).toBe("in_progress");
    await uncertain.getByRole("button", { name: "Đóng thông báo lỗi" }).click();
    await Promise.all([
      dialogA.getByRole("button", { name: /Đóng bảng hướng dẫn/ }).click(),
      dialogB.getByRole("button", { name: /Đóng bảng hướng dẫn/ }).click(),
    ]);

    // Opening a previously unseen lesson creates a row; its returned version must permit the first update.
    const lessonA = await openLesson(tabA);
    const lessonB = await openLesson(tabB);
    await Promise.all([
      tabA.waitForResponse((response) => progressResponse(response, "lesson", "90000", 200)),
      lessonA.getByRole("button", { name: "Đã hoàn thành" }).click(),
    ]);
    await Promise.all([
      tabB.waitForResponse((response) => progressResponse(response, "lesson", "90000", 409)),
      lessonB.getByRole("button", { name: "Đang học" }).click(),
    ]);
    await expect(tabB.getByRole("alert", { name: "Thông báo lỗi lưu tiến độ" })).toContainText("Tiến độ đã thay đổi ở nơi khác");
    await expect(lessonB.getByRole("button", { name: "Đã hoàn thành" })).toHaveAttribute("aria-pressed", "true");

    // Replacing the session must not let the old tab write into the other account.
    await lessonA.getByRole("button", { name: "Đóng bảng chi tiết bài học" }).click();
    await tabA.getByRole("button", { name: "Xóa tìm kiếm" }).click();
    await tabA.getByRole("button", { name: cutTitle }).click();
    const oldAccountDialog = tabA.getByRole("dialog");
    expect((await context.request.post("/api/auth/sign-out", { headers: { origin }, data: {} })).status()).toBe(200);
    await signIn(context, "conflict-b@example.invalid");
    await Promise.all([
      tabA.waitForResponse((response) => progressResponse(response, "practice", "edit-cut", 409)),
      oldAccountDialog.getByRole("button", { name: "Đang thực hiện" }).click(),
    ]);
    await expect(tabA.getByRole("alert", { name: "Thông báo lỗi lưu tiến độ" })).toContainText("Tài khoản đăng nhập đã thay đổi");
    expect((await (await context.request.get("/api/progress")).json()).practices["edit-cut"]).toBeUndefined();
  } finally {
    await Promise.all([context.close(), otherContext.close()]);
  }
});
