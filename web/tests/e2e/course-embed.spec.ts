import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_SOURCE !== "1", "Chỉ chạy với máy chủ và dữ liệu giả lập riêng.");
const origin = "http://127.0.0.1:3243";
const lessonUrl = "https://seankangmvp.com/courses/synthetic/chapters/900/lessons/90000";

test("mở đúng bài trên website gốc trong cửa sổ học bên cạnh theo hành động của người học", async ({ page, baseURL }) => {
  expect(baseURL).toBe(origin);
  await page.context().route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.href === lessonUrl) {
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<title>Bài giả</title><button onclick=\"this.textContent='Đang phát giả lập'\">Phát giả lập</button>" });
    }
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return route.abort();
    return route.continue();
  });
  const response = await page.request.post(`${origin}/api/auth/sign-in/email`, {
    headers: { origin }, data: { email: "source@example.invalid", password: "source-fixture-password-only" },
  });
  expect(response.status()).toBe(200);
  await page.goto("/");
  await page.getByLabel("Tìm kiếm bài học toàn hệ thống").fill("Sắp xếp tư liệu");
  await page.getByRole("region", { name: "Kết quả tìm kiếm bài học" }).getByText("Sắp xếp tư liệu", { exact: true }).click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByRole("heading", { name: "Sắp xếp tư liệu" })).toBeVisible();
  await expect(detail.getByRole("button", { name: "Chọn video trên máy" })).toHaveCount(0);
  await expect(detail.getByLabel("Đường dẫn MP4, WebM hoặc HLS")).toHaveCount(0);
  await expect(detail.locator("iframe")).toHaveCount(0);
  const popupPromise = page.waitForEvent("popup");
  await detail.getByRole("button", { name: "Xem bài học trên website gốc" }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(lessonUrl);
  expect(await popup.evaluate(() => window.opener)).toBeNull();
  await popup.getByRole("button", { name: "Phát giả lập" }).click();
  await expect(popup.getByRole("button", { name: "Đang phát giả lập" })).toBeVisible();
  expect((await (await page.request.get(`${origin}/api/progress`)).json()).lessons["90000"]).toBe("not_updated");
  await expect(detail.getByRole("link", { name: "Mở trong thẻ mới" })).toHaveAttribute("href", lessonUrl);
  await popup.close();
  await detail.getByRole("button", { name: "Đóng bảng chi tiết bài học" }).click();
});

test("khi trình duyệt chặn cửa sổ mới vẫn có liên kết gốc và bố cục dùng được ở 320px", async ({ page, baseURL }) => {
  expect(baseURL).toBe(origin);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return route.abort();
    return route.continue();
  });
  const response = await page.request.post(`${origin}/api/auth/sign-in/email`, {
    headers: { origin }, data: { email: "source@example.invalid", password: "source-fixture-password-only" },
  });
  expect(response.status()).toBe(200);
  await page.goto("/");
  await page.evaluate(() => { window.open = () => null; });
  await page.getByLabel("Tìm kiếm bài học toàn hệ thống").fill("Sắp xếp tư liệu");
  await page.getByRole("region", { name: "Kết quả tìm kiếm bài học" }).getByText("Sắp xếp tư liệu", { exact: true }).click();
  const detail = page.getByRole("dialog");
  await detail.getByRole("button", { name: "Xem bài học trên website gốc" }).click();
  await expect(detail.getByRole("alert")).toContainText(/Trình duyệt đã chặn cửa sổ mới/);
  await expect(detail.getByRole("link", { name: "Mở trong thẻ mới" })).toHaveAttribute("href", lessonUrl);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await detail.getByRole("button", { name: "Bài tiếp theo: Tạo project" }).click();
  await expect(detail.getByRole("heading", { name: "Tạo project" })).toBeVisible();
  await expect(detail.locator("iframe")).toHaveCount(0);
});
