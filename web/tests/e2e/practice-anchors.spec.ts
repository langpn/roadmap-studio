import { expect, test } from "@playwright/test";

// Chạy với máy chủ đang có: E2E_BASE_URL=http://127.0.0.1:3001 pnpm exec playwright test tests/e2e/practice-anchors.spec.ts

test("mốc thực hành trên trục nằm sau bài Elite liên quan cuối cùng", async ({ page }) => {
  await page.goto("/demo");
  const roadmap = page.getByRole("region", { name: "Lộ trình mẫu" });
  await expect(roadmap).toBeVisible();

  // Đọc thứ tự node như người học thấy, không dựa vào class nội bộ.
  const order = await roadmap.evaluate((root) =>
    [...root.querySelectorAll("li[data-kind]")].map((node) => ({
      kind: node.getAttribute("data-kind"),
      title: node.querySelector("strong")?.textContent?.trim() ?? "",
    })),
  );

  expect(order.length).toBeGreaterThan(0);
  // Cắt một đoạn nói rõ ý tham chiếu 90003; Cắt lời theo brief mẫu tham chiếu 90003;
  // Thử chữ và đồ họa chuyển động tham chiếu 90004. Mốc phải đứng ngay sau bài cuối.
  const lessonIndex = (title: string) => order.findIndex((node) => node.kind === "lesson" && node.title === title);
  const practiceIndex = (title: string) => order.findIndex((node) => node.kind !== "lesson" && node.title === title);

  expect(practiceIndex("Cắt một đoạn nói rõ ý")).toBeGreaterThan(lessonIndex("Cắt và sắp xếp"));
  expect(practiceIndex("Cắt lời theo brief mẫu")).toBeGreaterThan(lessonIndex("Cắt và sắp xếp"));
  expect(practiceIndex("Thử chữ và đồ họa chuyển động")).toBeGreaterThan(lessonIndex("Thêm chữ"));

  // Bài thực hành không có neo không được nằm trên trục.
  expect(practiceIndex("Tạo portfolio mẫu")).toBe(-1);
});

test("mở mốc thực hành trên trục và giữ đúng mã khi quay lại", async ({ page }) => {
  await page.goto("/demo");
  const roadmap = page.getByRole("region", { name: "Lộ trình mẫu" });
  await roadmap.getByRole("button", { name: /Cắt một đoạn nói rõ ý/ }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Cắt một đoạn nói rõ ý" })).toBeVisible();
  // Cùng một mã thực hành với lối vào từ danh sách Bài thực hành.
  await expect(dialog.getByRole("button", { name: "Chưa làm" })).toHaveAttribute("aria-pressed", "true");
});
