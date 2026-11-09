import { describe, expect, it, vi } from "vitest";
import {
  extractPlaylistUrl,
  parseBunnyEmbedUrl,
  refererOriginFromBase,
  resolveBunnyStream,
} from "@/lib/media/bunny-stream";

const VIDEO_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";
const EMBED_URL = `https://iframe.mediadelivery.net/embed/431650/${VIDEO_ID}`;
const PULL_ZONE = "https://vz-demo-unit.b-cdn.net";
// Dựng từ mảnh, không phải thông tin đăng nhập thật.
const CRED = ["no", "real", "creds"].join("-");
const TOKEN = ["demo", "token"].join("-");
const PLAYLIST_URL = `${PULL_ZONE}/${VIDEO_ID}/playlist.m3u8`;

function pageWith(value: string): string {
  return `<html><body><script>window.__PLAYER__={"playlist":"${value}","title":"demo"};</script></body></html>`;
}

function jsonEscaped(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

function htmlResponse(body: string, contentType = "text/html; charset=utf-8"): Response {
  return new Response(body, { status: 200, headers: { "content-type": contentType } });
}

function resolve(fetchImpl: typeof fetch, overrides: Partial<Parameters<typeof resolveBunnyStream>[0]> = {}) {
  return resolveBunnyStream({
    embedUrl: EMBED_URL,
    videoId: VIDEO_ID,
    refererOrigin: "http://localhost:3000",
    fetchImpl,
    ...overrides,
  });
}

describe("đọc liên kết nhúng Bunny", () => {
  it("chỉ nhận đúng host nhúng, đúng thư viện và mã video UUID", () => {
    expect(parseBunnyEmbedUrl(EMBED_URL)).toEqual({
      libraryId: "431650",
      videoId: VIDEO_ID,
      url: EMBED_URL,
    });
    expect(parseBunnyEmbedUrl(EMBED_URL.toUpperCase())).toBeNull();
  });

  it("từ chối host lạ, giao thức khác, port, credentials, query và hash", () => {
    for (const value of [
      `http://iframe.mediadelivery.net/embed/431650/${VIDEO_ID}`,
      `https://iframe.mediadelivery.net.evil.invalid/embed/431650/${VIDEO_ID}`,
      `https://evil.invalid/embed/431650/${VIDEO_ID}`,
      `https://user:${CRED}@iframe.mediadelivery.net/embed/431650/${VIDEO_ID}`,
      `https://iframe.mediadelivery.net:8443/embed/431650/${VIDEO_ID}`,
      `https://iframe.mediadelivery.net/embed/431650/${VIDEO_ID}?autoplay=1`,
      `https://iframe.mediadelivery.net/embed/431650/${VIDEO_ID}#fragment`,
      `https://iframe.mediadelivery.net/embed/431650/${VIDEO_ID}/extra`,
      `https://iframe.mediadelivery.net/embed/not-a-library/${VIDEO_ID}`,
      `https://iframe.mediadelivery.net/embed/999999/${VIDEO_ID}`,
      `https://iframe.mediadelivery.net/embed/431650/not-a-video`,
      "not a url",
      "",
    ]) {
      expect(parseBunnyEmbedUrl(value), value).toBeNull();
    }
    expect(parseBunnyEmbedUrl(undefined)).toBeNull();
    expect(parseBunnyEmbedUrl(42)).toBeNull();
  });
});

describe("trích playlist HLS từ HTML của iframe", () => {
  it("nhận liên kết HTTPS đúng pull zone và đúng mã video", () => {
    expect(extractPlaylistUrl(pageWith(PLAYLIST_URL), VIDEO_ID)).toBe(PLAYLIST_URL);
  });

  it("nhận liên kết bị escape dấu gạch chéo trong JSON", () => {
    expect(extractPlaylistUrl(pageWith(jsonEscaped(PLAYLIST_URL)), VIDEO_ID)).toBe(PLAYLIST_URL);
  });

  it("giữ query token do upstream tạo và giải mã entity HTML cơ bản", () => {
    const withToken = `${PLAYLIST_URL}?token=${TOKEN}&amp;expires=1`;
    expect(extractPlaylistUrl(pageWith(withToken), VIDEO_ID)).toBe(`${PLAYLIST_URL}?token=${TOKEN}&expires=1`);
  });

  it("từ chối mã video khác, path khác và tên miền giả mạo", () => {
    for (const value of [
      `${PULL_ZONE}/${OTHER_ID}/playlist.m3u8`,
      `${PULL_ZONE}/${VIDEO_ID}/index.m3u8`,
      `${PULL_ZONE}/${VIDEO_ID}/playlist.m3u8.backup`,
      `http://vz-demo-unit.b-cdn.net/${VIDEO_ID}/playlist.m3u8`,
      `https://vz-demo-unit.b-cdn.net:8443/${VIDEO_ID}/playlist.m3u8`,
      `https://user:${CRED}@vz-demo-unit.b-cdn.net/${VIDEO_ID}/playlist.m3u8`,
      `https://vz-demo-unit.b-cdn.net.evil.invalid/${VIDEO_ID}/playlist.m3u8`,
      `https://evildemo.b-cdn.net.evil.invalid/${VIDEO_ID}/playlist.m3u8`,
      `https://vz-demo-unit.b-cdn.net/${VIDEO_ID}/playlist.m3u8#fragment`,
      "https://evil.invalid/playlist.m3u8",
    ]) {
      expect(extractPlaylistUrl(pageWith(value), VIDEO_ID), value).toBeNull();
    }
  });

  it("từ chối escape JavaScript bất thường thay vì tự đoán", () => {
    const unicodeEscaped = PLAYLIST_URL.replace(/\//g, "\\u002F");
    const hexEscaped = PLAYLIST_URL.replace(/\//g, "\\x2F");
    expect(extractPlaylistUrl(pageWith(unicodeEscaped), VIDEO_ID)).toBeNull();
    expect(extractPlaylistUrl(pageWith(hexEscaped), VIDEO_ID)).toBeNull();
    expect(extractPlaylistUrl("<html>không có liên kết</html>", VIDEO_ID)).toBeNull();
    expect(extractPlaylistUrl(undefined, VIDEO_ID)).toBeNull();
    expect(extractPlaylistUrl(pageWith(PLAYLIST_URL), "not-a-uuid")).toBeNull();
  });
});

describe("gọi iframe Bunny phía máy chủ", () => {
  it("chỉ gửi Referer đúng origin cấu hình và không chuyển cookie của người học", async () => {
    const fetchMock = vi.fn(async () => htmlResponse(pageWith(PLAYLIST_URL)));
    const result = await resolve(fetchMock as unknown as typeof fetch);

    expect(result).toEqual({ ok: true, url: PLAYLIST_URL });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(EMBED_URL);
    expect(init).toMatchObject({ method: "GET", redirect: "error", cache: "no-store" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.headers).toEqual({
      referer: "http://localhost:3000/",
      accept: "text/html,application/xhtml+xml",
    });
    expect(JSON.stringify(init.headers)).not.toMatch(/cookie|authorization/i);
  });

  it("không gọi mạng khi liên kết nhúng không hợp lệ hoặc origin cấu hình hỏng", async () => {
    const fetchMock = vi.fn();
    expect(await resolve(fetchMock as unknown as typeof fetch, { embedUrl: "https://evil.invalid/embed/431650/x" }))
      .toEqual({ ok: false, reason: "invalid-embed" });
    expect(await resolve(fetchMock as unknown as typeof fetch, { videoId: OTHER_ID }))
      .toEqual({ ok: false, reason: "invalid-embed" });
    expect(await resolve(fetchMock as unknown as typeof fetch, { refererOrigin: "javascript:alert(1)" }))
      .toEqual({ ok: false, reason: "invalid-origin" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("báo lỗi an toàn khi mạng hỏng, redirect hoặc HTTP lỗi", async () => {
    expect(await resolve(vi.fn(async () => { throw new TypeError("redirect not allowed"); }) as unknown as typeof fetch))
      .toEqual({ ok: false, reason: "fetch-failed" });
    expect(await resolve(vi.fn(async () => new Response("nope", { status: 403 })) as unknown as typeof fetch))
      .toEqual({ ok: false, reason: "fetch-failed" });
    expect(await resolve(vi.fn(async () => htmlResponse(pageWith(PLAYLIST_URL), "application/json")) as unknown as typeof fetch))
      .toEqual({ ok: false, reason: "not-html" });
  });

  it("giới hạn dung lượng response thay vì đọc vô hạn", async () => {
    const huge = pageWith(PLAYLIST_URL) + "x".repeat(4096);
    const fetchMock = vi.fn(async () => htmlResponse(huge));
    expect(await resolve(fetchMock as unknown as typeof fetch, { maxBytes: 512 }))
      .toEqual({ ok: false, reason: "too-large" });
  });

  it("từ chối sớm khi content-length vượt giới hạn, không đọc body", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const fetchMock = vi.fn(async () => new Response(body, {
      status: 200,
      headers: { "content-type": "text/html", "content-length": "999999" },
    }));
    expect(await resolve(fetchMock as unknown as typeof fetch, { maxBytes: 1024 }))
      .toEqual({ ok: false, reason: "too-large" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("không chấp nhận content-type không phải HTML dù body có URL", async () => {
    const fetchMock = vi.fn(async () => new Response(pageWith(PLAYLIST_URL), {
      status: 200,
      headers: { "content-type": "text/plain" },
    }));
    expect(await resolve(fetchMock as unknown as typeof fetch)).toEqual({ ok: false, reason: "not-html" });
  });

  it("bỏ qua URL playlist kèm fragment hoặc cổng lạ", async () => {
    for (const value of [
      `${PLAYLIST_URL}#t=1`,
      `https://vz-demo-unit.b-cdn.net:8443/${VIDEO_ID}/playlist.m3u8`,
    ]) {
      const fetchMock = vi.fn(async () => htmlResponse(pageWith(value)));
      expect(await resolve(fetchMock as unknown as typeof fetch), value).toEqual({ ok: false, reason: "no-playlist" });
    }
  });

  it("trả no-playlist khi HTML không có URL phù hợp", async () => {
    const fetchMock = vi.fn(async () => htmlResponse("<html>không có gì</html>"));
    expect(await resolve(fetchMock as unknown as typeof fetch)).toEqual({ ok: false, reason: "no-playlist" });
  });
});

describe("origin Referer từ cấu hình", () => {
  it("chỉ nhận URL http/https và trả origin, bỏ path", () => {
    expect(refererOriginFromBase("https://studio.example.invalid/app")).toBe("https://studio.example.invalid");
    expect(refererOriginFromBase("http://127.0.0.1:3001")).toBe("http://127.0.0.1:3001");
    for (const value of [undefined, "", "not a url", "javascript:alert(1)", "ftp://example.invalid", `https://user:${CRED}@example.invalid`]) {
      expect(refererOriginFromBase(value), String(value)).toBeNull();
    }
  });
});
