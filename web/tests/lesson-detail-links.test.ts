import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { LessonDetail } from "@/components/lesson-detail";
import { demoCatalog } from "@/lib/catalog/demo";
import type { RelatedLesson } from "@/lib/catalog/lesson-links";
import type { Lesson } from "@/lib/catalog/normalize";

const basics = demoCatalog.courses[0];
const story = demoCatalog.courses[1];
const chapter = basics.chapters[1];
const lesson = chapter.lessons[0];
const related: RelatedLesson = {
  lesson: story.chapters[0].lessons[0],
  courseTitle: story.title,
  kind: "foundation",
  reason: "Ôn cách chọn cảnh trước khi sắp xếp clip.",
  basis: "title",
  basisLabel: "Gợi ý theo tiêu đề; chưa xác minh nội dung video",
  direction: "outgoing",
};

function render(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(createElement(LessonDetail, {
    lesson,
    course: basics,
    chapter,
    currentState: "not_updated",
    mode: "demo",
    onStateChange: () => {},
    onClose: () => {},
    ...overrides,
  }));
}

describe("bảng chi tiết bài học", () => {
  it("hiển thị bài liên kết cùng lý do và mức bằng chứng", () => {
    const html = render({ relatedLessons: [related], showRelatedLessons: true });
    expect(html).toContain("Bài học liên kết");
    expect(html).toContain(related.lesson.title);
    expect(html).toContain(related.reason);
    expect(html).toContain("tiêu đề");
    expect(html).toContain(related.basisLabel);
    expect(html).toContain(`href="/bai-hoc/${related.lesson.id}?demo=1"`);
    expect(html).toContain(`href="/bai-hoc/${lesson.id}?demo=1"`);
  });

  it("phân biệt gợi ý theo tiêu đề với gợi ý đã đối chiếu phần chữ", () => {
    const titleOnly = render({ relatedLessons: [related], showRelatedLessons: true });
    const pageText: RelatedLesson = {
      ...related,
      basis: "page_text",
      basisLabel: "Đối chiếu phần chữ hai trang; chưa xem nội dung video",
      evidence: "Chữ trang hai bài khớp chủ đề; chưa xem video.",
    };
    const withText = render({ relatedLessons: [pageText], showRelatedLessons: true });

    expect(titleOnly).toContain("Gợi ý theo tiêu đề; chưa xác minh nội dung video");
    expect(titleOnly).not.toContain("Đối chiếu phần chữ hai trang");
    expect(withText).toContain("Đối chiếu phần chữ hai trang; chưa xem nội dung video");
    expect(withText).toContain(pageText.evidence);
    expect(withText).not.toContain("Gợi ý theo tiêu đề; chưa xác minh nội dung video");
  });
});

describe("bảng chi tiết bài học gọn để quét", () => {
  it("đặt mô tả trước liên kết mở trang học ở tab mới", () => {
    const html = render({ lesson: { ...lesson, summary: "Mô tả ngắn của bài." } });
    expect(html.indexOf("Mô tả ngắn của bài.")).toBeLessThan(html.indexOf("Mở trang học"));
    expect(html).toMatch(/<a[^>]*target="_blank"[^>]*href="\/bai-hoc\/|<a[^>]*href="\/bai-hoc\/[^>]*target="_blank"/);
  });
  it("đưa lối vào trang học riêng lên trước và không nhúng trình phát", () => {
    const html = render();

    expect(html).toContain(`href="/bai-hoc/${lesson.id}?demo=1"`);
    expect(html).toContain("Mở trang học");
    expect(html).not.toContain("iframe");
    expect(html).not.toContain("Đang mở video bài học");
    expect(html.indexOf("Mở trang học")).toBeLessThan(html.indexOf("Tiến độ của bạn"));
  });

  it("giữ nguyên mô tả nguồn và ghi chú đối chiếu", () => {
    const summary = "Phần chữ đề cập chèn và tùy chỉnh chữ trong Resolve.";
    const evidence = "Đã đối chiếu phần chữ trang; chưa xem nội dung video.";
    const html = render({ lesson: { ...lesson, summary, summaryEvidence: evidence } as Lesson });

    expect(html).toContain(summary);
    expect(html).not.toContain(evidence);
  });

  it("vẫn giữ ba trạng thái tiến độ và điều hướng trước sau", () => {
    const html = render({
      currentState: "in_progress",
      previousLessonTitle: "Bài trước",
      onPreviousLesson: () => {},
      nextLessonTitle: "Bài sau",
      onNextLesson: () => {},
    });

    expect(html).toContain("Quay lại: Bài trước");
    expect(html).not.toContain("Bài tiếp theo: Bài sau");
    expect(html).toMatch(/aria-pressed="true"[^>]*>[\s\S]*Đang học|Đang học[\s\S]*aria-pressed="true"/);
    expect(html).toContain("Chưa học");
    expect(html).toContain("Đã hoàn thành");
  });

  it("giữ liên kết dự phòng tới website gốc khi mở cửa sổ riêng", () => {
    const sourceUrl = "https://seankangmvp.com/courses/elite/chapters/1/lessons/90000";
    const html = render({ mode: "private", sourceUrl });

    expect(html).toContain(`href="/bai-hoc/${lesson.id}"`);
    expect(html).not.toContain(`href="${sourceUrl}"`);
  });

  it("vẫn dựng được khi thiếu chương thay vì coi bài là bài đầu", () => {
    const html = render({ chapter: null });

    expect(html).toContain("Mô tả bài");
    expect(html).not.toContain("trong chương</li>");
    expect(html).toContain(lesson.title);
  });

  it("khóa liên kết nguồn trong chế độ demo", () => {
    const html = render({ sourceUrl: "https://seankangmvp.com/courses/elite/chapters/1/lessons/90000" });

    expect(html).not.toContain("Xem bài học trên website gốc");
    expect(html).not.toContain("seankangmvp.com");
  });
});
