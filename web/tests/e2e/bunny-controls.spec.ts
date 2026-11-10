import { expect, type Page } from "@playwright/test";
import { origin, test } from "./media-fixture";

test.skip(process.env.E2E_MEDIA !== "1", "Chỉ chạy với máy chủ và dữ liệu giả lập riêng.");

const lessonId = "90000";
const embedUrl = "https://iframe.mediadelivery.net/embed/431650/00000000-0000-4000-8000-000000000001";

// Substitute the remote provider boundary; the page and the controls are real.
const playerSdk = `
  window.playerjs = {
    Player: class {
      constructor() {
        this.listeners = {};
        this.time = 0;
        this.volume = 100;
        this.paused = true;
        window.__fixturePlayer = this;
      }
      on(name, callback) {
        (this.listeners[name] ||= []).push(callback);
        if (name === 'ready') setTimeout(() => this.emit('ready'), 0);
      }
      off(name) { this.listeners[name] = []; }
      emit(name, data) { for (const callback of this.listeners[name] || []) callback(data); }
      supports(_kind, name) { return name !== 'setPlaybackRate'; }
      getDuration(callback) { callback(120); }
      getCurrentTime(callback) { callback(this.time); }
      getVolume(callback) { callback(this.volume); }
      getPaused(callback) { callback(this.paused); }
      getMuted(callback) { callback(this.volume === 0); }
      play() { this.paused = false; this.emit('play'); this.emit('timeupdate', { seconds: this.time, duration: 120 }); }
      pause() { this.paused = true; this.emit('pause'); }
      setCurrentTime(value) { this.time = value; this.emit('timeupdate', { seconds: value, duration: 120 }); }
      setVolume(value) { this.volume = value; }
      mute() { this.setVolume(0); }
      unmute() { this.setVolume(100); }
    }
  };
`;

async function openLesson(page: Page, sdkAvailable: boolean, volumeSupported = true) {
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === `/api/lesson-media/${lessonId}/stream`) {
      return route.fulfill({ status: 422, contentType: "application/json", body: "{}" });
    }
    if (url.hostname === "assets.mediadelivery.net") {
      return sdkAvailable
        ? route.fulfill({
          status: 200,
          contentType: "application/javascript",
          body: volumeSupported ? playerSdk : playerSdk.replace("name !== 'setPlaybackRate'", "!['setPlaybackRate', 'getVolume', 'setVolume'].includes(name)"),
        })
        : route.abort();
    }
    if (url.hostname === "iframe.mediadelivery.net") {
      return route.fulfill({ status: 200, contentType: "text/html", body: "<p>Trình phát giả lập</p>" });
    }
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") return route.abort();
    return route.continue();
  });
  const imported = await page.request.post(`${origin}/api/lesson-media`, {
    headers: { origin },
    data: { version: 1, entries: [{ lessonId, embedUrl }] },
  });
  expect(imported.status()).toBe(200);
  await page.goto("/");
  await page.getByLabel("Tìm kiếm bài học toàn hệ thống").fill("Sắp xếp tư liệu");
  await page.getByRole("region", { name: "Kết quả tìm kiếm bài học" }).getByText("Sắp xếp tư liệu", { exact: true }).click();
  const href = await page.getByRole("dialog").getByRole("link", { name: "Mở trang học" }).getAttribute("href");
  await page.goto(href!);
  return page;
}

test("nút riêng điều khiển phát, tạm dừng, tua và âm lượng của video Bunny", async ({ page }) => {
  const detail = await openLesson(page, true);
  await expect(detail.locator("iframe")).toHaveAttribute("src", `${embedUrl}?autoplay=false`);
  const controls = detail.getByRole("group", { name: "Điều khiển video" });
  const play = controls.getByRole("button", { name: "Phát", exact: true });
  await expect(play).toBeEnabled();
  await play.click();
  await expect(controls.getByRole("button", { name: "Tạm dừng", exact: true })).toBeEnabled();
  await controls.getByRole("button", { name: "Tua tới 10 giây" }).click();
  await expect(controls.getByRole("slider", { name: "Vị trí video" })).toHaveValue("10");
  await controls.getByRole("button", { name: "Tua lùi 10 giây" }).click();
  await expect(controls.getByRole("slider", { name: "Vị trí video" })).toHaveValue("0");
  await controls.getByRole("slider", { name: "Vị trí video" }).fill("45");
  await expect(controls.getByRole("slider", { name: "Vị trí video" })).toHaveValue("45");
  await controls.getByRole("slider", { name: "Âm lượng" }).fill("50");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __fixturePlayer: { volume: number } }).__fixturePlayer.volume)).toBe(50);
  await controls.getByRole("button", { name: "Tạm dừng", exact: true }).click();
  await expect(controls.getByRole("button", { name: "Phát", exact: true })).toBeEnabled();
  await expect(controls.getByRole("button", { name: /Tốc độ/ })).toHaveCount(0);
});

test("vẫn có thể dùng trình phát gốc khi bộ điều khiển riêng không kết nối được", async ({ page }) => {
  const detail = await openLesson(page, false);
  await expect(detail.getByText(/Không kết nối được điều khiển/)).toBeVisible();
  await expect(detail.locator("iframe")).toHaveAttribute("src", `${embedUrl}?autoplay=false`);
  await expect(detail.getByRole("link", { name: "Mở trong thẻ mới" }).first()).toBeVisible();
});

test("không hiển thị âm lượng riêng nếu trình phát không hỗ trợ", async ({ page }) => {
  const detail = await openLesson(page, true, false);
  const controls = detail.getByRole("group", { name: "Điều khiển video" });
  await expect(controls.getByRole("button", { name: "Phát", exact: true })).toBeEnabled();
  await expect(controls.getByRole("slider", { name: "Âm lượng" })).toHaveCount(0);
});
