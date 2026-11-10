import { expect, test } from "@playwright/test";
import { PRACTICE_IDS } from "../../src/lib/progress/practice-ids";

const practiceCount = (completed: number) => new RegExp(`Bài thực hành.*${completed}/${PRACTICE_IDS.length}`);

test("demo chỉ hiển thị dữ liệu mẫu và các thao tác có thể sử dụng", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByPlaceholder(/Tìm kiếm bài học/)).toHaveAttribute("placeholder", /3 khóa/);
  if (process.env.E2E_DEMO_ONLY === "1") {
    await expect(page.getByRole("link", { name: "Đăng nhập" })).toHaveCount(0);
  } else {
    await expect(page.getByRole("link", { name: "Đăng nhập" })).toHaveAttribute("href", "/dang-nhap");
  }
  await expect(page.getByText(/Baby Resolve|Elite Pro|Bài #2207/)).toHaveCount(0);
  await page.getByRole("button", { name: /Bài tập số 1: Dựng clip talking-head ngắn/ }).click();
  const brief = page.getByRole("dialog");
  await expect(brief.getByText(/Baby Resolve|Elite Pro|Bài #2207/)).toHaveCount(0);
  await brief.getByRole("button", { name: "Đã hoàn thành" }).click();
  await expect(brief.getByRole("button", { name: "Đã hoàn thành" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: practiceCount(1) })).toBeVisible();
  await page.getByRole("button", { name: practiceCount(1) }).click();
  await expect(page.getByRole("button", { name: /Bài tập số 2: Dựng clip có hình minh họa/ })).toBeVisible();
});

test("mã trình duyệt của demo không chứa tên hay URL khóa học thật", async ({ page }) => {
  const response = await page.goto("/demo");
  expect(await response!.text()).not.toMatch(/Baby Resolve|Elite Pro|baby-resolve|elite-pro|freelance-mvp|seankangmvp\.com/i);
  const leaks = await page.evaluate(async () => {
    const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"));
    const contents = await Promise.all(scripts.map(async (script) => (await fetch(script.src)).text()));
    return contents.filter((text) => /Baby Resolve|Elite Pro|baby-resolve|elite-pro|freelance-mvp|seankangmvp\.com/i.test(text)).length;
  });
  expect(leaks).toBe(0);
});

test("hướng dẫn thực hành đọc và thao tác được trên điện thoại", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "Mở việc cần làm" }).click();
  const brief = page.getByRole("dialog");
  await expect(brief.getByRole("heading", { name: "Chuẩn bị project và tư liệu" })).toBeVisible();
  await brief.getByRole("button", { name: "Đang thực hiện" }).click();
  await expect(brief.getByRole("button", { name: "Đang thực hiện" })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await brief.getByRole("button", { name: /Đóng bảng hướng dẫn/ }).click();
  await expect(page.getByText("Tiếp tục: Chuẩn bị project và tư liệu")).toBeVisible();
});

test("menu điện thoại chỉ nhận focus khi mở và đóng bằng Escape", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  const menu = page.getByRole("button", { name: "Mở thanh điều hướng" });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: /Làm quen dựng phim 0\/6/ })).toBeHidden();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Đóng thanh điều hướng" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();
});

test("gợi ý theo tiến độ dù làm lệch thứ tự và sau khi mở bài tham khảo", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: practiceCount(0) }).click();
  await page.getByRole("button", { name: /Bài tập số 2: Dựng clip có hình minh họa/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Đã hoàn thành" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Đóng bảng hướng dẫn/ }).click();
  await page.getByRole("button", { name: /Tổng quan lộ trình/ }).click();
  await expect(page.getByText("Bắt đầu: Chuẩn bị project và tư liệu")).toBeVisible();
  await page.getByRole("button", { name: "Mở việc cần làm" }).click();
  const practice = page.getByRole("dialog");
  await expect(practice.getByRole("heading", { name: "Chuẩn bị project và tư liệu" })).toBeVisible();
  await practice.getByRole("button", { name: /Bài mẫu: Sắp xếp tư liệu/ }).click();
  const lesson = page.getByRole("dialog");
  await expect(lesson.getByRole("heading", { name: "Sắp xếp tư liệu" })).toBeVisible();
  await lesson.getByRole("button", { name: "Đóng bảng chi tiết bài học" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Chuẩn bị project và tư liệu" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: /Đóng bảng hướng dẫn/ }).click();
  await expect(page.getByText("Bắt đầu: Chuẩn bị project và tư liệu")).toBeVisible();
  await page.getByRole("button", { name: practiceCount(1) }).click();
  await expect(page.getByRole("heading", { name: "Các bài thực hành" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Chặng 2.*Dựng clip theo yêu cầu/ })).toBeVisible();
});

test("giữ tiến độ bài tập cũ khi mở roadmap mới", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("roadmap-demo-progress", JSON.stringify({
      lessons: {}, practices: { "clip-first": "completed", "clip-brief": "in_progress" }, lastOpenedLessonId: null,
    }));
  });
  await page.goto("/demo");
  await expect(page.getByRole("button", { name: practiceCount(1) })).toBeVisible();
  await expect(page.getByRole("button", { name: /Bài tập số 1: Dựng clip talking-head ngắn/ })).toContainText("Đã hoàn thành");
  await page.getByRole("button", { name: practiceCount(1) }).click();
  await expect(page.getByRole("button", { name: /Bài tập số 2: Dựng clip có hình minh họa/ }).locator("../..")).toContainText("Đang làm");
});

test("đọc được mã thực hành của bản demo đời đầu", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("roadmap-demo-progress", JSON.stringify({
      lessons: {}, practices: { "bai-tap-1": "completed", "bai-tap-2": "in_progress" }, lastOpenedLessonId: null,
    }));
  });
  await page.goto("/demo");
  await expect(page.getByRole("button", { name: practiceCount(1) })).toBeVisible();
  await page.getByRole("button", { name: practiceCount(1) }).click();
  await expect(page.getByRole("button", { name: /Bài tập số 2: Dựng clip có hình minh họa/ }).locator("../..")).toContainText("Đang làm");
});

test("trạng thái mới được ưu tiên khi còn mã thực hành cũ", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("roadmap-demo-progress", JSON.stringify({
      lessons: {}, practices: { "bai-tap-1": "completed", "clip-first": "in_progress" }, lastOpenedLessonId: null,
    }));
  });
  await page.goto("/demo");
  const firstClip = page.getByRole("button", { name: /Bài tập số 1: Dựng clip talking-head ngắn/ });
  await expect(firstClip).toContainText("Đang thực hiện");
  await firstClip.click();
  await page.getByRole("dialog").getByRole("button", { name: "Chưa làm" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: /Bài tập số 1: Dựng clip talking-head ngắn/ })).toContainText("Chưa thực hiện");
});

test("hai tab demo ghi hai bước riêng mà không xóa tiến độ của nhau", async ({ context, page }) => {
  const other = await context.newPage();
  await other.addInitScript(() => window.addEventListener("storage", (event) => event.stopImmediatePropagation(), true));
  await Promise.all([page.goto("/demo"), other.goto("/demo")]);
  await page.getByRole("button", { name: /Chuẩn bị project và tư liệu/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Đã hoàn thành" }).click();
  await other.getByRole("button", { name: /Cắt một đoạn nói rõ ý/ }).click();
  await other.getByRole("dialog").getByRole("button", { name: "Đã hoàn thành" }).click();
  await other.reload();
  await expect(other.getByRole("button", { name: practiceCount(2) })).toBeVisible();
  await expect(other.getByRole("button", { name: /Chuẩn bị project và tư liệu/ })).toContainText("Đã hoàn thành");
  await expect(other.getByRole("button", { name: /Cắt một đoạn nói rõ ý/ })).toContainText("Đã hoàn thành");
});

test("báo lỗi và giữ trạng thái cũ khi trình duyệt không lưu được", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, "allowDemoWrite", { value: false, writable: true });
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("roadmap-demo-") && !(window as unknown as { allowDemoWrite: boolean }).allowDemoWrite) {
        throw new DOMException("Không lưu được", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await page.goto("/demo");
  await page.getByRole("button", { name: "Mở việc cần làm" }).click();
  const brief = page.getByRole("dialog");
  await brief.getByRole("button", { name: "Đã hoàn thành" }).click();
  await expect(page.getByRole("alert", { name: "Thông báo lỗi lưu tiến độ" })).toBeVisible();
  await expect(brief.getByRole("button", { name: "Chưa làm" })).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => { (window as unknown as { allowDemoWrite: boolean }).allowDemoWrite = true; });
  await page.getByRole("button", { name: "Thử lại thao tác vừa thất bại" }).click();
  await expect(brief.getByRole("button", { name: "Đã hoàn thành" })).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: practiceCount(1) })).toBeVisible();
});

test("hoàn thành hết rồi quay lại một bước chưa làm", async ({ page }) => {
  await page.addInitScript((ids: string[]) => {
    localStorage.setItem("roadmap-demo-progress", JSON.stringify({
      lessons: {}, practices: Object.fromEntries(ids.map((id) => [id, "completed"])), lastOpenedLessonId: null,
    }));
  }, [...PRACTICE_IDS]);
  await page.goto("/demo");
  await expect(page.getByText("Bạn đã hoàn thành các bước trong lộ trình")).toBeVisible();
  await expect(page.getByRole("button", { name: practiceCount(PRACTICE_IDS.length) })).toBeVisible();
  await page.getByRole("button", { name: /Chuẩn bị project và tư liệu/ }).click();
  const brief = page.getByRole("dialog");
  await brief.getByRole("button", { name: "Chưa làm" }).click();
  await brief.getByRole("button", { name: /Đóng bảng hướng dẫn/ }).click();
  await expect(page.getByText("Bắt đầu: Chuẩn bị project và tư liệu")).toBeVisible();
  await expect(page.getByRole("button", { name: practiceCount(PRACTICE_IDS.length - 1) })).toBeVisible();
  await expect(page.getByRole("button", { name: /Cắt một đoạn nói rõ ý/ })).toContainText("Đã hoàn thành");
});

test("không báo hoàn thành toàn bộ khi chỉ còn bước được bỏ qua trong gợi ý", async ({ page }) => {
  await page.addInitScript((ids: string[]) => {
    localStorage.setItem("roadmap-demo-progress", JSON.stringify({
      lessons: {},
      practices: Object.fromEntries(ids.filter((id) => id !== "shortform-cut").map((id) => [id, "completed"])),
      lastOpenedLessonId: null,
    }));
  }, [...PRACTICE_IDS]);
  await page.goto("/demo");
  await expect(page.getByText("Các bước còn lại cần bạn chủ động chọn")).toBeVisible();
  await expect(page.getByText("Bạn đã hoàn thành các bước trong lộ trình")).toHaveCount(0);
  await page.getByRole("button", { name: practiceCount(PRACTICE_IDS.length - 1) }).click();
  await expect(page.getByRole("button", { name: /Clip mẫu: chọn ý và cắt thô/ }).locator("../..")).toContainText("Chưa làm");
});

test("chỉ gợi ý bước chờ sau khi người học chủ động bắt đầu", async ({ page }) => {
  await page.addInitScript((ids: string[]) => {
    const waiting = ["job-replies", "job-agreement", "job-delivery", "job-revisions", "job-income"];
    localStorage.setItem("roadmap-demo-progress", JSON.stringify({
      lessons: {},
      practices: Object.fromEntries(ids.filter((id) => !waiting.includes(id)).map((id) => [id, "completed"])),
      lastOpenedLessonId: null,
    }));
  }, [...PRACTICE_IDS]);
  await page.goto("/demo");
  await expect(page.getByText("Các bước còn lại cần bạn chủ động chọn")).toBeVisible();
  await page.getByRole("button", { name: practiceCount(PRACTICE_IDS.length - 5) }).click();
  await page.getByRole("button", { name: /Tập ghi trao đổi và làm rõ/ }).click();
  const brief = page.getByRole("dialog");
  await brief.getByRole("button", { name: "Đang thực hiện" }).click();
  await brief.getByRole("button", { name: /Đóng bảng hướng dẫn/ }).click();
  await page.getByRole("button", { name: /Tổng quan lộ trình/ }).click();
  await expect(page.getByText("Tiếp tục: Tập ghi trao đổi và làm rõ")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Tiếp tục: Tập ghi trao đổi và làm rõ")).toBeVisible();
  await page.getByRole("button", { name: practiceCount(PRACTICE_IDS.length - 5) }).click();
  await expect(page.getByRole("button", { name: /Tập ghi thỏa thuận giả lập/ }).locator("../..")).toContainText("Chưa làm");
});

test("mở bài bằng bàn phím và giữ tiến độ demo sau tải lại", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydrat/i.test(message.text())) hydrationErrors.push(message.text());
  });
  await page.goto("/demo");
  await page.getByRole("button", { name: /Làm quen dựng phim 0\/6/ }).click();
  const lesson = page.getByRole("button", { name: /Sắp xếp tư liệu/ });
  await lesson.focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("dialog");
  await expect(detail.getByRole("heading", { name: "Sắp xếp tư liệu" })).toBeVisible();
  await expect(detail.getByRole("button", { name: "Đóng bảng chi tiết bài học" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(await detail.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await detail.getByRole("button", { name: "Đã hoàn thành" }).click();
  await detail.getByRole("button", { name: "Đóng bảng chi tiết bài học" }).click();
  await page.getByRole("button", { name: /Tạo project/ }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Tạo project" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Làm quen dựng phim 1\/6/ })).toBeVisible();
  await expect(page.getByText("Bắt đầu: Chuẩn bị project và tư liệu")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mở lại bài vừa xem: Tạo project" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bài kế tiếp chưa hoàn thành: Đưa clip vào timeline" })).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});

test("mã mời từ fragment không đi kèm yêu cầu tải trang", async ({ page }) => {
  test.skip(process.env.E2E_DEMO_ONLY === "1", "Không có trang tài khoản trong chế độ demo riêng.");
  const token = "invite-example-only-12345678901234567890";
  const requestUrls: string[] = [];
  page.on("request", (request) => requestUrls.push(request.url()));
  await page.goto(`/dang-ky#invite=${token}`);
  await expect(page.getByLabel("Mã lời mời")).toHaveValue(token);
  await expect(page).toHaveURL(/\/dang-ky$/);
  expect(requestUrls.some((url) => url.includes(token))).toBe(false);
});

test("báo chưa cấu hình email thay vì thông báo đã gửi thư", async ({ page }) => {
  test.skip(process.env.E2E_DEMO_ONLY === "1", "Không có trang tài khoản trong chế độ demo riêng.");
  await page.goto("/quen-mat-khau");
  await expect(page.getByText(/Email chưa được cấu hình/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Yêu cầu liên kết/ })).toHaveCount(0);
  const response = await page.request.post("/api/auth/request-password-reset", {
    data: { email: "sample@example.invalid" },
  });
  expect(response.status()).toBe(503);
});

test("mã xác minh và đặt lại chỉ đi qua nội dung POST", async ({ page }) => {
  test.skip(process.env.E2E_DEMO_ONLY === "1", "Không có trang tài khoản trong chế độ demo riêng.");
  const token = "synthetic-action-token";
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  await page.route("**/api/auth/reset-password", async (route) => {
    expect(route.request().postDataJSON().token).toBe(token);
    await route.fulfill({ json: { status: true } });
  });
  await page.goto(`/dat-lai-mat-khau#token=${token}`);
  await expect(page.getByRole("button", { name: "Đổi mật khẩu" })).toBeEnabled();
  await page.getByLabel("Mật khẩu mới").fill("{{SECRET_a3c4dqu6}}");
  await page.getByLabel("Xác nhận mật khẩu").fill("{{SECRET_a3c4dqu6}}");
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(page.getByText(/Mật khẩu đã được đổi/)).toBeVisible();
  await page.route("**/api/verify-email", async (route) => {
    expect(route.request().postDataJSON().token).toBe(token);
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto(`/xac-minh-email#token=${token}`);
  await expect(page.getByRole("button", { name: "Xác minh địa chỉ email" })).toBeEnabled();
  await page.getByRole("button", { name: "Xác minh địa chỉ email" }).click();
  await expect(page.getByText("Email đã được xác minh.")).toBeVisible();
  expect(urls.some((url) => url.includes(token))).toBe(false);
});
