import { expect, test } from "@playwright/test";

test("giữ tiến độ khi chuyển giữa trục và danh sách bằng bàn phím", async ({ page }) => {
  await page.goto("/demo");
  const roadmap = page.getByRole("region", { name: "Lộ trình mẫu" });
  await roadmap.getByRole("button", { name: /Chuẩn bị project và tư liệu/ }).click();
  const brief = page.getByRole("dialog");
  await brief.getByRole("button", { name: "Đã hoàn thành" }).click();
  await brief.getByRole("button", { name: /Đóng bảng hướng dẫn/ }).click();
  const list = roadmap.getByRole("button", { name: "Danh sách", exact: true });
  await list.focus();
  await page.keyboard.press("Enter");
  await expect(list).toHaveAttribute("aria-pressed", "true");
  await expect(roadmap.getByRole("button", { name: /Chuẩn bị project và tư liệu/ })).toContainText("Đã hoàn thành");
});
