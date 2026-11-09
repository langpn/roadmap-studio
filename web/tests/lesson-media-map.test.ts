import { describe, expect, it } from "vitest";
import {
  normalizeLessonMediaEntry,
  normalizeMediaLink,
  parseLessonMediaMap,
} from "@/lib/media/lesson-media-map";

const BUNNY_UUID = "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d";
const BUNNY_EMBED = `https://iframe.mediadelivery.net/embed/431650/${BUNNY_UUID}`;
const YOUTUBE_ID = "dQw4w9WgXcQ";
const YOUTUBE_EMBED = `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}`;

describe("normalizeMediaLink — Bunny Stream", () => {
  it("bỏ query hiển thị (autoplay/loop/muted) và trả embedUrl sạch", () => {
    // Bắt lỗi: query của bản nhúng gốc bị dán nguyên vào embedUrl khi phát.
    const result = normalizeMediaLink(
      `https://iframe.mediadelivery.net/embed/431650/${BUNNY_UUID}?autoplay=true&loop=false&muted=true&preload=true&responsive=true`,
    );
    expect(result).toEqual({ kind: "bunny", videoId: BUNNY_UUID, embedUrl: BUNNY_EMBED });
  });

  it("chuẩn hoá uuid chữ HOA về chữ thường để khoá ánh xạ không bị trùng", () => {
    // Bắt lỗi: cùng một video bị lưu thành hai khoá khác nhau chỉ vì hoa/thường.
    const result = normalizeMediaLink(
      "https://iframe.mediadelivery.net/embed/431650/1A2B3C4D-5E6F-7A8B-9C0D-1E2F3A4B5C6D",
    );
    expect(result).toEqual({ kind: "bunny", videoId: BUNNY_UUID, embedUrl: BUNNY_EMBED });
  });

  it("từ chối thư viện Bunny khác 431650", () => {
    // Bắt lỗi: nội dung của thư viện lạ lọt vào danh sách phát của khoá học.
    expect(
      normalizeMediaLink(`https://iframe.mediadelivery.net/embed/431651/${BUNNY_UUID}`),
    ).toBeNull();
  });

  it("từ chối host giả mạo iframe.mediadelivery.net.evil.invalid", () => {
    // Bắt lỗi: kiểm tra host bằng startsWith/endsWith thay vì so khớp chính xác.
    expect(
      normalizeMediaLink(`https://iframe.mediadelivery.net.evil.invalid/embed/431650/${BUNNY_UUID}`),
    ).toBeNull();
  });

  it("từ chối liên kết Bunny dùng http thay vì https", () => {
    // Bắt lỗi: nhúng iframe không bảo mật trong trang https.
    expect(normalizeMediaLink(`http://iframe.mediadelivery.net/embed/431650/${BUNNY_UUID}`)).toBeNull();
  });

  it("từ chối liên kết Bunny có chỉ định cổng", () => {
    // Bắt lỗi: cổng lạ trỏ sang dịch vụ khác trên cùng tên miền.
    expect(
      normalizeMediaLink(`https://iframe.mediadelivery.net:8443/embed/431650/${BUNNY_UUID}`),
    ).toBeNull();
  });

  it("từ chối liên kết Bunny có username:password", () => {
    // Bắt lỗi: thông tin đăng nhập bị nhúng vào URL và bị ghi lại vào dữ liệu.
    expect(
      normalizeMediaLink(`https://user:secret@iframe.mediadelivery.net/embed/431650/${BUNNY_UUID}`),
    ).toBeNull();
  });

  it("từ chối uuid sai định dạng hoặc thiếu ký tự", () => {
    // Bắt lỗi: path không phải uuid vẫn được chấp nhận rồi hỏng khi phát.
    for (const path of [
      "not-a-uuid",
      "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6",
      "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6dd",
      "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
    ]) {
      expect(normalizeMediaLink(`https://iframe.mediadelivery.net/embed/431650/${path}`), path).toBeNull();
    }
  });
});

describe("normalizeMediaLink — YouTube", () => {
  it("quy mọi dạng liên kết YouTube về cùng một embedUrl youtube-nocookie", () => {
    // Bắt lỗi: mỗi dạng URL tạo ra một embedUrl khác nhau nên không so khớp được.
    for (const raw of [
      `https://www.youtube.com/watch?v=${YOUTUBE_ID}`,
      `https://youtube.com/watch?v=${YOUTUBE_ID}&list=PL123`,
      `https://m.youtube.com/watch?v=${YOUTUBE_ID}`,
      `https://youtu.be/${YOUTUBE_ID}`,
      `https://www.youtube-nocookie.com/embed/${YOUTUBE_ID}`,
      `https://youtube.com/embed/${YOUTUBE_ID}`,
      `https://youtube.com/shorts/${YOUTUBE_ID}`,
    ]) {
      expect(normalizeMediaLink(raw), raw).toEqual({
        kind: "youtube",
        videoId: YOUTUBE_ID,
        embedUrl: YOUTUBE_EMBED,
      });
    }
  });

  it("từ chối id YouTube dài 10 hoặc 12 ký tự", () => {
    // Bắt lỗi: id sai độ dài vẫn được nhúng và video không phát được.
    expect(normalizeMediaLink("https://www.youtube.com/watch?v=dQw4w9WgXc")).toBeNull();
    expect(normalizeMediaLink("https://youtu.be/dQw4w9WgXcQQ")).toBeNull();
  });

  it("từ chối liên kết YouTube có cổng hoặc thông tin đăng nhập", () => {
    // Bắt lỗi: biến thể host lạ vẫn lọt qua kiểm tra chỉ dựa vào pathname.
    expect(normalizeMediaLink(`https://www.youtube.com:8443/watch?v=${YOUTUBE_ID}`)).toBeNull();
    expect(normalizeMediaLink(`https://user:secret@www.youtube.com/watch?v=${YOUTUBE_ID}`)).toBeNull();
  });
});

describe("normalizeMediaLink — đầu vào không an toàn", () => {
  it("từ chối javascript:, data:, blob: và chuỗi rỗng", () => {
    // Bắt lỗi: URL nguy hiểm được đưa thẳng vào thuộc tính src của iframe.
    for (const raw of [
      "javascript:alert(1)",
      "data:text/html,x",
      "blob:https://example.com/1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "",
      "   ",
      "iframe.mediadelivery.net/embed/431650/1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    ]) {
      expect(normalizeMediaLink(raw), raw).toBeNull();
    }
  });
});

describe("normalizeLessonMediaEntry", () => {
  it("từ chối mã bài học không phải chuỗi số", () => {
    // Bắt lỗi: mã bài rác tạo ra entry mồ côi không gắn được với bài nào.
    for (const lessonId of ["abc", "", "12a", "1.5", "-3", "12 34"]) {
      expect(normalizeLessonMediaEntry(lessonId, BUNNY_EMBED), lessonId).toBeNull();
    }
  });

  it("giữ nguyên chuỗi số có số 0 ở đầu thay vì đổi sang number", () => {
    // Bắt lỗi: "0012" bị ép thành 12 làm lệch khoá ánh xạ của kho dữ liệu.
    expect(normalizeLessonMediaEntry("0012", BUNNY_EMBED)).toEqual({
      lessonId: "0012",
      kind: "bunny",
      videoId: BUNNY_UUID,
      embedUrl: BUNNY_EMBED,
    });
  });

  it("cắt khoảng trắng thừa quanh mã bài học nhưng vẫn giữ liên kết hợp lệ", () => {
    // Bắt lỗi: dữ liệu dán tay có khoảng trắng bị loại oan.
    expect(normalizeLessonMediaEntry("  12  ", YOUTUBE_EMBED)?.lessonId).toBe("12");
  });
});

describe("parseLessonMediaMap — kiểm tra cấu trúc", () => {
  it("từ chối dữ liệu không phải object hoặc object rỗng", () => {
    // Bắt lỗi: JSON rác gây throw thay vì hiện thông báo lỗi cho người học.
    const inputs: Array<[string, unknown]> = [
      ["null", null],
      ["undefined", undefined],
      ["chuỗi", "chuỗi"],
      ["số", 42],
      ["boolean", true],
      ["mảng", []],
      ["object rỗng", {}],
    ];
    for (const [label, input] of inputs) {
      const result = parseLessonMediaMap(input);
      expect(result.ok, label).toBe(false);
      if (!result.ok) expect(result.errors.length, label).toBeGreaterThan(0);
    }
  });

  it("từ chối version khác 1", () => {
    // Bắt lỗi: định dạng tương lai bị đọc sai thành bản hiện tại.
    const result = parseLessonMediaMap({ version: 2, collectedAt: new Date().toISOString(), entries: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("version");
  });

  it("từ chối khi entries không phải mảng", () => {
    // Bắt lỗi: entries dạng object khiến vòng lặp bỏ qua toàn bộ dữ liệu.
    const result = parseLessonMediaMap({ version: 1, entries: { "12": BUNNY_EMBED } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("entries");
  });

  it("từ chối khi entries rỗng bằng thông báo tiếng Việt đúng câu quy định", () => {
    // Bắt lỗi: tệp hợp lệ về cấu trúc nhưng không có gì để phát vẫn được nhận.
    const result = parseLessonMediaMap({ version: 1, entries: [] });
    expect(result).toEqual({
      ok: false,
      errors: ["Không tìm thấy liên kết phát nào trong dữ liệu."],
    });
  });

  it("bỏ qua entry rác, đếm skipped và vẫn giữ entry tốt", () => {
    // Bắt lỗi: một entry hỏng làm mất toàn bộ tệp hoặc skipped đếm sai.
    const result = parseLessonMediaMap({
      version: 1,
      collectedAt: "2026-11-07T10:00:00.000Z",
      entries: [
        { lessonId: "12", embedUrl: BUNNY_EMBED },
        { lessonId: "abc", embedUrl: BUNNY_EMBED },
        null,
        "rác",
        { lessonId: "13", embedUrl: "https://example.com/video" },
        { lessonId: 14, embedUrl: YOUTUBE_EMBED },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped).toBe(4);
    expect(result.map.entries).toEqual([
      { lessonId: "12", kind: "bunny", videoId: BUNNY_UUID, embedUrl: BUNNY_EMBED },
      { lessonId: "14", kind: "youtube", videoId: YOUTUBE_ID, embedUrl: YOUTUBE_EMBED },
    ]);
  });

  it("giữ bản xuất hiện sau cùng khi trùng lessonId", () => {
    // Bắt lỗi: bản cũ (liên kết hỏng) đè lên bản mới (liên kết đúng).
    const result = parseLessonMediaMap({
      version: 1,
      collectedAt: "2026-11-07T10:00:00.000Z",
      entries: [
        { lessonId: "12", embedUrl: `https://youtu.be/${YOUTUBE_ID}` },
        { lessonId: "12", embedUrl: BUNNY_EMBED },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped).toBe(0);
    expect(result.map.entries).toEqual([
      { lessonId: "12", kind: "bunny", videoId: BUNNY_UUID, embedUrl: BUNNY_EMBED },
    ]);
  });

  it("sắp xếp theo giá trị số học chứ không theo thứ tự chữ cái", () => {
    // Bắt lỗi: sort mặc định cho ra 10, 100, 2 khiến thứ tự bài học sai.
    const result = parseLessonMediaMap({
      version: 1,
      collectedAt: "2026-11-07T10:00:00.000Z",
      entries: [
        { lessonId: "100", embedUrl: BUNNY_EMBED },
        { lessonId: "2", embedUrl: BUNNY_EMBED },
        { lessonId: "10", embedUrl: BUNNY_EMBED },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.map.entries.map((entry) => entry.lessonId)).toEqual(["2", "10", "100"]);
  });

  it("chấp nhận lessonId dạng number và đổi thành chuỗi", () => {
    // Bắt lỗi: dữ liệu thu thập bằng script ghi số thay vì chuỗi bị loại sạch.
    const result = parseLessonMediaMap({
      version: 1,
      collectedAt: "2026-11-07T10:00:00.000Z",
      entries: [{ lessonId: 7, embedUrl: BUNNY_EMBED }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.map.entries[0]?.lessonId).toBe("7");
  });

  it("thay collectedAt rác bằng thời điểm ISO hiện tại", () => {
    // Bắt lỗi: chuỗi ngày tháng rác được giữ nguyên và làm hỏng phần hiển thị.
    const result = parseLessonMediaMap({
      version: 1,
      collectedAt: "hôm qua",
      entries: [{ lessonId: "12", embedUrl: BUNNY_EMBED }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.map.collectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Number.isNaN(Date.parse(result.map.collectedAt))).toBe(false);
  });

  it("giữ nguyên collectedAt khi đã là chuỗi ISO hợp lệ", () => {
    // Bắt lỗi: thời điểm thu thập thật bị ghi đè mất.
    const collectedAt = "2026-11-07T10:00:00.000Z";
    const result = parseLessonMediaMap({
      version: 1,
      collectedAt,
      entries: [{ lessonId: "12", embedUrl: BUNNY_EMBED }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.map.collectedAt).toBe(collectedAt);
    expect(result.map.version).toBe(1);
  });

  it("không throw với dữ liệu rác tuỳ ý", () => {
    // Bắt lỗi: JSON từ trình duyệt có giá trị lạ làm sập route xử lý.
    const rác: unknown[] = [
      { version: 1, entries: [Symbol("x")] },
      { version: 1, entries: [() => BUNNY_EMBED] },
      { version: 1, entries: [{ lessonId: {}, embedUrl: [] }] },
      { version: "1", entries: [] },
      { version: 1, entries: [{ lessonId: "12", embedUrl: BUNNY_EMBED }], collectedAt: 123 },
    ];
    for (const input of rác) {
      expect(() => parseLessonMediaMap(input)).not.toThrow();
    }
  });
});
