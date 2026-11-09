import { describe, expect, it } from "vitest";
import { normalizeCatalog, searchLessons, type RawCourse } from "@/lib/catalog/normalize";

const sample: RawCourse = {
  slug: "sample",
  supplemental: true,
  course: { name: "Một khóa học", url: "https://seankangmvp.com/courses/sample" },
  chapters: [
    {
      chapter_id: "8",
      title: "Làm quen",
      url: "https://seankangmvp.com/courses/sample/chapters/8/lessons",
      lessons: [
        { lesson_id: "10", name: "Nhập tư liệu", url: "https://seankangmvp.com/courses/sample/chapters/8/lessons/10", type: "video", duration_display: "5 phút" },
        { lesson_id: "11", name: "Tìm tài liệu", url: "https://seankangmvp.com/courses/sample/chapters/8/lessons/11", type: "reading" },
      ],
    },
  ],
};

describe("nhập danh mục", () => {
  it("giữ thứ tự nguồn và không suy video từ nhãn thời lượng", () => {
    const catalog = normalizeCatalog([sample]);
    expect(catalog.courses[0].chapters[0].lessons.map((lesson) => lesson.id)).toEqual(["10", "11"]);
    expect(catalog.courses[0].chapters[0].lessons.map((lesson) => lesson.kind)).toEqual(["unknown", "reading"]);
    expect(catalog.lessonCount).toBe(2);
  });

  it("chặn URL sai host hoặc sai đường dẫn, và làm sạch query/fragment hợp lệ", () => {
    const course = structuredClone(sample);
    course.chapters[0].lessons[0].url = "https://example.com/courses/sample/chapters/8/lessons/10?token=secret";
    expect(() => normalizeCatalog([course])).toThrow();
    course.chapters[0].lessons[0].url = "https://seankangmvp.com/courses/sample/chapters/8/lessons/khong-phai-so";
    expect(() => normalizeCatalog([course])).toThrow();
  });

  it("bỏ tham số theo dõi khỏi URL sau khi xác thực host và đường dẫn", () => {
    const course = structuredClone(sample);
    course.chapters[0].lessons[0].url = "https://seankangmvp.com/courses/sample/chapters/8/lessons/10?igsh=tracking#bonus";
    course.chapters[0].url = "https://seankangmvp.com/courses/sample/chapters/8/lessons?utm_source=list";
    course.course.url = "https://seankangmvp.com/courses/sample?ref=mail";
    const normalized = normalizeCatalog([course]);
    expect(normalized.courses[0].url).toBe("https://seankangmvp.com/courses/sample");
    expect(normalized.courses[0].chapters[0].url).toBe("https://seankangmvp.com/courses/sample/chapters/8/lessons");
    expect(normalized.courses[0].chapters[0].lessons[0].url).toBe("https://seankangmvp.com/courses/sample/chapters/8/lessons/10");
  });

  it("từ chối mã bài trùng và không trả về dữ liệu nhập dở", () => {
    const course = structuredClone(sample);
    course.chapters[0].lessons[1].url = course.chapters[0].lessons[0].url;
    expect(() => normalizeCatalog([course])).toThrow();
  });

  it("giữ tiêu đề bài đánh giá do giảng viên cung cấp trong danh mục cá nhân", () => {
    const course = structuredClone(sample);
    course.slug = "elite-pro";
    course.chapters[0].chapter_id = "29";
    course.chapters[0].url = "https://seankangmvp.com/courses/sample/chapters/29/lessons";
    course.chapters[0].lessons[0].url = "https://seankangmvp.com/courses/sample/chapters/29/lessons/10";
    course.chapters[0].lessons[1].url = "https://seankangmvp.com/courses/sample/chapters/29/lessons/11";
    course.chapters[0].lessons[0].name = "Hồ sơ học viên mẫu";
    const lessons = normalizeCatalog([course]).courses[0].chapters[0].lessons;
    expect(lessons[0].id).toBe("10");
    expect(lessons[0].title).toBe("Hồ sơ học viên mẫu");
    expect(lessons[0].titleWithheld).toBe(false);
  });
});

describe("trạng thái mô tả và nguồn quan sát", () => {
  const lessonsOf = (lessons: RawCourse["chapters"][number]["lessons"]) =>
    normalizeCatalog([{ ...structuredClone(sample), chapters: [{ ...sample.chapters[0], lessons }] }]).courses[0].chapters[0].lessons;

  it("ánh xạ đúng từng trạng thái mô tả của nguồn", () => {
    const statuses = ["text", "link_only", "placeholder", "not_present", "unread", "unknown"];
    const lessons = lessonsOf(statuses.map((status, index) => ({
      lesson_id: String(20 + index),
      name: `Bài ${status}`,
      url: `https://seankangmvp.com/courses/sample/chapters/8/lessons/${20 + index}`,
      type: "video",
      description_status: status,
    })));
    expect(lessons.map((lesson) => lesson.descriptionStatus)).toEqual(statuses);
  });

  it("bài unknown hoặc thiếu trạng thái không tự thành mô tả đã đọc", () => {
    const [unknown, fromOlderSnapshots, unrecognised] = lessonsOf([
      { lesson_id: "31", name: "Bài chưa rõ", url: "https://seankangmvp.com/courses/sample/chapters/8/lessons/31", type: "unknown", description_status: "unknown" },
      { lesson_id: "32", name: "Bài không có trạng thái", url: "https://seankangmvp.com/courses/sample/chapters/8/lessons/32", type: "video" },
      { lesson_id: "33", name: "Bài trạng thái lạ", url: "https://seankangmvp.com/courses/sample/chapters/8/lessons/33", type: "video", description_status: "đã đọc" },
    ]);
    expect(unknown.descriptionStatus).toBe("unknown");
    expect(fromOlderSnapshots.descriptionStatus).toBeUndefined();
    expect(unrecognised.descriptionStatus).toBe("unknown");
    expect([unknown.kind, fromOlderSnapshots.kind]).toEqual(["unknown", "unknown"]);
  });

  it("giữ thời điểm quan sát và tham chiếu nguồn, bỏ query khỏi tham chiếu dạng URL", () => {
    const [lesson] = lessonsOf([{
      lesson_id: "41", name: "Bài có nguồn", url: "https://seankangmvp.com/courses/sample/chapters/8/lessons/41",
      description_status: "text",
      observation: {
        observed_at: "2026-11-05T06:53:24.831Z",
        observed_between: { from: "2026-11-05T06:53:24.831Z", to: null },
        source_reference: "https://example.invalid/report.json?token=temporary#frag",
      },
    }]);
    expect(lesson.observation).toEqual({
      observedAt: "2026-11-05T06:53:24.831Z",
      from: "2026-11-05T06:53:24.831Z",
      to: null,
      sourceReference: "https://example.invalid/report.json",
    });
  });

  it("bỏ thời điểm không hợp lệ và không bịa nguồn khi thiếu", () => {
    const [lesson] = lessonsOf([{
      lesson_id: "42", name: "Bài thiếu nguồn", url: "https://seankangmvp.com/courses/sample/chapters/8/lessons/42",
      observation: { observed_at: "không phải ngày", observed_between: null, source_reference: null },
    }]);
    expect(lesson.observation).toBeUndefined();
  });

  it("bỏ query của tham chiếu nguồn dạng đường dẫn tương đối", () => {
    const [lesson] = lessonsOf([{
      lesson_id: "43", name: "Bài nguồn tương đối", url: "https://seankangmvp.com/courses/sample/chapters/8/lessons/43",
      observation: { observed_between: { from: null, to: null }, source_reference: "../../review/tong-hop.md?token=temporary" },
    }]);
    expect(lesson.observation?.sourceReference).toBe("../../review/tong-hop.md");
  });
});

describe("tìm bài", () => {
  it("tìm không phân biệt dấu và giữ thứ tự trong danh mục", () => {
    const catalog = normalizeCatalog([sample]);
    expect(searchLessons(catalog, "lieu").map((lesson) => lesson.id)).toEqual(["10", "11"]);
    expect(searchLessons(catalog, "không có kết quả")).toEqual([]);
  });
});
