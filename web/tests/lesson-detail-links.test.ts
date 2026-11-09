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

describe("bài học liên kết trong bảng chi tiết", () => {
  it("giải thích mối liên quan và hiển thị bài có thể mở", () => {
    const html = render({
      relatedLessons: [related],
      onSelectRelatedLesson: () => {},
      showRelatedLessons: true,
    });

    expect(html).toContain("Bài học liên kết");
    expect(html).toContain("Nền tảng");
    expect(html).toContain("Chọn cảnh");
    expect(html).toContain("Ôn cách chọn cảnh trước khi sắp xếp clip.");
    expect(html).toContain("tiêu đề");
    expect(html).toMatch(/<button[^>]*>[\s\S]*Chọn cảnh/);
  });

  it("nêu rõ khi bài chưa có gợi ý", () => {
    const html = render({ relatedLessons: [], onSelectRelatedLesson: () => {}, showRelatedLessons: true });

    expect(html).toContain("Chưa có bài liên kết gợi ý");
  });
});

describe("bảng chi tiết bài học gọn để quét", () => {
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
    expect(html).toContain(evidence);
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
    expect(html).toContain("Bài tiếp theo: Bài sau");
    expect(html).toMatch(/aria-pressed="true"[^>]*>[\s\S]*Đang học|Đang học[\s\S]*aria-pressed="true"/);
    expect(html).toContain("Chưa học");
    expect(html).toContain("Đã hoàn thành");
  });

  it("giữ liên kết dự phòng tới website gốc khi mở cửa sổ riêng", () => {
    const sourceUrl = "https://seankangmvp.com/courses/elite/chapters/1/lessons/90000";
    const html = render({ mode: "private", sourceUrl });

    expect(html).toContain(`href="/bai-hoc/${lesson.id}"`);
    expect(html).toContain("Xem bài học trên website gốc");
    expect(html).toContain(`href="${sourceUrl}"`);
    expect(html).toContain("Mở trong thẻ mới");
  });

  it("vẫn dựng được khi thiếu chương thay vì coi bài là bài đầu", () => {
    const html = render({ chapter: null });

    expect(html).toContain("Thông tin bài");
    expect(html).not.toContain("trong chương</li>");
    expect(html).toContain(lesson.title);
  });

  it("khóa liên kết nguồn trong chế độ demo", () => {
    const html = render({ sourceUrl: "https://seankangmvp.com/courses/elite/chapters/1/lessons/90000" });

    expect(html).not.toContain("Xem bài học trên website gốc");
    expect(html).toContain("chỉ mở trong phiên học cá nhân");
  });
});
