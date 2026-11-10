import { expect, test } from "@playwright/test";

test("bảng chi tiết dẫn sang trang học riêng thay vì nhúng trình phát", async ({ page }) => {
  await page.route("**/*", async (route) => {
    const host = new URL(route.request().url()).hostname;
    if (host !== "127.0.0.1" && host !== "localhost") return route.abort();
    await route.continue();
  });
  await page.goto("/demo");
  await page.getByRole("button", { name: /Cắt một đoạn nói rõ ý/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /Bài mẫu: Cắt và sắp xếp/ }).click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByRole("link", { name: "Mở trang học" })).toHaveAttribute("href", /^\/bai-hoc\/\d+\?demo=1$/);
  await expect(detail.locator("iframe")).toHaveCount(0);
  await expect(detail.locator("video")).toHaveCount(0);
  const [study] = await Promise.all([page.waitForEvent("popup"), detail.getByRole("link", { name: "Mở trang học" }).click()]);
  await expect(study).toHaveURL(/\/bai-hoc\/\d+\?demo=1$/);
  await expect(study.getByRole("heading", { name: "Cắt và sắp xếp" })).toBeVisible();
});

test("lối vào trang học vẫn dùng được trên điện thoại và không tràn bố cục", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/demo");
  await page.getByRole("button", { name: /Cắt một đoạn nói rõ ý/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /Bài mẫu: Cắt và sắp xếp/ }).click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByRole("heading", { name: "Cắt và sắp xếp" })).toBeVisible();
  await expect(detail.getByRole("link", { name: "Mở trang học" })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
