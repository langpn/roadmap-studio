import { expect, type Page } from "@playwright/test";
import { origin, test } from "./media-fixture";

test.skip(process.env.E2E_MEDIA !== "1", "Chỉ chạy với máy chủ và dữ liệu giả lập riêng.");

const lessonId = "90000";
const embedUrl = "https://iframe.mediadelivery.net/embed/431650/00000000-0000-4000-8000-000000000001";
const streamUrl = "https://fixture.b-cdn.net/00000000-0000-4000-8000-000000000001/playlist.m3u8";
const playlist = [
  "#EXTM3U",
  "#EXT-X-VERSION:3",
  "#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=640x360",
  "360p.m3u8",
  "#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=1920x1080",
  "1080p.m3u8",
  "",
].join("\n");

async function openLesson(page: Page, streamAvailable: boolean | "invalid-playlist", masterPlaylist = playlist) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === `/api/lesson-media/${lessonId}/stream`) {
      return streamAvailable
        ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: streamUrl }) })
        : route.fulfill({ status: 422, contentType: "application/json", body: "{}" });
    }
    if (url.hostname === "fixture.b-cdn.net") {
      // Giữ luồng tải ở trạng thái thử lại; fixture chỉ cung cấp danh sách, không lưu tệp video.
      if (url.pathname.endsWith("/segment.ts")) return route.fulfill({ status: 503, headers: { "Access-Control-Allow-Origin": "*" } });
      return route.fulfill({
        status: 200,
        contentType: "application/vnd.apple.mpegurl",
        headers: { "Access-Control-Allow-Origin": "*" },
        body: streamAvailable === "invalid-playlist" ? "không phải danh sách video"
          : url.pathname.endsWith("/playlist.m3u8")
          ? masterPlaylist
          : "#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\nsegment.ts\n#EXT-X-ENDLIST\n",
      });
    }
    if (url.hostname === "iframe.mediadelivery.net") {
      return route.fulfill({ status: 200, contentType: "text/html", body: "<p>Trình phát nguồn</p>" });
    }
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return route.abort();
    return route.continue();
  });
  const imported = await page.request.post(`${origin}/api/lesson-media`, {
    headers: { origin }, data: { version: 1, entries: [{ lessonId, embedUrl }] },
  });
  expect(imported.status()).toBe(200);
  await page.goto("/");
  await page.getByLabel("Tìm kiếm bài học toàn hệ thống").fill("Sắp xếp tư liệu");
  await page.getByRole("region", { name: "Kết quả tìm kiếm bài học" }).getByText("Sắp xếp tư liệu", { exact: true }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Mở trang học" }).click();
  return page;
}

test("thanh điều khiển nằm trên video, ẩn khi đang phát và hiện lại khi rê chuột", async ({ page }) => {
  const detail = await openLesson(page, true);
  const video = detail.locator("video");
  const controls = detail.getByRole("group", { name: "Điều khiển video" });
  await expect(controls.getByRole("button", { name: "Phát", exact: true })).toBeEnabled();
  const videoBox = await video.boundingBox();
  const controlsBox = await controls.boundingBox();
  expect(videoBox).not.toBeNull();
  expect(controlsBox).not.toBeNull();
  expect(controlsBox!.y + controlsBox!.height).toBeLessThanOrEqual(videoBox!.y + videoBox!.height);

  await page.mouse.move(videoBox!.x + videoBox!.width / 2, videoBox!.y + videoBox!.height / 3);
  await video.evaluate((element: HTMLVideoElement) => {
    Object.defineProperty(element, "paused", { configurable: true, get: () => false });
    element.dispatchEvent(new Event("play"));
  });
  await expect(controls).toHaveCSS("opacity", "0", { timeout: 5000 });
  await page.mouse.move(videoBox!.x + videoBox!.width / 2 + 5, videoBox!.y + videoBox!.height / 3);
  await expect(controls).toHaveCSS("opacity", "1");
  await page.keyboard.press("Tab");
  await controls.getByRole("button", { name: "Cài đặt video" }).focus();
  await page.waitForTimeout(2800); // Kiểm tra điều khiển vẫn hiện sau khoảng tự ẩn.
  await expect(controls).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(detail.getByRole("group", { name: "Cài đặt video" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail.getByRole("group", { name: "Cài đặt video" })).toHaveCount(0);
  await expect(controls.getByRole("button", { name: "Cài đặt video" })).toBeFocused();
});

test("trình phát riêng đổi tốc độ và chọn chất lượng có trong video", async ({ page }) => {
  const detail = await openLesson(page, true);
  const video = detail.locator("video");
  await expect(video).toBeVisible();
  await expect(video).toHaveJSProperty("controls", false);
  await expect(video).toHaveAttribute("poster", "https://fixture.b-cdn.net/00000000-0000-4000-8000-000000000001/thumbnail.jpg");
  const settings = detail.getByRole("group", { name: "Cài đặt video" });
  await detail.getByRole("button", { name: "Cài đặt video" }).click();
  await settings.getByRole("button", { name: /Tốc độ phát/ }).click();
  await settings.getByRole("button", { name: "1.5×" }).click();
  await expect(video).toHaveJSProperty("playbackRate", 1.5);
  await expect(settings.getByRole("button", { name: /Tốc độ phát/ })).toContainText("1.5×");
  await settings.getByRole("button", { name: /Chất lượng/ }).click();
  const quality = settings.getByRole("group", { name: "Chất lượng video" }).getByRole("button");
  await expect(quality).toHaveText(["Tự động", "1080p", "360p"]);
  const selectedPlaylist = page.waitForRequest((request) => new URL(request.url()).pathname.endsWith("/1080p.m3u8"));
  await settings.getByRole("button", { name: "1080p" }).click();
  await expect(settings.getByRole("button", { name: /Chất lượng/ })).toContainText("1080p");
  await expect(detail.locator("iframe")).toHaveCount(0);
  await detail.getByRole("button", { name: "Đóng cài đặt" }).click();
  await detail.getByRole("button", { name: "Phát", exact: true }).click();
  await selectedPlaylist;
});

test("phím tắt giống YouTube và hiện phản hồi trên video", async ({ page }) => {
  const detail = await openLesson(page, true);
  const video = detail.locator("video");
  await expect(detail.getByRole("button", { name: "Phát", exact: true })).toBeEnabled();
  await video.evaluate((element: HTMLVideoElement) => {
    Object.defineProperty(element, "duration", { configurable: true, get: () => 120 });
    element.currentTime = 30;
    element.volume = 0.5;
    element.dispatchEvent(new Event("durationchange"));
  });
  await video.focus();
  await page.keyboard.press("l");
  await expect(detail.getByText("+10 giây")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(video).toHaveJSProperty("volume", 0.45);
  await page.keyboard.press("m");
  await expect(video).toHaveJSProperty("muted", true);
  await page.keyboard.press("5");
  await expect(video).toHaveJSProperty("currentTime", 60);
});

test("chuẩn bị đoạn đầu nhưng không tự phát", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => { if (request.url().endsWith("segment.ts")) requests.push(request.url()); });
  const detail = await openLesson(page, true);
  await expect(detail.getByRole("button", { name: "Phát", exact: true })).toBeEnabled();
  await expect.poll(() => requests.length, { timeout: 4000 }).toBeGreaterThan(0);
  await expect(detail.locator("video")).toHaveJSProperty("paused", true);
});

test("hiển thị mọi chất lượng thực có, kể cả video dọc", async ({ page }) => {
  const manifest = [
    "#EXTM3U",
    "#EXT-X-STREAM-INF:BANDWIDTH=200000,RESOLUTION=426x240", "240p.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=400000,RESOLUTION=640x360", "360p.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=700000,RESOLUTION=854x480", "480p.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=720x1280", "720p.m3u8",
    "#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1920x1080", "1080p.m3u8",
    "",
  ].join("\n");
  const detail = await openLesson(page, true, manifest);
  await detail.getByRole("button", { name: "Cài đặt video" }).click();
  const settings = detail.getByRole("group", { name: "Cài đặt video" });
  await settings.getByRole("button", { name: /Chất lượng/ }).click();
  const options = settings.getByRole("group", { name: "Chất lượng video" }).getByRole("button");
  await expect(options).toHaveText(["Tự động", "1080p", "720p", "480p", "360p", "240p"]);
  await settings.getByRole("button", { name: "720p" }).click();
  await expect(settings.getByRole("button", { name: /Chất lượng/ })).toContainText("720p");
});

test("không đưa chất lượng 0 kbps vào danh sách khi nguồn không công bố mức", async ({ page }) => {
  const detail = await openLesson(page, true, "#EXTM3U\n#EXT-X-TARGETDURATION:10\n#EXTINF:10,\nsegment.ts\n#EXT-X-ENDLIST\n");
  await detail.getByRole("button", { name: "Cài đặt video" }).click();
  const settings = detail.getByRole("group", { name: "Cài đặt video" });
  await expect(settings.getByRole("button", { name: /Chất lượng/ })).toBeDisabled();
  await expect(settings).not.toContainText("0 kbps");
});

test("không cho tua khi chưa biết thời lượng", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, "duration", { configurable: true, get: () => NaN });
  });
  const detail = await openLesson(page, true);
  const video = detail.locator("video");
  await expect(detail.getByRole("button", { name: "Phát", exact: true })).toBeEnabled();
  await expect(detail.getByRole("button", { name: "Tua tới 10 giây" })).toBeDisabled();
  await video.focus();
  await page.keyboard.press("l");
  await expect(video).toHaveJSProperty("currentTime", 0);
});

test("nút toàn màn hình không bị che khi mở âm lượng ở cửa sổ 480px", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 800 });
  const detail = await openLesson(page, true);
  const video = detail.locator("video");
  const controls = detail.getByRole("group", { name: "Điều khiển video" });
  await expect(controls.getByRole("button", { name: "Tắt tiếng" })).toBeEnabled();
  await controls.getByRole("button", { name: "Tắt tiếng" }).hover();
  const slider = controls.getByRole("slider", { name: "Âm lượng" });
  await expect(slider).toHaveCSS("width", "64px");
  const videoBox = await video.boundingBox();
  const fullBox = await controls.getByRole("button", { name: "Bật toàn màn hình" }).boundingBox();
  expect(videoBox).not.toBeNull();
  expect(fullBox).not.toBeNull();
  expect(fullBox!.x + fullBox!.width).toBeLessThanOrEqual(videoBox!.x + videoBox!.width);
});

test("giữ thanh điều khiển khi đang kéo vị trí video", async ({ page }) => {
  const detail = await openLesson(page, true);
  const video = detail.locator("video");
  const controls = detail.getByRole("group", { name: "Điều khiển video" });
  await expect(controls.getByRole("button", { name: "Phát", exact: true })).toBeEnabled();
  await video.evaluate((element: HTMLVideoElement) => {
    Object.defineProperty(element, "paused", { configurable: true, get: () => false });
    Object.defineProperty(element, "duration", { configurable: true, get: () => 120 });
    element.dispatchEvent(new Event("durationchange"));
    element.dispatchEvent(new Event("play"));
  });
  const timeline = controls.getByRole("slider", { name: "Vị trí video" });
  await expect(timeline).toBeEnabled();
  await timeline.scrollIntoViewIfNeeded();
  const sliderBox = await timeline.boundingBox();
  const videoBox = await video.boundingBox();
  expect(sliderBox).not.toBeNull();
  expect(videoBox).not.toBeNull();
  await page.mouse.move(sliderBox!.x + sliderBox!.width / 2, sliderBox!.y + sliderBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(videoBox!.x + videoBox!.width + 20, videoBox!.y + videoBox!.height / 2);
  await page.waitForTimeout(2800); // Giữ chuột lâu hơn thời gian tự ẩn.
  await expect(controls).toHaveCSS("opacity", "1");
  await page.mouse.up();
});

test("thanh điều khiển vẫn nằm trên video khi bật toàn màn hình", async ({ page }) => {
  const detail = await openLesson(page, true);
  const controls = detail.getByRole("group", { name: "Điều khiển video" });
  await expect(controls.getByRole("button", { name: "Bật toàn màn hình" })).toBeVisible();
  await controls.getByRole("button", { name: "Bật toàn màn hình" }).click();
  await expect(controls.getByRole("button", { name: "Thoát toàn màn hình" })).toBeVisible();
  const videoBox = await detail.locator("video").boundingBox();
  const controlsBox = await controls.boundingBox();
  expect(videoBox).not.toBeNull();
  expect(controlsBox).not.toBeNull();
  expect(controlsBox!.y + controlsBox!.height).toBeLessThanOrEqual(videoBox!.y + videoBox!.height);
  await controls.getByRole("button", { name: "Thoát toàn màn hình" }).click();
});

test("có thể mở lại trình phát gốc khi đang xem bằng trình phát riêng", async ({ page }) => {
  const detail = await openLesson(page, true);
  await expect(detail.getByRole("button", { name: "Cài đặt video" })).toBeEnabled();
  await detail.getByRole("button", { name: "Dùng trình phát gốc" }).click();
  await expect(detail.locator("iframe")).toHaveAttribute("src", `${embedUrl}?autoplay=false`);
});

test("các nút phát, tốc độ và chất lượng dùng được ở chiều rộng 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const detail = await openLesson(page, true);
  const controls = detail.getByRole("group", { name: "Điều khiển video" });
  const surface = detail.locator("video").locator("../..");
  const actualVideo = await detail.locator("video").boundingBox();
  const actualFullscreen = await controls.getByRole("button", { name: "Bật toàn màn hình" }).boundingBox();
  expect(actualVideo).not.toBeNull();
  expect(actualFullscreen).not.toBeNull();
  expect(actualFullscreen!.x + actualFullscreen!.width).toBeLessThanOrEqual(actualVideo!.x + actualVideo!.width);
  await surface.evaluate((element: HTMLElement) => { element.style.maxWidth = "236px"; });
  const videoBox = await detail.locator("video").boundingBox();
  const fullscreenBox = await controls.getByRole("button", { name: "Bật toàn màn hình" }).boundingBox();
  expect(videoBox).not.toBeNull();
  expect(fullscreenBox).not.toBeNull();
  expect(fullscreenBox!.x + fullscreenBox!.width).toBeLessThanOrEqual(videoBox!.x + videoBox!.width);
  await controls.getByRole("button", { name: "Cài đặt video" }).click();
  const settings = detail.getByRole("group", { name: "Cài đặt video" });
  for (const name of [/Tốc độ phát/, /Chất lượng/]) {
    const row = settings.getByRole("button", { name });
    await expect(row).toBeVisible();
    await expect(row).toBeInViewport({ ratio: 1 });
    const box = await row.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  }
  await expect(settings.getByRole("slider", { name: "Âm lượng" })).toBeVisible();
  await settings.getByRole("button", { name: /Chất lượng/ }).click();
  // Khung 236px quá thấp cho cả danh sách; menu tự cuộn để chọn được mục cuối.
  await settings.getByRole("button", { name: "1080p" }).click();
  await expect(settings.getByRole("button", { name: /Chất lượng/ })).toContainText("1080p");
  await detail.getByRole("button", { name: "Đóng cài đặt" }).click();
  const play = await controls.getByRole("button", { name: "Phát", exact: true }).boundingBox();
  const fullscreen = await controls.getByRole("button", { name: "Bật toàn màn hình" }).boundingBox();
  expect(play).not.toBeNull();
  expect(fullscreen).not.toBeNull();
  expect(fullscreen!.y).toBe(play!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("dùng trình phát gốc khi nguồn không hỗ trợ phát trực tiếp", async ({ page }) => {
  const detail = await openLesson(page, false);
  await expect(detail.locator("iframe")).toHaveAttribute("src", `${embedUrl}?autoplay=false`);
  await expect(detail.getByRole("status")).toContainText("Đã chuyển sang trình phát gốc");
  await expect(detail.getByRole("link", { name: "Mở trong thẻ mới" }).first()).toBeVisible();
});

test("trở về trình phát gốc khi danh sách video không phát được", async ({ page }) => {
  const detail = await openLesson(page, "invalid-playlist");
  await expect(detail.locator("iframe")).toHaveAttribute("src", `${embedUrl}?autoplay=false`);
  await expect(detail.getByRole("status")).toContainText("Đã chuyển sang trình phát gốc");
});

test.describe("màn hình cảm ứng", () => {
  test.use({ hasTouch: true, viewport: { width: 320, height: 700 } });

  test("chạm video để hiện và ẩn thanh điều khiển", async ({ page }) => {
    const detail = await openLesson(page, true);
    const video = detail.locator("video");
    const controls = detail.getByRole("group", { name: "Điều khiển video" });
    await expect(controls.getByRole("button", { name: "Phát", exact: true })).toBeEnabled();
    await video.scrollIntoViewIfNeeded();
    await video.evaluate((element: HTMLVideoElement) => {
      Object.defineProperty(element, "paused", { configurable: true, get: () => false });
      element.dispatchEvent(new Event("play"));
    });
    await expect(controls).toHaveCSS("opacity", "0", { timeout: 5000 });
    const box = await video.boundingBox();
    expect(box).not.toBeNull();
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 3);
    await expect(controls).toHaveCSS("opacity", "1");
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 3);
    await expect(controls).toHaveCSS("opacity", "0");
  });
});
