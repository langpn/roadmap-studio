import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonDetail } from "@/components/lesson-detail";
import { LessonStudyView } from "@/app/bai-hoc/[lessonId]/lesson-study-view";
import { PracticeBrief } from "@/components/practice-brief";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { getRelatedLessons } from "@/lib/catalog/lesson-links";

const course = demoCatalog.courses[0];
const chapter = course.chapters[1];
const lesson = chapter.lessons[0];

// Nhãn khẳng định nội dung video; chỉ được xuất hiện khi có bằng chứng phần chữ.
const videoClaims = /video (?:này )?(?:dạy|hướng dẫn|minh họa|cho thấy)|bài giảng (?:dạy|hướng dẫn)|nội dung video (?:là|gồm)/i;

function strip(html: string) {
  return html.replace(/<[^>]*>/g, " ");
}

describe("không suy nội dung video từ tiêu đề", () => {
  it("bảng chi tiết chỉ ghi gợi ý theo tiêu đề và nhãn chưa xác minh", () => {
    const related = getRelatedLessons(demoCatalog, demoRoadmap.lessonConnections ?? [], course.slug, lesson.id);
    const html = renderToStaticMarkup(createElement(LessonDetail, {
      lesson, course, chapter,
      currentState: "not_updated" as const,
      mode: "demo" as const,
      onStateChange: () => {},
      onClose: () => {},
      relatedLessons: related,
      showRelatedLessons: true,
      onSelectRelatedLesson: () => {},
    }));
    const text = strip(html);
    expect(text).toContain("Chưa có mô tả đã đối chiếu phần chữ trên trang.");
    expect(text).not.toMatch(videoClaims);
    expect(text).not.toMatch(/chưa xem nội dung video.*chưa xem nội dung video/i);
  });

  it("trang học nói rõ mô tả là phần chữ, không phải video", () => {
    const html = renderToStaticMarkup(createElement(LessonStudyView, {
      mode: "demo" as const,
      homeHref: "/demo",
      lesson,
      course,
      chapter,
      position: 1,
      total: course.lessonCount,
      previousLesson: null,
      nextLesson: null,
      initialState: "not_updated" as const,
      initialVersion: null,
      media: null,
      relatedLessons: [],
    }));
    const text = strip(html);
    expect(text).toContain("Thông tin lấy từ phần chữ trên trang bài học, không phải nội dung video.");
    expect(text).toContain("Định dạng và thời lượng lấy theo danh mục; chưa xem nội dung video.");
    expect(text).not.toMatch(videoClaims);
  });

  it("brief thực hành ghi rõ gợi ý tự luyện, không nhận là nội dung giảng viên", () => {
    const practice = demoRoadmap.practices.find((item) => item.id === "edit-cut")!;
    const html = renderToStaticMarkup(createElement(PracticeBrief, {
      practice,
      catalog: demoCatalog,
      currentState: "not_updated" as const,
      mode: "private" as const,
      onStateChange: () => {},
      onSelectLesson: () => {},
      onClose: () => {},
    }));
    const text = strip(html);
    expect(text).toContain("không phải nội dung được xác nhận từ giảng viên");
    expect(text).not.toMatch(videoClaims);
  });

  it("mọi liên kết gợi ý trong demo đều mang bằng chứng title", () => {
    for (const link of demoRoadmap.lessonConnections ?? []) {
      expect(link.basis).toBe("title");
      expect(link.reason.length).toBeGreaterThan(10);
      expect(link.reason).not.toMatch(videoClaims);
    }
  });
});
