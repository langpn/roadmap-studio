import { expect } from "@playwright/test";
import { test } from "./media-fixture";

test.skip(process.env.E2E_MEDIA !== "1", "Cần máy chủ và cơ sở dữ liệu thử riêng.");

test("lộ trình Elite mở bài thật theo thứ tự và chuyển được giữa hai cách xem", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  const roadmap = page.getByRole("region", { name: "Lộ trình Elite" });
  await expect(roadmap).toContainText("6 bài học · 2 chương");
  const first = roadmap.getByRole("button", { name: /Sắp xếp tư liệu/ });
  const second = roadmap.getByRole("button", { name: /Tạo project/ });
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  expect((await first.boundingBox())!.y).toBeLessThan((await second.boundingBox())!.y);

  await first.focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("dialog");
  await expect(detail.getByRole("heading", { name: "Sắp xếp tư liệu" })).toBeVisible();
  await expect(detail.locator("iframe, video")).toHaveCount(0);
  await expect(detail.getByRole("link", { name: "Mở trang học" })).toHaveAttribute("href", "/bai-hoc/90000");
  await page.keyboard.press("Escape");

  await roadmap.getByRole("button", { name: "Danh sách", exact: true }).click();
  await expect(roadmap.getByRole("button", { name: "Danh sách", exact: true })).toHaveAttribute("aria-pressed", "true");
  await roadmap.getByRole("button", { name: /Hoàn thiện clip/ }).click();
  await expect(roadmap.getByRole("button", { name: /Xuất bản thử/ })).toBeVisible();
});

test("lộ trình vừa màn hình hẹp và tải đủ kiểu trình bày", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const roadmap = page.getByRole("region", { name: "Lộ trình Elite" });
  await expect(roadmap.getByRole("button", { name: /Sắp xếp tư liệu/ })).toBeVisible();
  await expect(roadmap.locator('[class*="intro_"]').first()).toHaveCSS("display", "flex");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
test("trang học bài chưa từng mở vẫn lưu được tiến độ ngay lần đầu và chuyển sang bài kế", async ({ page }) => {
  await page.goto("/bai-hoc/90004");
  await expect(page.getByRole("heading", { name: "Thêm chữ" })).toBeVisible();
  const completed = page.getByRole("button", { name: "Đã hoàn thành" });
  await completed.click();
  await expect(completed).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("alert", { name: "Thông báo lưu tiến độ" })).toHaveCount(0);
  await page.getByRole("link", { name: /Bài tiếp/ }).click();
  await expect(page.getByRole("heading", { name: "Xuất bản thử" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chưa học" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: /Bài trước/ }).click();
  await expect(page.getByRole("heading", { name: "Thêm chữ" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Đã hoàn thành" })).toHaveAttribute("aria-pressed", "true");
});
