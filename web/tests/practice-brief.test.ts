import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PracticeBrief } from "@/components/practice-brief";
import type { PracticeBriefData } from "@/components/roadmap-data";
import type { Catalog } from "@/lib/catalog/normalize";

type Practice = PracticeBriefData & {
  kind?: "practice" | "milestone";
  steps?: string[];
  example?: { label: string; text: string };
  shortcutLessonIds: (PracticeBriefData["shortcutLessonIds"][number] & {
    role?: "main" | "support";
    purpose?: string;
  })[];
};

const practice: Practice = {
  id: "portfolio",
  shortTitle: "Portfolio mẫu",
  title: "Tạo portfolio mẫu",
  kind: "milestone",
  targetDuration: "Một bản",
  target: "Giới thiệu hai clip mẫu một cách rõ ràng.",
  note: "Đây là gợi ý tự luyện của lộ trình.",
  rawMaterials: ["Hai clip có quyền sử dụng."],
  outputs: ["Một trang portfolio có thể mở được."],
  steps: ["Chọn hai clip phù hợp.", "Viết lời giới thiệu ngắn."],
  checklist: ["Mở thử liên kết portfolio."],
  example: { label: "Ví dụ lời giới thiệu", text: "Tôi dựng video ngắn cho mạng xã hội." },
  shortcutLessonIds: [
    { id: "101", courseSlug: "elite", label: "Bài dựng chính", role: "main", purpose: "Xem cách sắp xếp cảnh." },
    { id: "102", courseSlug: "support", label: "Bài hỗ trợ còn thiếu", role: "support", purpose: "Tham khảo khi viết giới thiệu." },
  ],
};

const catalog: Catalog = {
  courses: [{
    slug: "elite",
    title: "Khóa giả lập",
    url: "https://example.invalid/course",
    position: 0,
    lessonCount: 1,
    chapters: [{
      id: "1",
      title: "Chương giả lập",
      url: "https://example.invalid/chapter",
      position: 0,
      lessons: [{
        id: "101",
        chapterId: "1",
        courseSlug: "elite",
        title: "Bài giả lập",
        url: "https://example.invalid/lesson",
        position: 0,
        kind: "unknown",
        duration: null,
        titleWithheld: false,
        summary: "Phần chữ nói về cách sắp xếp cảnh.",
        summaryEvidence: "Đã đối chiếu phần chữ trang; chưa xem nội dung video.",
      }],
    }],
  }],
  chapterCount: 1,
  lessonCount: 1,
};

const props = {
  practice,
  catalog,
  currentState: "in_progress" as const,
  mode: "private" as const,
  onStateChange: () => {},
  onSelectLesson: () => {},
  onClose: () => {},
};

function buttonsIn(html: string) {
  return [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(([button]) => button);
}

describe("bảng hướng dẫn thực hành", () => {
  it("trình bày đầu ra, các bước theo thứ tự, ví dụ và trạng thái cho mốc hồ sơ", () => {
    const html = renderToStaticMarkup(createElement(PracticeBrief, props));
    const buttons = buttonsIn(html);

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Giới thiệu hai clip mẫu một cách rõ ràng.");
    expect(html).toContain("Một trang portfolio có thể mở được.");
    expect(html).toContain("Hai clip có quyền sử dụng.");
    expect(html).toMatch(/<ol\b[\s\S]*?Chọn hai clip phù hợp\.[\s\S]*?Viết lời giới thiệu ngắn\.[\s\S]*?<\/ol>/);
    expect(html).toContain("Ví dụ lời giới thiệu");
    expect(html).toContain("Tôi dựng video ngắn cho mạng xã hội.");
    expect(html).toContain("Ghi chú của lộ trình");
    expect(html).toContain("Đây là gợi ý tự luyện của lộ trình.");
    expect(html).toContain("Dấu tích chỉ được giữ khi bảng hướng dẫn đang mở");
    expect(html).toContain("tự xác nhận");
    expect(buttons.find((button) => button.includes("Chưa làm"))).toContain('aria-pressed="false"');
    expect(buttons.find((button) => button.includes("Đang thực hiện"))).toContain('aria-pressed="true"');
    expect(buttons.find((button) => button.includes("Đã hoàn thành"))).toContain('aria-pressed="false"');
  });

  it("chỉ mở bài khớp catalog và báo rõ bài không khả dụng", () => {
    const html = renderToStaticMarkup(createElement(PracticeBrief, props));
    const buttons = buttonsIn(html);
    const available = buttons.filter((button) => button.includes("Bài dựng chính"));

    expect(available).toHaveLength(1);
    expect(html).toContain("Bài chính");
    expect(html).toContain("Bài hỗ trợ");
    expect(html).toContain("Xem cách sắp xếp cảnh.");
    expect(html).toContain("Phần chữ nói về cách sắp xếp cảnh.");
    expect(html).toContain("Đã đối chiếu phần chữ trang; chưa xem nội dung video.");
    expect(html).toContain("Bài hỗ trợ còn thiếu");
    expect(html).toContain("Không khả dụng");
    expect(buttons.some((button) => button.includes("Bài hỗ trợ còn thiếu"))).toBe(false);
  });

  it("không mở bài có đúng mã nhưng thuộc khóa khác", () => {
    const wrongCourse: Practice = {
      ...practice,
      shortcutLessonIds: [{ id: "101", courseSlug: "support", label: "Bài nhầm khóa", role: "support" }],
    };
    const html = renderToStaticMarkup(createElement(PracticeBrief, { ...props, practice: wrongCourse }));

    expect(html).toContain("Không khả dụng");
    expect(buttonsIn(html).some((button) => button.includes("Bài nhầm khóa"))).toBe(false);
  });

  it("nói rõ khi bài chỉ được chọn theo tên danh mục", () => {
    const unverified: Catalog = {
      ...catalog,
      courses: catalog.courses.map((course) => ({
        ...course,
        chapters: course.chapters.map((chapter) => ({
          ...chapter,
          lessons: chapter.lessons.map((lesson) => ({ ...lesson, summary: "Thông tin chưa được kiểm chứng", summaryEvidence: null })),
        })),
      })),
    };
    const html = renderToStaticMarkup(createElement(PracticeBrief, { ...props, catalog: unverified }));

    expect(html).toContain("Chọn theo tên danh mục; chưa xác minh nội dung video");
    expect(html).not.toContain("Đã đối chiếu phần chữ trang");
    expect(html).not.toContain("Thông tin chưa được kiểm chứng");
  });

  it("vẫn mở bài mẫu trong demo mà không nhận là dữ liệu nguồn thật", () => {
    const html = renderToStaticMarkup(createElement(PracticeBrief, { ...props, mode: "demo" }));

    expect(html).toContain("Bài mẫu");
    expect(buttonsIn(html).some((button) => button.includes("Bài dựng chính"))).toBe(true);
    expect(html).not.toContain("Đã đối chiếu phần chữ trang");
    expect(html).not.toContain("Phần chữ nói về cách sắp xếp cảnh.");
  });

  it("giữ thông báo lỗi và khóa các nút trạng thái khi đang lưu", () => {
    const html = renderToStaticMarkup(createElement(PracticeBrief, {
      ...props,
      saving: true,
      errorBanner: createElement("p", { role: "alert" }, "Không lưu được tiến độ"),
    }));
    const buttons = buttonsIn(html);

    expect(html).toContain('role="alert"');
    expect(html).toContain("Không lưu được tiến độ");
    for (const name of ["Chưa làm", "Đang thực hiện", "Đã hoàn thành"]) {
      expect(buttons.find((button) => button.includes(name))).toContain("disabled");
    }
  });

  it("nói rõ khi dữ liệu cũ chưa có bước hay vai trò học liệu", () => {
    const legacy: Practice = {
      ...practice,
      steps: undefined,
      example: undefined,
      shortcutLessonIds: [{ id: "101", courseSlug: "elite", label: "Học liệu tham khảo" }],
    };
    const html = renderToStaticMarkup(createElement(PracticeBrief, { ...props, practice: legacy }));

    expect(html).toContain("Chưa có hướng dẫn từng bước cho mục này.");
    expect(html).toContain("Bài tham khảo");
    expect(html).not.toContain("Ví dụ lời giới thiệu");
  });
});
