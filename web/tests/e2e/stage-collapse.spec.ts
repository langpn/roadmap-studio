import { expect, test } from "@playwright/test";

test("thu gọn từng chặng, giữ tiến độ và mở lại bằng bàn phím", async ({ page }) => {
  await page.goto("/demo");
  const firstStage = page.getByRole("region", { name: "Chặng 1: Từ project đến clip đầu" });
  const secondStage = page.getByRole("region", { name: "Chặng 2: Dựng clip theo yêu cầu" });
  const firstStep = firstStage.getByRole("button", { name: /Chuẩn bị project và tư liệu/ });

  await firstStep.click();
  const brief = page.getByRole("dialog");
  await brief.getByRole("button", { name: "Đã hoàn thành" }).click();
  await brief.getByRole("button", { name: /Đóng bảng hướng dẫn/ }).click();
  await expect(firstStage.getByText(/^1\/\d+ bước hoàn thành$/)).toBeVisible();

  const toggle = firstStage.getByRole("button", { name: /chặng 1/i });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(firstStep).toBeHidden();
  await expect(firstStage.getByText(/^1\/\d+ bước hoàn thành$/)).toBeVisible();
  await expect(secondStage.getByRole("button", { name: /Bài tập số 2/ })).toBeVisible();

  await page.getByRole("button", { name: "Danh sách bước" }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(firstStep).toBeVisible();
  await expect(firstStep).toContainText("Đã hoàn thành");
});
