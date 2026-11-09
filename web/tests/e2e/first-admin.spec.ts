import { expect, test } from "@playwright/test";

test.skip(process.env.E2E_SETUP !== "1", "Chỉ chạy với cơ sở dữ liệu thử mới và trống.");

test("lần đầu tạo quản trị viên trên website, lần sau đăng nhập bình thường", async ({ page, browser }) => {
  const origin = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3247";
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(origin);
  await expect(page).toHaveURL(/\/thiet-lap$/);
  await expect(page.getByRole("heading", { name: "Tạo tài khoản quản trị" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await page.getByLabel("Tên hiển thị").fill("Người quản trị thử");
  await page.getByLabel("Địa chỉ email").fill("first-admin@example.invalid");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("first-admin-fixture-only");
  await page.getByLabel("Xác nhận mật khẩu").fill("first-admin-fixture-only");
  await page.getByRole("button", { name: "Tạo tài khoản quản trị" }).click();
  await expect(page).toHaveURL(`${origin}/`);
  await expect(page.getByRole("heading", { name: /Người quản trị thử/ })).toBeVisible();

  const newBrowserSession = await browser.newContext();
  try {
    const nextVisit = await newBrowserSession.newPage();
    await nextVisit.goto(`${origin}/dang-nhap`);
    await expect(nextVisit).toHaveURL(/\/dang-nhap$/);
    await expect(nextVisit.getByRole("heading", { name: "Tạo tài khoản quản trị" })).toHaveCount(0);
    await nextVisit.goto(`${origin}/thiet-lap`);
    await expect(nextVisit).toHaveURL(/\/dang-nhap$/);
    await nextVisit.getByLabel("Địa chỉ email").fill("first-admin@example.invalid");
    await nextVisit.locator('input[type="password"]').fill("first-admin-fixture-only");
    await nextVisit.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await expect(nextVisit).toHaveURL(`${origin}/`);
    await expect(nextVisit.getByRole("heading", { name: /Người quản trị thử/ })).toBeVisible();
  } finally {
    await newBrowserSession.close();
  }
});
