import { expect, test } from "@playwright/test";

test("tiếp tục học clip thứ hai dù proposal đã xong và nhánh tiếp cận vẫn có thể mở", async ({ page }) => {
  await page.addInitScript(() => {
    const done = [
      "prepare-project", "edit-cut", "edit-frame", "edit-audio", "edit-frame-audio",
      "edit-subtitles-text", "edit-export", "edit-subtitles", "clip-first",
      "quality-review", "quality-revise",
      "portfolio-case", "profile-draft", "find-job", "proposal-draft",
    ];
    localStorage.setItem("roadmap-demo-progress", JSON.stringify({
      lessons: {}, practices: Object.fromEntries(done.map((id) => [id, "completed"])), lastOpenedLessonId: null,
    }));
  });
  await page.goto("/demo");
  await expect(page.getByText("Bắt đầu: Đọc brief clip mẫu")).toBeVisible();
  await page.getByRole("button", { name: /Bài thực hành.*15\/36/ }).click();
  await page.getByRole("button", { name: /Tập tiếp cận và ghi lượt gửi/ }).click();
  const brief = page.getByRole("dialog");
  await brief.getByRole("button", { name: "Đã hoàn thành" }).click();
  await brief.getByRole("button", { name: /Đóng bảng hướng dẫn/ }).click();
  await page.getByRole("button", { name: /Tổng quan lộ trình/ }).click();
  await expect(page.getByText("Bắt đầu: Đọc brief clip mẫu")).toBeVisible();
  await page.getByRole("button", { name: /Bài thực hành.*16\/36/ }).click();
  await expect(page.getByRole("button", { name: /Đọc brief clip mẫu/ }).locator("../..")).toContainText("Chưa làm");
});
