import { expect, test } from "@playwright/test";

test("tên dài không làm tràn giao diện trên điện thoại", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/demo");
  const longName = "A".repeat(100);
  await page.getByRole("heading", { name: /Không gian học dựng video/ }).evaluate((node, name) => {
    node.textContent = `Không gian học dựng video của ${name}`;
  }, longName);
  await page.getByText("Xin chào, bạn").evaluate((node, name) => {
    node.textContent = `Xin chào, ${name}`;
  }, longName);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
