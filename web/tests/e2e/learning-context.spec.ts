import { expect, test } from "@playwright/test";

test("sao chép ngữ cảnh mẫu và báo thành công", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/bai-hoc/90003?demo=1");
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" || new URL(request.url()).origin !== new URL(page.url()).origin) requests.push(request.url());
  });
  await page.getByRole("button", { name: "Sao chép ngữ cảnh cho Obsidian / AI" }).click();
  await expect(page.getByRole("status")).toContainText("Đã sao chép");
  const content = await page.evaluate(() => navigator.clipboard.readText());
  expect(content).toContain("edit-cut");
  expect(content).toContain("?demo=1");
  expect(content).not.toContain("seankangmvp.com");
  expect(requests).toEqual([]);
});

test("cho sao chép thủ công khi trình duyệt chặn clipboard", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("blocked")) } }));
  await page.goto("/bai-hoc/90003?demo=1");
  await page.getByRole("button", { name: "Sao chép ngữ cảnh cho Obsidian / AI" }).click();
  await expect(page.getByRole("textbox", { name: "Ngữ cảnh bài học để sao chép" })).toHaveValue(/edit-cut/);
});

test("sao chép ngữ cảnh từ bài tự luyện", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/demo?practice=edit-cut");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Sao chép ngữ cảnh cho Obsidian / AI" }).click();
  await expect(dialog.getByRole("status")).toContainText("Đã sao chép");
  const content = await page.evaluate(() => navigator.clipboard.readText());
  expect(content).toContain("edit-cut");
  expect(content).toContain("90003?demo=1");
  expect(content).not.toContain("seankangmvp.com");
});

test("bài tự luyện vẫn cho sao chép khi clipboard bị chặn", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("blocked")) } }));
  await page.goto("/demo?practice=edit-cut");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Sao chép ngữ cảnh cho Obsidian / AI" }).click();
  await expect(dialog.getByRole("textbox", { name: "Ngữ cảnh thực hành để sao chép" })).toHaveValue(/edit-cut/);
});
