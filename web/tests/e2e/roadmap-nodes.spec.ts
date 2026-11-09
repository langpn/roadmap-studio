import { expect, test } from "@playwright/test";

test("sơ đồ dùng các node gọn, mở chi tiết bằng bàn phím và chuyển sang danh sách", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/demo");

  const stage = page.getByRole("region", { name: "Chặng 1: Từ project đến clip đầu" });
  const first = stage.getByRole("button", { name: /Chuẩn bị project và tư liệu/ });
  const second = stage.getByRole("button", { name: /Cắt một đoạn nói rõ ý/ });
  const stageBox = await stage.boundingBox();
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  expect(stageBox && firstBox && secondBox).toBeTruthy();
  expect(firstBox!.width).toBeLessThan(stageBox!.width * 0.6);
  expect(firstBox!.x).toBeLessThan(secondBox!.x);
  expect(firstBox!.y).toBeLessThan(secondBox!.y);
  await expect(first).toContainText("Chưa thực hiện");

  await first.focus();
  await page.keyboard.press("Enter");
  const brief = page.getByRole("dialog");
  await expect(brief.getByRole("heading", { name: "Chuẩn bị project và tư liệu" })).toBeVisible();
  await brief.getByRole("button", { name: /Đóng bảng hướng dẫn/ }).click();
  await expect(first).toBeFocused();

  await page.getByRole("button", { name: "Danh sách bước" }).click();
  await expect(first.getByText("Tạo một project để bắt đầu dựng ngay.")).toBeVisible();
  await expect(first).toContainText("Chưa thực hiện");
});

test("node và điều khiển chặng sử dụng được trên màn hình hẹp", async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/demo");
    const stage = page.getByRole("region", { name: "Chặng 1: Từ project đến clip đầu" });
    const toggle = stage.getByRole("button", { name: /Thu gọn chặng 1/i });
    const first = stage.getByRole("button", { name: /Chuẩn bị project và tư liệu/ });
    await expect(first).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(first).toBeHidden();
    await stage.getByRole("button", { name: /Mở rộng chặng 1/i }).click();
    await first.click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Chuẩn bị project và tư liệu" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
