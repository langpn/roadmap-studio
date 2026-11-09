/**
 * Đọc liên kết HLS của một video Bunny Stream từ trang nhúng chính thức.
 *
 * Máy chủ chỉ gửi yêu cầu tới đúng host nhúng `iframe.mediadelivery.net`, với
 * Referer là origin của chính ứng dụng (không mạo danh website nguồn), không
 * kèm cookie hay thông tin đăng nhập của người học. Kết quả trả về chỉ là một
 * URL playlist HTTPS thuộc pull zone `*.b-cdn.net` khớp chính xác mã video.
 *
 * Hàm không bao giờ ném lỗi và không trả nội dung thô của upstream, để route
 * gọi nó có thể phản hồi lỗi chung mà không lộ dữ liệu.
 */

import { normalizeMediaLink } from "./lesson-media-map";

export type ResolveBunnyStreamOptions = {
  embedUrl: string;
  videoId: string;
  refererOrigin: string;
  fetchImpl?: typeof fetch;
  /** Giới hạn số byte đọc từ HTML của iframe. */
  maxBytes?: number;
  /** Giới hạn thời gian chờ iframe. */
  timeoutMs?: number;
};

export type ResolveBunnyStreamResult =
  | { ok: true; url: string }
  | { ok: false; reason: "invalid-embed" | "invalid-origin" | "fetch-failed" | "not-html" | "too-large" | "no-playlist" };

export type ParsedBunnyEmbed = { libraryId: string; videoId: string; url: string };

const BUNNY_EMBED_HOST = "iframe.mediadelivery.net";
const BUNNY_EMBED_PATH = /^\/embed\/(\d+)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PULL_ZONE_HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.b-cdn\.net$/;
const MAX_BYTES_DEFAULT = 512 * 1024;
const TIMEOUT_MS_DEFAULT = 8000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 256;
const playlistCache = new Map<string, { url: string; expiresAt: number }>();

export function clearBunnyStreamCache(): void {
  playlistCache.clear();
}

/** Liên kết nhúng hợp lệ: HTTPS, đúng host, đúng thư viện, UUID thường. */
export function parseBunnyEmbedUrl(rawUrl: unknown): ParsedBunnyEmbed | null {
  if (typeof rawUrl !== "string") return null;
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== BUNNY_EMBED_HOST) return null;
  if (url.port || url.username || url.password) return null;
  if (url.search || url.hash) return null;
  const match = url.pathname.match(BUNNY_EMBED_PATH);
  if (!match) return null;
  const canonical = normalizeMediaLink(url.href);
  if (!canonical || canonical.kind !== "bunny" || canonical.embedUrl !== url.href) return null;
  return { libraryId: match[1], videoId: match[2], url: `https://${BUNNY_EMBED_HOST}/embed/${match[1]}/${match[2]}` };
}

/**
 * Origin dùng làm Referer, lấy từ URL cấu hình của chính ứng dụng.
 * Trả `null` cho giá trị không phải http/https hoặc có thông tin đăng nhập.
 */
export function refererOriginFromBase(base: unknown): string | null {
  if (typeof base !== "string" || base.trim() === "") return null;
  let url: URL;
  try {
    url = new URL(base.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  return url.origin;
}

/** Giải mã các escape thường gặp của dữ liệu JSON trong thẻ script. */
function decodeScriptEscapes(html: string): string {
  return html.replace(/\\\//g, "/").replace(/&amp;/g, "&");
}

function normalizeCandidate(raw: string): string {
  let value = raw.trim();
  // Dấu câu đứng ngay sau URL trong JSON/JS không thuộc về URL.
  // Không cắt `;` hay `&` để không làm hỏng token do upstream tạo.
  value = value.replace(/[),]+$/, "");
  return value;
}

function isPlaylistCandidate(value: string, videoId: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.port || url.username || url.password) return null;
  if (url.hash) return null;
  if (!PULL_ZONE_HOST.test(url.hostname)) return null;
  if (url.pathname !== `/${videoId}/playlist.m3u8`) return null;
  return `${url.origin}${url.pathname}${url.search}`;
}

/**
 * Tìm URL playlist đúng mã video trong HTML của iframe.
 *
 * Chỉ chấp nhận escape JSON `\/` và entity `&amp;`. Các escape lạ như
 * `\u002F` hay `\x2F` bị bỏ qua thay vì đoán, và mọi ứng viên đều phải qua
 * kiểm tra host/path chặt chẽ. Query do upstream tạo (ví dụ token có thời hạn)
 * được giữ nguyên, không log.
 */
export function extractPlaylistUrl(html: unknown, videoId: unknown): string | null {
  if (typeof html !== "string" || html === "") return null;
  if (typeof videoId !== "string" || !UUID.test(videoId)) return null;

  // shortcut: relies on playlist URLs in iframe HTML; use a documented API if the format changes.
  const haystack = decodeScriptEscapes(html);
  const candidates = haystack.match(/https:\/\/[^\s"'<>`\\]+/gi) ?? [];
  for (const candidate of candidates) {
    const url = isPlaylistCandidate(normalizeCandidate(candidate), videoId);
    if (url) return url;
  }
  return null;
}

/** Đọc tối đa `maxBytes` từ body, dừng ngay khi vượt giới hạn. */
async function readBoundedText(response: Response, maxBytes: number): Promise<string | null> {
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    const size = Number(declared);
    if (Number.isFinite(size) && size > maxBytes) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return text;
}

function isHtml(contentType: string | null): boolean {
  if (!contentType) return false;
  const value = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return value === "text/html" || value === "application/xhtml+xml";
}

/**
 * Gọi trang nhúng và trích playlist HLS. Không tự tải playlist, không proxy
 * nội dung video, không chuyển tiếp cookie hay URL do client cung cấp.
 */
export async function resolveBunnyStream(options: ResolveBunnyStreamOptions): Promise<ResolveBunnyStreamResult> {
  const embed = parseBunnyEmbedUrl(options.embedUrl);
  if (!embed) return { ok: false, reason: "invalid-embed" };
  if (typeof options.videoId !== "string" || options.videoId !== embed.videoId) {
    return { ok: false, reason: "invalid-embed" };
  }

  const origin = refererOriginFromBase(options.refererOrigin);
  if (!origin) return { ok: false, reason: "invalid-origin" };

  const maxBytes = options.maxBytes ?? MAX_BYTES_DEFAULT;
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS_DEFAULT;
  const fetchImpl = options.fetchImpl ?? fetch;
  const cacheKey = options.fetchImpl || options.maxBytes !== undefined || options.timeoutMs !== undefined
    ? null : `${origin}|${embed.url}`;
  if (cacheKey) {
    const cached = playlistCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return { ok: true, url: cached.url };
    playlistCache.delete(cacheKey);
  }

  let response: Response;
  try {
    response = await fetchImpl(embed.url, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        // Chỉ nói rõ origin của ứng dụng, không mạo danh website nguồn.
        referer: `${origin}/`,
        accept: "text/html,application/xhtml+xml",
      },
    });
  } catch {
    return { ok: false, reason: "fetch-failed" };
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return { ok: false, reason: "fetch-failed" };
  }
  if (!isHtml(response.headers.get("content-type"))) {
    await response.body?.cancel().catch(() => undefined);
    return { ok: false, reason: "not-html" };
  }

  let html: string | null;
  try {
    html = await readBoundedText(response, maxBytes);
  } catch {
    return { ok: false, reason: "fetch-failed" };
  }
  if (html === null) return { ok: false, reason: "too-large" };

  const url = extractPlaylistUrl(html, embed.videoId);
  if (!url) return { ok: false, reason: "no-playlist" };
  if (cacheKey && !new URL(url).search) {
    if (playlistCache.size >= CACHE_MAX) {
      const oldest = playlistCache.keys().next().value;
      if (oldest) playlistCache.delete(oldest);
    }
    playlistCache.set(cacheKey, { url, expiresAt: Date.now() + CACHE_TTL_MS });
  }
  return { ok: true, url };
}
