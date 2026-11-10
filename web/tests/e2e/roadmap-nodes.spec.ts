import { expect, test } from "@playwright/test";

test("trục lộ trình mở chi tiết bằng bàn phím và chuyển sang danh sách", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/demo");
  const roadmap = page.getByRole("region", { name: "Lộ trình mẫu" });
  const first = roadmap.getByRole("button", { name: /Sắp xếp tư liệu/ });
  const second = roadmap.getByRole("button", { name: /Tạo project/ });
  expect((await first.boundingBox())!.y).toBeLessThan((await second.boundingBox())!.y);
  await first.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Sắp xếp tư liệu" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(first).toBeFocused();
  await roadmap.getByRole("button", { name: "Danh sách", exact: true }).click();
  await expect(roadmap.getByRole("button", { name: "Danh sách", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(roadmap.getByRole("button", { name: /Sắp xếp tư liệu/ })).toBeVisible();
});

test("trục và điều khiển sử dụng được trên màn hình hẹp", async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/demo");
    const roadmap = page.getByRole("region", { name: "Lộ trình mẫu" });
    await roadmap.getByRole("button", { name: /Chuẩn bị project và tư liệu/ }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Chuẩn bị project và tư liệu" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
