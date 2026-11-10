import { expect, test } from "@playwright/test";

test("vòng học mẫu giữ riêng tiến độ và ngữ cảnh", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/bai-hoc/90003?demo=1");
  await page.getByRole("button", { name: "Đang học" }).click();
  await expect(page.getByRole("button", { name: "Đang học" })).toHaveAttribute("aria-pressed", "true");

  const [support] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("region", { name: "Bài học liên kết" }).getByRole("link", { name: /Chọn cảnh/ }).click(),
  ]);
  await expect(support.getByRole("heading", { name: "Chọn cảnh" })).toBeVisible();
  await support.close();

  await page.getByRole("region", { name: "Bài thực hành dùng bài này" }).getByRole("link", { name: /Cắt một đoạn nói rõ ý/ }).click();
  const brief = page.getByRole("dialog");
  await brief.getByRole("button", { name: "Đã hoàn thành" }).click();
  await brief.getByRole("link", { name: "Quay lại bài học" }).click();
  await expect(page.getByRole("button", { name: "Đang học" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Sao chép ngữ cảnh cho Obsidian / AI" }).click();
  const note = await page.evaluate(() => navigator.clipboard.readText());
  expect(note).toContain("90003");
  expect(note).toContain("edit-cut");
  expect(note).toContain("chưa xác minh nội dung video");
  const lessonUrl = note.match(/http:\/\/[^\s]+/)?.[0];
  expect(lessonUrl).toBeTruthy();
  await page.goto(lessonUrl!);
  await expect(page.getByRole("heading", { name: "Cắt và sắp xếp" })).toBeVisible();
  await page.goto("/demo?practice=portfolio-case");
  await expect(page.getByRole("dialog")).toBeVisible();
});
