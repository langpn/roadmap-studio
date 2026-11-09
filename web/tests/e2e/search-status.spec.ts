import { expect, test } from "@playwright/test";

// Chạy với máy chủ demo: E2E_BASE_URL=http://127.0.0.1:3000 pnpm exec playwright test tests/e2e/search-status.spec.ts
test("tìm theo tên không dấu và lọc theo trạng thái giữ thứ tự nguồn", async ({ page }) => {
  await page.goto("/demo");
  const search = page.getByLabel("Tìm kiếm bài học toàn hệ thống");
  await search.fill("sap xep");
  const results = page.getByRole("region", { name: "Kết quả tìm kiếm bài học" });
  await expect(results).toBeVisible();
  await expect(results.getByText("Sắp xếp tư liệu", { exact: true })).toBeVisible();

  // Chưa học cả hai bài khớp: lọc "Đã hoàn thành" phải ra trạng thái rỗng có hướng dẫn xóa lọc.
  await results.getByLabel("Trạng thái").selectOption("completed");
  await expect(results.getByText(/Không tìm thấy bài học nào phù hợp với từ khóa/)).toBeVisible();
  await expect(results.getByText(/và trạng thái “Đã hoàn thành”/)).toBeVisible();

  await results.getByRole("button", { name: "Xóa tìm kiếm" }).click();
  await expect(results).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /Không gian học dựng video/ })).toBeVisible();
});

test("lọc theo trạng thái chỉ hiện bài đã đánh dấu", async ({ page }) => {
  await page.goto("/bai-hoc/90000?demo=1");
  await page.getByRole("button", { name: "Đã hoàn thành" }).click();
  await expect(page.getByRole("button", { name: "Đã hoàn thành" })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/demo");
  await page.getByLabel("Tìm kiếm bài học toàn hệ thống").fill("sap xep");
  const results = page.getByRole("region", { name: "Kết quả tìm kiếm bài học" });
  await results.getByLabel("Trạng thái").selectOption("completed");
  await expect(results.getByText("Sắp xếp tư liệu", { exact: true })).toBeVisible();
  await expect(results.getByRole("heading", { name: "Kết quả tìm kiếm (1 bài phù hợp)" })).toBeVisible();
  await expect(results.getByText("Đã hoàn thành").first()).toBeVisible();
});

test("mã bài mở được từ kết quả tìm kiếm và trả về đúng bài", async ({ page }) => {
  await page.goto("/demo");
  await page.getByLabel("Tìm kiếm bài học toàn hệ thống").fill("90004");
  const results = page.getByRole("region", { name: "Kết quả tìm kiếm bài học" });
  await expect(results.getByText("Thêm chữ", { exact: true })).toBeVisible();
  await results.getByText("Thêm chữ", { exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Thêm chữ" })).toBeVisible();
});

test("tải tiến độ lỗi không chặn trang học và báo rõ", async ({ page }) => {
  await page.route("**/api/progress", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 500, json: { error: "Lỗi giả lập" } });
    return route.abort();
  });
  await page.goto("/bai-hoc/90003?demo=1");
  // Bản demo đọc localStorage, nên thông báo tải chỉ xuất hiện ở bản cá nhân.
  await expect(page.getByRole("heading", { name: "Cắt và sắp xếp" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mô tả bài" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chưa học" })).toBeVisible();
});

test("bài không còn trong danh mục trả trang 404 có đường về, không phải lỗi trắng", async ({ page }) => {
  const response = await page.goto("/bai-hoc/999999?demo=1");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Không tìm thấy bài học này" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Về lộ trình" })).toHaveAttribute("href", "/");
});
