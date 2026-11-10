import { expect, test } from "@playwright/test";

test("tìm được điểm bắt đầu của mạng bài học từ trang tổng quan", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Khám phá bài học liên kết: Làm quen dựng phim" }).click();
  await expect(page.getByRole("heading", { name: "Làm quen dựng phim", exact: true })).toBeVisible();
});

test("bài trong khóa làm trục chưa có gợi ý vẫn báo trạng thái rõ ràng", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Mở việc cần làm" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Bài mẫu: Sắp xếp tư liệu/ }).click();
  await expect(page.getByRole("dialog").getByText("Chưa có bài liên kết gợi ý.")).toBeVisible();
});

test("đi tới bài liên kết, quay lại và giữ bài thực hành cùng tiến độ", async ({ page }) => {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      await route.abort();
      return;
    }
    await route.continue();
  });

  await page.goto("/demo");
  await page.getByRole("button", { name: /Cắt một đoạn nói rõ ý/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /Bài mẫu: Cắt và sắp xếp/ }).click();

  const detail = page.getByRole("dialog");
  await expect(detail.getByRole("heading", { name: "Cắt và sắp xếp" })).toBeVisible();
  await expect(detail.getByRole("banner")).toHaveCount(0);
  await detail.getByRole("button", { name: "Đang học" }).click();
  await expect(detail.getByRole("button", { name: "Đang học" })).toHaveAttribute("aria-pressed", "true");
  const [study] = await Promise.all([page.waitForEvent("popup"), detail.getByRole("link", { name: "Mở trang học" }).click()]);
  const [related] = await Promise.all([
    study.waitForEvent("popup"),
    study.getByRole("region", { name: "Bài học liên kết" }).getByRole("link", { name: /Chọn cảnh/ }).click(),
  ]);
  await expect(related.getByRole("heading", { name: "Chọn cảnh" })).toBeVisible();
  await related.close();
  await study.close();

  await expect(detail.getByRole("heading", { name: "Cắt và sắp xếp" })).toBeVisible();
  await expect(detail.getByRole("button", { name: "Đang học" })).toHaveAttribute("aria-pressed", "true");
  await detail.getByRole("button", { name: "Đóng bảng chi tiết bài học" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Cắt một đoạn nói rõ ý" })).toBeVisible();
  expect(new URL(page.url()).hostname).toBe("127.0.0.1");
});

test("mở bài liên kết trên màn hình điện thoại và giữ tiêu điểm trong bảng chi tiết", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/demo");
  await page.getByRole("button", { name: /Cắt một đoạn nói rõ ý/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /Bài mẫu: Cắt và sắp xếp/ }).click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByRole("heading", { name: "Cắt và sắp xếp" })).toBeVisible();
  await expect(detail.getByRole("button", { name: "Đóng bảng chi tiết bài học" })).toBeFocused();
  const [study] = await Promise.all([page.waitForEvent("popup"), detail.getByRole("link", { name: "Mở trang học" }).click()]);
  const [related] = await Promise.all([
    study.waitForEvent("popup"),
    study.getByRole("region", { name: "Bài học liên kết" }).getByRole("link", { name: /Chọn cảnh/ }).click(),
  ]);
  await expect(related.getByRole("heading", { name: "Chọn cảnh" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
