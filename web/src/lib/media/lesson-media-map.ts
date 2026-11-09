/**
 * Ánh xạ bài học → liên kết phát, do chính người học tự thu thập khi đăng nhập
 * website nguồn (dạng tệp JSON xuất ra từ trình duyệt).
 *
 * Tệp dữ liệu này chỉ chứa liên kết nhúng công khai của Bunny Stream hoặc
 * YouTube. Nó không chứa token, cookie hay thông tin phiên đăng nhập, và mọi
 * liên kết đều được chuẩn hoá lại về đúng hai nhà cung cấp được phép.
 */

export type LessonMediaKind = "bunny" | "youtube";

export type LessonMediaEntry = {
  lessonId: string;
  kind: LessonMediaKind;
  videoId: string;
  embedUrl: string;
};

export type LessonMediaMap = {
  version: 1;
  collectedAt: string;
  entries: LessonMediaEntry[];
};

/** Thư viện Bunny Stream duy nhất được phép nhúng. */
const BUNNY_LIBRARY_ID = "431650";
const BUNNY_HOST = "iframe.mediadelivery.net";
const BUNNY_UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const BUNNY_PATH = new RegExp(`^/embed/${BUNNY_LIBRARY_ID}/(${BUNNY_UUID})$`, "i");

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_EMBED_BASE = "https://www.youtube-nocookie.com/embed/";
const YOUTUBE_WATCH_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);

const EMPTY_MAP_ERROR = "Không tìm thấy liên kết phát nào trong dữ liệu.";

function parseUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl.trim());
    if (url.protocol !== "https:") return null;
    if (url.port || url.username || url.password) return null;
    return url;
  } catch {
    return null;
  }
}

function normalizeBunny(url: URL): { kind: LessonMediaKind; videoId: string; embedUrl: string } | null {
  if (url.hostname !== BUNNY_HOST) return null;
  const match = url.pathname.match(BUNNY_PATH);
  if (!match) return null;
  const videoId = match[1].toLowerCase();
  return {
    kind: "bunny",
    videoId,
    // Query/hash chỉ là tham số hiển thị (autoplay, loop, muted...) nên bị bỏ.
    embedUrl: `https://${BUNNY_HOST}/embed/${BUNNY_LIBRARY_ID}/${videoId}`,
  };
}

function youtubeVideoId(url: URL): string | null {
  const path = url.pathname.replace(/\/+$/, "");

  if (url.hostname === "youtu.be") {
    const match = path.match(/^\/([^/]+)$/);
    return match && YOUTUBE_ID.test(match[1]) ? match[1] : null;
  }

  if (YOUTUBE_WATCH_HOSTS.has(url.hostname)) {
    if (path === "/watch") {
      const value = url.searchParams.get("v");
      return value !== null && YOUTUBE_ID.test(value) ? value : null;
    }
    const match = path.match(/^\/(?:embed|shorts)\/([^/]+)$/);
    return match && YOUTUBE_ID.test(match[1]) ? match[1] : null;
  }

  if (url.hostname === "www.youtube-nocookie.com") {
    const match = path.match(/^\/embed\/([^/]+)$/);
    return match && YOUTUBE_ID.test(match[1]) ? match[1] : null;
  }

  return null;
}

/**
 * Chuẩn hoá một liên kết phát về đúng hai nhà cung cấp được phép.
 * Trả `null` cho mọi host lạ, giao thức khác https, có port/credentials,
 * hoặc id/path không đúng định dạng.
 */
export function normalizeMediaLink(
  rawUrl: string,
): { kind: LessonMediaKind; videoId: string; embedUrl: string } | null {
  if (typeof rawUrl !== "string") return null;
  const url = parseUrl(rawUrl);
  if (!url) return null;

  const bunny = normalizeBunny(url);
  if (bunny) return bunny;

  const videoId = youtubeVideoId(url);
  if (!videoId) return null;
  return {
    kind: "youtube",
    videoId,
    embedUrl: `${YOUTUBE_EMBED_BASE}${videoId}`,
  };
}

/** Chuẩn hoá một cặp (mã bài học, liên kết thô). Mã bài học phải là chuỗi số. */
export function normalizeLessonMediaEntry(lessonId: string, rawUrl: string): LessonMediaEntry | null {
  if (typeof lessonId !== "string") return null;
  const trimmedId = lessonId.trim();
  if (!/^\d+$/.test(trimmedId)) return null;
  const media = normalizeMediaLink(rawUrl);
  if (!media) return null;
  return { lessonId: trimmedId, ...media };
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function readEntry(raw: unknown): LessonMediaEntry | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;

  const rawId = record.lessonId;
  let lessonId: string;
  if (typeof rawId === "string") lessonId = rawId.trim();
  else if (typeof rawId === "number" && Number.isFinite(rawId)) lessonId = String(rawId);
  else return null;

  // Chấp nhận `embedUrl` (định dạng chuẩn) và các bí danh phổ biến khi thu thập.
  const rawUrl = [record.embedUrl, record.url, record.link].find((value) => typeof value === "string");
  if (typeof rawUrl !== "string") return null;

  return normalizeLessonMediaEntry(lessonId, rawUrl);
}

/**
 * Đọc và kiểm tra dữ liệu người học tự thu thập.
 *
 * Hàm không bao giờ throw: mọi dữ liệu rác đều trả `ok: false` kèm lỗi
 * tiếng Việt, hoặc bị bỏ qua và đếm vào `skipped`. Entry trùng `lessonId`
 * thì giữ bản xuất hiện sau cùng; kết quả sắp xếp theo mã bài học tăng dần.
 */
export function parseLessonMediaMap(
  input: unknown,
): { ok: true; map: LessonMediaMap; skipped: number } | { ok: false; errors: string[] } {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      return { ok: false, errors: ["Dữ liệu không phải là một đối tượng JSON hợp lệ."] };
    }

    const record = input as Record<string, unknown>;

    if (record.version !== 1) {
      return { ok: false, errors: ["Phiên bản dữ liệu không được hỗ trợ: chỉ chấp nhận version = 1."] };
    }

    const rawEntries = record.entries;
    if (!Array.isArray(rawEntries)) {
      return { ok: false, errors: ['Trường "entries" phải là một mảng liên kết phát.'] };
    }
    if (rawEntries.length === 0) {
      return { ok: false, errors: [EMPTY_MAP_ERROR] };
    }

    let skipped = 0;
    const byLessonId = new Map<string, LessonMediaEntry>();
    for (const raw of rawEntries) {
      const entry = readEntry(raw);
      if (!entry) {
        skipped += 1;
        continue;
      }
      // Giữ bản xuất hiện sau cùng khi trùng mã bài học.
      byLessonId.set(entry.lessonId, entry);
    }

    if (byLessonId.size === 0) {
      return { ok: false, errors: [EMPTY_MAP_ERROR] };
    }

    const entries = [...byLessonId.values()].sort(
      (left, right) => Number(left.lessonId) - Number(right.lessonId),
    );

    const collectedAt = isIsoTimestamp(record.collectedAt) ? record.collectedAt : new Date().toISOString();

    return { ok: true, map: { version: 1, collectedAt, entries }, skipped };
  } catch {
    return { ok: false, errors: ["Không đọc được dữ liệu liên kết phát."] };
  }
}
