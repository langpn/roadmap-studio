import { expect, test } from "@playwright/test";

// Chạy với máy chủ đang có: E2E_BASE_URL=http://127.0.0.1:3001 pnpm exec playwright test tests/e2e/lesson-practices.spec.ts
const demo = (path: string) => `${path}${path.includes("?") ? "&" : "?"}demo=1`;
const heading = { name: "Bài thực hành dùng bài này" } as const;
const practiceLink = /Cắt một đoạn nói rõ ý/;

test("trang học mở thực hành kèm lối về bài và Esc đóng được", async ({ page }) => {
  await page.goto(demo("/bai-hoc/90003"));
  const card = page.getByRole("region", heading).first();
  await expect(card.getByRole("link", { name: practiceLink })).toHaveAttribute("href", /practice=edit-cut&lesson=90003/);

  await card.getByRole("link", { name: practiceLink }).click();
  await expect(page).toHaveURL(/\/demo\?practice=edit-cut&lesson=90003/);

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Cắt một đoạn nói rõ ý");
  const back = dialog.getByRole("link", { name: "Quay lại bài học" });
  await expect(back).toHaveAttribute("href", /\/bai-hoc\/90003(\?demo=1)?$/);
  // Hộp thoại tự đưa tiêu điểm vào phần tử đầu tiên sau khi hydrate.
  await expect(back).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("bảng chi tiết mở trang học trong tab mới và giữ lộ trình", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: /^Làm quen dựng phim/ }).click();
  await page.getByRole("button", { name: /Cắt và sắp xếp/ }).click();

  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Bài học liên kết" })).toBeVisible();
  await expect(drawer.getByRole("link", { name: /Chọn cảnh/ })).toHaveAttribute("target", "_blank");
  await expect(drawer).toContainText("chưa mục nào xác minh nội dung video");
  await expect(drawer).toContainText("Gợi ý theo tiêu đề; chưa xác minh nội dung video");
  const [study] = await Promise.all([
    page.waitForEvent("popup"),
    drawer.getByRole("link", { name: "Mở trang học" }).click(),
  ]);
  await expect(study).toHaveURL(/\/bai-hoc\/90003\?demo=1/);
  await expect(study.getByRole("region", heading).first()).toContainText("Cắt một đoạn nói rõ ý");
  await expect(drawer.getByRole("heading", { level: 2 }).first()).toHaveText("Cắt và sắp xếp");
});

test("bàn phím mở được thực hành từ trang học", async ({ page }) => {
  await page.goto(demo("/bai-hoc/90003"));
  const link = page.getByRole("region", heading).first().getByRole("link", { name: practiceLink });
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/practice=edit-cut&lesson=90003/);
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("trang học không tràn ngang và đọc được thẻ thực hành trên điện thoại", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(demo("/bai-hoc/90003"));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  const card = page.getByRole("region", heading).first();
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeInViewport();
  await expect(card.getByRole("link", { name: practiceLink })).toBeVisible();
});
