import { expect, test } from "@playwright/test";

// Chạy với máy chủ demo: E2E_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test tests/e2e/lesson-study.spec.ts
test("trang học bài mở được từ liên kết trong bảng chi tiết", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: /Cắt một đoạn nói rõ ý/ }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /Bài mẫu: Cắt và sắp xếp/ }).click();
  const link = page.getByRole("dialog").getByRole("link", { name: "Mở trang học" });
  await expect(link).toHaveAttribute("href", /^\/bai-hoc\/90003(\?demo=1)?$/);

  const [study] = await Promise.all([page.waitForEvent("popup"), link.click()]);
  await expect(study.getByRole("heading", { level: 1, name: "Cắt và sắp xếp" })).toBeVisible();
  await expect(study.getByText("Bản thử nghiệm", { exact: true })).toBeVisible();
  await expect(study.getByText(/Video mẫu chỉ để thử trình phát/)).toBeVisible();
  await expect(study.getByText("Đăng nhập")).toHaveCount(0);
});

test("bài trước và bài tiếp đi qua ranh giới chương, giữ ?demo=1", async ({ page }) => {
  await page.goto("/bai-hoc/90000?demo=1");
  await expect(page.locator('nav[aria-label="Chuyển bài học"]').getByRole("link", { name: /Bài tiếp/ }))
    .toHaveAttribute("href", "/bai-hoc/90001?demo=1");

  // 90002 là bài cuối chương 1 của danh mục mẫu, bài tiếp mở đầu chương 2.
  await page.goto("/bai-hoc/90002?demo=1");
  await expect(page.locator('nav[aria-label="Chuyển bài học"]').getByRole("link", { name: /Bài tiếp/ }))
    .toHaveAttribute("href", "/bai-hoc/90003?demo=1");

  await page.locator('nav[aria-label="Chuyển bài học"]').getByRole("link", { name: /Bài tiếp/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cắt và sắp xếp" })).toBeVisible();
  await expect(page.locator('nav[aria-label="Chuyển bài học"]').getByRole("link", { name: /Bài trước/ }))
    .toHaveAttribute("href", "/bai-hoc/90002?demo=1");
});

test("bài cuối khóa không có nút bài tiếp", async ({ page }) => {
  await page.goto("/bai-hoc/90005?demo=1");
  await expect(page.locator('nav[aria-label="Chuyển bài học"]').getByRole("link", { name: /Bài tiếp/ })).toHaveCount(0);
  await expect(page.locator('nav[aria-label="Chuyển bài học"]').getByRole("link", { name: /Bài trước/ }))
    .toHaveAttribute("href", "/bai-hoc/90004?demo=1");
});

test("tiến độ demo lưu trên trình duyệt và vẫn còn sau khi tải lại", async ({ page }) => {
  await page.goto("/bai-hoc/90002?demo=1");
  const completed = page.getByRole("button", { name: "Đã hoàn thành" });
  await completed.click();
  await expect(completed).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(page.getByRole("button", { name: "Đã hoàn thành" })).toHaveAttribute("aria-pressed", "true");
});

test("mô tả bài lấy từ danh mục và không bịa nội dung video", async ({ page }) => {
  await page.goto("/bai-hoc/90003?demo=1");
  await expect(page.getByRole("heading", { name: "Mô tả bài" })).toBeVisible();
  await expect(page.getByText("Đây là bài mẫu, chưa có mô tả đối chiếu.")).toBeVisible();
  await expect(page.getByText(/không phải nội dung video/)).toBeVisible();
  await expect(page.getByText(/Website gốc|website khóa học bị khóa/)).toBeVisible();
});

test("trang học không tràn ngang trên điện thoại", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/bai-hoc/90003?demo=1");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(page.getByRole("heading", { name: "Mô tả bài" })).toBeInViewport();
});
