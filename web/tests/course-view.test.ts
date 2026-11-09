import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CourseView } from "@/components/course-view";
import { demoCatalog } from "@/lib/catalog/demo";
import type { Progress } from "@/lib/progress/store";

const course = demoCatalog.courses[0];
const baseProgress: Progress = { lessons: {}, practices: {}, lastOpenedLessonId: null };

function render(courseValue = course, progress = baseProgress, saving = false) {
  return renderToStaticMarkup(createElement(CourseView, {
    course: courseValue,
    courseRoles: {},
    progress,
    onSelectLesson: () => {},
    onUpdateLessonState: () => {},
    mode: "demo",
    saving,
  }));
}

describe("danh sách bài trong một khóa", () => {
  it("giữ thứ tự nguồn của bài trong chương", () => {
    const html = render();
    const titles = course.chapters[0].lessons.map((lesson) => lesson.title);
    for (let index = 1; index < titles.length; index += 1) {
      expect(html.indexOf(titles[index - 1])).toBeLessThan(html.indexOf(titles[index]));
    }
  });

  it("báo chương chưa có bài khác với bộ lọc không khớp", () => {
    const empty = structuredClone(course);
    empty.chapters.push({ id: "rỗng", title: "Chương trống", url: "https://example.invalid/", position: 9, lessons: [] });
    const html = render(empty);
    expect(html).toContain("Chương này chưa có bài học.");
    expect(html).not.toContain("Không có bài nào phù hợp với bộ lọc hiện tại.");
  });

  it("nêu rõ khi bộ lọc theo trạng thái không khớp bài nào", () => {
    // Bộ lọc mặc định "all" nhưng chỉ chương đầu mở; đặt toàn bộ bài đã hoàn thành để lọc trống.
    const all = Object.fromEntries(course.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => [lesson.id, "not_updated" as const])));
    const html = render(course, { ...baseProgress, lessons: all });
    expect(html).toContain("Tất cả bài");
    expect(html).not.toContain("Chương này chưa có bài học.");
  });

  it("bài thiếu tiêu đề gốc được đánh dấu, không tự đặt tên", () => {
    const withheld = structuredClone(course);
    withheld.chapters[0].lessons[0] = { ...withheld.chapters[0].lessons[0], title: "Bài chưa có tiêu đề", titleWithheld: true };
    const html = render(withheld);
    expect(html).toContain("Thiếu tiêu đề");
    expect(html).toContain("Bài chưa có tiêu đề");
  });
});
