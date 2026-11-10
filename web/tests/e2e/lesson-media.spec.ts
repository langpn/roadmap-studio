import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import { origin, test } from "./media-fixture";
import { createBulkCollectorScript, toBookmarkletHref } from "../../src/lib/media/collector-script";

test.skip(process.env.E2E_MEDIA !== "1", "Chỉ chạy với máy chủ và dữ liệu giả lập riêng.");

const lessonId = process.env.E2E_MEDIA_LESSON_ID ?? "90000";
const embedUrl = "https://iframe.mediadelivery.net/embed/431650/00000000-0000-4000-8000-000000000001";

test("nút thu tất cả tạo một tệp chứa liên kết từ nhiều chương", async ({ page }) => {
  const paths = ["/courses/sample/chapters/1/lessons", "/courses/sample/chapters/2/lessons"];
  await page.route("https://seankangmvp.com/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/courses") return route.fulfill({ contentType: "text/html", body: "<html><body>Trang khóa học thử</body></html>" });
    const id = paths.indexOf(path) + 1;
    return route.fulfill({ contentType: "text/plain", body: `{"lessonId":${id},"videoUrl":"https://www.youtube.com/watch?v=AAAAAAAAAAA"}` });
  });
  await page.goto("https://seankangmvp.com/courses");
  await page.evaluate((href) => {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = "Thu thập tất cả";
    document.body.appendChild(link);
  }, toBookmarkletHref(createBulkCollectorScript(paths.map((path) => `https://seankangmvp.com${path}`))));
  let message = "";
  page.on("dialog", (dialog) => { message = dialog.message(); void dialog.accept(); });
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Thu thập tất cả" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("lesson-media-tat-ca-khoa.json");
  const data = JSON.parse(await readFile(await file.path(), "utf8"));
  expect(data.entries.map((entry: { lessonId: string }) => entry.lessonId)).toEqual(["1", "2"]);
  await expect.poll(() => message).toContain("2 bài");
});

test("nhập tệp liên kết rồi phát video trên trang học riêng", async ({ page, baseURL }) => {
  expect(baseURL).toBe(origin);
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === `/api/lesson-media/${lessonId}/stream`) {
      return route.fulfill({ status: 422, contentType: "application/json", body: "{}" });
    }
    if (url.hostname === "iframe.mediadelivery.net") {
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: "<p>trình phát thử</p>" });
    }
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return route.abort();
    return route.continue();
  });

  await page.goto("/thu-thap");
  await expect(page.getByRole("heading", { name: /Thu thập liên kết phát/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Thu thập liên kết tất cả" })).toHaveAttribute("href", /^javascript:/);
  await expect(page.getByRole("link", { name: "Thu riêng chương" })).toHaveAttribute("href", /^javascript:/);
  const field = page.getByLabel(/Dán nội dung tệp JSON/);
  await expect(field).toBeVisible();

  const file = {
    version: 1,
    collectedAt: new Date().toISOString(),
    entries: [{ lessonId, kind: "bunny", videoId: "00000000-0000-4000-8000-000000000001", embedUrl }],
  };
  await field.fill(JSON.stringify(file));
  await page.getByRole("button", { name: "Nhập liệu" }).click();
  await expect(page.getByRole("status")).toContainText(/Đã nhập 1 liên kết/);

  await page.goto("/");
  await page.getByLabel("Tìm kiếm bài học toàn hệ thống").fill("Sắp xếp tư liệu");
  await page.getByRole("region", { name: "Kết quả tìm kiếm bài học" }).getByText("Sắp xếp tư liệu", { exact: true }).click();
  const detail = page.getByRole("dialog");
  await expect(detail.getByRole("heading", { name: "Sắp xếp tư liệu" })).toBeVisible();
  await expect(detail.locator("iframe")).toHaveCount(0);
  const href = await detail.getByRole("link", { name: "Mở trang học" }).getAttribute("href");
  await page.goto(href!);
  await expect(page).toHaveURL(new RegExp(`/bai-hoc/${lessonId}$`));
  const frame = page.locator("iframe");
  await expect(frame).toHaveAttribute("src", `${embedUrl}?autoplay=false`);
  await expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  await expect(page.getByText(/trình phát chính thức/)).toBeVisible();
});

test("từ chối tệp sai định dạng mà không lưu gì", async ({ page, baseURL }) => {
  expect(baseURL).toBe(origin);
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return route.abort();
    return route.continue();
  });
  await page.goto("/thu-thap");

  const field = page.getByLabel(/Dán nội dung tệp JSON/);
  await field.fill("{ khong phai json");
  await page.getByRole("button", { name: "Nhập liệu" }).click();
  await expect(page.getByText(/Chưa thể nhập dữ liệu/)).toBeVisible();

  const before = await (await page.request.get(`${origin}/api/lesson-media`)).json();
  await field.fill(JSON.stringify({ version: 1, entries: [] }));
  await page.getByRole("button", { name: "Nhập liệu" }).click();
  await expect(page.getByText(/Không tìm thấy liên kết phát nào/)).toBeVisible();
  const after = await (await page.request.get(`${origin}/api/lesson-media`)).json();
  expect(after.entries).toEqual(before.entries);
});
