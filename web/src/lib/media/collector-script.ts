/**
 * Kịch bản thu thập liên kết phát do chính người học chạy trong phiên đăng nhập
 * của mình trên website nguồn.
 *
 * Kịch bản đọc payload các trang khóa học của chính người học (RSC), rồi tải
 * về một tệp JSON gồm các cặp bài học → liên kết nhúng Bunny/YouTube. Nó không
 * đọc cookie hay bộ nhớ trình duyệt và không gửi dữ liệu đi đâu.
 */
function createCollectorScript(chapterPaths: string[] | null): string {
  return String.raw`(async function () {
  "use strict";

  var chapterPaths = ${JSON.stringify(chapterPaths)};
  var BUNNY_EMBED_BASE = "https://iframe.mediadelivery.net/embed/431650/";
  var YOUTUBE_EMBED_BASE = "https://www.youtube-nocookie.com/embed/";
  var BUNNY_MARKER = "iframe.mediadelivery.net/embed/431650/";
  var UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  var YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
  var ID_CHAR_RE = /[A-Za-z0-9_-]/;
  var YOUTUBE_MARKERS = [
    "youtube.com/watch?v=",
    "youtube.com/embed/",
    "youtube.com/shorts/",
    "youtube.com/v/",
    "youtu.be/",
    "youtube-nocookie.com/embed/"
  ];

  function courseSlugFromPath(pathname) {
    var match = /^\/courses\/([^/]+)/.exec(String(pathname || ""));
    if (!match) return "unknown";
    try {
      return decodeURIComponent(match[1]) || "unknown";
    } catch (error) {
      return match[1];
    }
  }

  /* Payload RSC có thể còn mã hoá HTML hoặc escape JSON; đưa về dạng dễ đọc. */
  function normalizePayload(value) {
    return String(value)
      .replace(/&quot;/gi, '"')
      .replace(/&#0*34;/g, '"')
      .replace(/&#x0*22;/gi, '"')
      .replace(/&amp;/gi, "&")
      .replace(/\\u0022/gi, '"')
      .replace(/\\u002f/gi, "/")
      .replace(/\\u0026/gi, "&")
      .replace(/\\\//g, "/")
      .replace(/\\"/g, '"');
  }

  function findBunny(text) {
    var from = 0;
    while (from < text.length) {
      var at = text.indexOf(BUNNY_MARKER, from);
      if (at < 0) return null;
      var start = at + BUNNY_MARKER.length;
      var candidate = text.slice(start, start + 36);
      if (UUID_RE.test(candidate)) {
        var videoId = candidate.toLowerCase();
        return { index: at, kind: "bunny", videoId: videoId, embedUrl: BUNNY_EMBED_BASE + videoId };
      }
      from = start;
    }
    return null;
  }

  function readYoutubeId(text, start) {
    var candidate = text.slice(start, start + 11);
    if (!YOUTUBE_ID_RE.test(candidate)) return null;
    if (start + 11 < text.length && ID_CHAR_RE.test(text.charAt(start + 11))) return null;
    return candidate;
  }

  function findYoutube(text) {
    var best = null;
    for (var markerIndex = 0; markerIndex < YOUTUBE_MARKERS.length; markerIndex += 1) {
      var marker = YOUTUBE_MARKERS[markerIndex];
      var from = 0;
      while (from < text.length) {
        var at = text.indexOf(marker, from);
        if (at < 0) break;
        var videoId = readYoutubeId(text, at + marker.length);
        if (videoId) {
          if (!best || at < best.index) {
            best = { index: at, kind: "youtube", videoId: videoId, embedUrl: YOUTUBE_EMBED_BASE + videoId };
          }
          break;
        }
        from = at + marker.length;
      }
    }
    return best;
  }

  function firstMedia(text) {
    var bunny = findBunny(text);
    var youtube = findYoutube(text);
    if (bunny && (!youtube || bunny.index < youtube.index)) return bunny;
    if (youtube) return youtube;
    return null;
  }

  /* Tách payload theo mốc bài học, mỗi đoạn chỉ lấy liên kết phát đầu tiên. */
  function collectPairs(payload, into) {
    var parts = normalizePayload(payload).split('"lessonId"');
    for (var index = 1; index < parts.length; index += 1) {
      var segment = parts[index];
      var idMatch = /^\s*:\s*"?(\d+)"?/.exec(segment);
      if (!idMatch) continue;
      var lessonId = idMatch[1];
      var media = firstMedia(segment);
      /* Bản ghi sau cùng có liên kết sẽ thay bản trước; bản không có liên kết
         không xoá liên kết đã tìm được ở nguồn khác. */
      if (media) into[lessonId] = media;
      else if (!Object.prototype.hasOwnProperty.call(into, lessonId)) into[lessonId] = null;
    }
  }

  async function readSources() {
    var payloads = [];
    try {
      var response = await fetch(location.pathname, {
        headers: { RSC: "1" },
        credentials: "same-origin"
      });
      if (response && response.ok) {
        var text = await response.text();
        if (text && text.length > 0) payloads.push(text);
      }
    } catch (error) {
      /* Không đọc được payload thì vẫn còn HTML đang hiển thị. */
    }
    try {
      var html = document.documentElement ? document.documentElement.innerHTML : "";
      if (html && html.length > 0) payloads.push(html);
    } catch (error) {
      /* Không đọc được DOM thì bỏ qua nguồn này. */
    }
    return payloads;
  }

  function safeFileName(slug) {
    var cleaned = String(slug || "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    return "lesson-media-" + (cleaned || "unknown") + ".json";
  }

  function downloadJson(fileName, content) {
    var blob = new Blob([content], { type: "application/json;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = "none";
    var parent = document.body || document.documentElement;
    parent.appendChild(anchor);
    anchor.click();
    parent.removeChild(anchor);
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 5000);
  }

  try {
    var courseSlug = courseSlugFromPath(location.pathname);
    var byLessonId = {};
    var failed = 0;
    var progress = null;

    function report(message) {
      console.log("[Thu thập liên kết] " + message);
      if (chapterPaths) alert(message);
    }

    if (chapterPaths) {
      if (location.protocol !== "https:" || location.hostname !== "seankangmvp.com" || location.port) {
        report("Hãy mở website khóa học và đăng nhập trước khi thu thập.");
        return;
      }
      if (!chapterPaths.length) {
        report("Chưa có chương học trong danh mục để thu thập.");
        return;
      }
      progress = document.createElement("div");
      progress.setAttribute("role", "status");
      progress.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;padding:12px 16px;border-radius:8px;background:#1e293b;color:white;font:14px/1.5 sans-serif;box-shadow:0 4px 16px #0005";
      document.body.appendChild(progress);
      for (var chapterIndex = 0; chapterIndex < chapterPaths.length; chapterIndex += 1) {
        progress.textContent = "Đang thu thập chương " + (chapterIndex + 1) + "/" + chapterPaths.length + "…";
        try {
          var chapterResponse = await fetch(chapterPaths[chapterIndex], {
            headers: { RSC: "1" }, credentials: "same-origin", signal: AbortSignal.timeout(15000)
          });
          var chapterPayload = chapterResponse.ok ? await chapterResponse.text() : "";
          if (!normalizePayload(chapterPayload).includes('"lessonId"')) failed += 1;
          else collectPairs(chapterPayload, byLessonId);
        } catch (error) {
          failed += 1;
        }
      }
      progress.remove();
    } else {
      var payloads = await readSources();
      for (var index = 0; index < payloads.length; index += 1) {
        collectPairs(payloads[index], byLessonId);
      }
    }

    var lessonIds = Object.keys(byLessonId).sort(function (left, right) {
      return Number(left) - Number(right);
    });

    var entries = [];
    var skipped = 0;
    for (var position = 0; position < lessonIds.length; position += 1) {
      var lessonId = lessonIds[position];
      var media = byLessonId[lessonId];
      if (!media) {
        skipped += 1;
        continue;
      }
      entries.push({
        lessonId: lessonId,
        kind: media.kind,
        videoId: media.videoId,
        embedUrl: media.embedUrl
      });
    }

    if (entries.length === 0) {
      report("Chưa thu được bài nào. Hãy mở trang khóa học hoặc trang chương (không phải trang đăng nhập) rồi thử lại." + (failed ? " Có " + failed + " chương chưa thu được." : ""));
      return;
    }

    var fileName = chapterPaths ? "lesson-media-tat-ca-khoa.json" : safeFileName(courseSlug);
    var documentData = {
      version: 1,
      collectedAt: new Date().toISOString(),
      courseSlug: courseSlug,
      entries: entries
    };
    downloadJson(fileName, JSON.stringify(documentData, null, 2));
    report("Đã thu được " + entries.length + " bài, bỏ qua " + skipped + " bài." + (failed ? " Có " + failed + " chương chưa thu được; hãy thử lại các chương đó." : "") + " Đã tải tệp " + fileName + ".");
  } catch (error) {
    if (progress) progress.remove();
    var reason = error && error.message ? error.message : "lỗi không xác định";
    console.log("[Thu thập liên kết] Có lỗi khi thu thập: " + reason + ". Hãy tải lại trang khóa học rồi thử lại.");
    if (chapterPaths) alert("Chưa thu thập xong. Hãy tải lại trang khóa học rồi thử lại.");
  }
})();`;
}

export const COLLECTOR_SCRIPT = createCollectorScript(null);

export function createBulkCollectorScript(chapterUrls: string[]): string {
  const paths = new Set<string>();
  for (const raw of chapterUrls) {
    try {
      const url = new URL(raw);
      if (url.protocol === "https:" && url.hostname === "seankangmvp.com" && !url.port && !url.username && !url.password
        && !url.search && !url.hash && /^\/courses\/[^/]+\/chapters\/\d+\/lessons$/.test(url.pathname)) paths.add(url.pathname);
    } catch { /* Bỏ qua đường dẫn chương không hợp lệ. */ }
  }
  return createCollectorScript([...paths]);
}

/**
 * Biến kịch bản thành href cho bookmarklet.
 *
 * Khoảng trắng và xuống dòng được nén lại, phần thân được bọc trong một hàm
 * đồng bộ (trả `undefined` để trình duyệt không thay trang) rồi encode bằng
 * `encodeURIComponent`. Nếu đầu vào đã có tiền tố `javascript:` thì bỏ đi để
 * không sinh ra `javascript:javascript:`.
 */
export function toBookmarkletHref(script: string): string {
  const prefix = "javascript:";
  let source = String(script ?? "").trim();
  if (/^javascript:/i.test(source)) source = source.slice(prefix.length).trim();

  // Nén khoảng trắng/xuống dòng và bỏ dấu `;` thừa ở cuối để phần bọc gọn.
  const body = source.replace(/\s+/g, " ").replace(/;+\s*$/, "").trim();
  if (body === "") return `${prefix}void 0`;

  // Hàm đồng bộ trả `undefined` để trình duyệt không thay trang bằng kết quả.
  const bookmarklet = `(function(){${body};void 0})()`;
  // `encodeURIComponent` không mã hoá dấu nháy đơn — mã hoá thêm để href an toàn
  // trong mọi kiểu thuộc tính HTML.
  return `${prefix}${encodeURIComponent(bookmarklet).replace(/'/g, "%27")}`;
}
