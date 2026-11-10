import { describe, expect, it } from "vitest";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { getPracticesForLesson } from "@/lib/catalog/lesson-practices";
import { formatLearningContext, formatPracticeContext } from "@/lib/learning-context";

describe("ngữ cảnh ghi chú", () => {
  const course = demoCatalog.courses[0];
  const chapter = course.chapters[1];
  const lesson = chapter.lessons[0];

  it("chỉ dùng dữ liệu bài mẫu và thực hành liên quan", () => {
    const text = formatLearningContext(course, lesson, getPracticesForLesson(demoRoadmap.practices, course.slug, lesson.id), true);
    expect(text).toContain(course.title);
    expect(text).toContain(lesson.title);
    expect(text).toContain(lesson.id);
    expect(text).toContain("edit-cut");
    expect(text).toContain("?demo=1");
    expect(text).not.toContain("seankangmvp.com");
    expect(text).not.toContain("cookie");
  });

  it("nêu rõ khi chưa có bài thực hành và mức bằng chứng", () => {
    const text = formatLearningContext(course, lesson, [], true);
    expect(text).toContain("Chưa có bài thực hành liên quan");
    expect(text).toContain("chưa xác minh nội dung video");
  });

  it("giữ đúng địa chỉ ứng dụng đang mở khi chạy demo ở cổng khác", () => {
    const text = formatLearningContext(course, lesson, [], true, "http://127.0.0.1:3000");
    expect(text).toContain("http://127.0.0.1:3000/bai-hoc/");
  });

  it("sao chép được thực hành độc lập và không tạo nguồn giả", () => {
    const practice = { ...demoRoadmap.practices[0], shortcutLessonIds: [] };
    const text = formatPracticeContext(practice, demoCatalog, true);
    expect(text).toContain(practice.id);
    expect(text).toContain(practice.title);
    expect(text).toContain("Chưa có bài học liên quan");
    expect(text).not.toContain("seankangmvp.com");
  });

  it("không tạo đường về khi bài liên quan không còn trong danh mục", () => {
    const practice = { ...demoRoadmap.practices[0], shortcutLessonIds: [{ id: "99999", courseSlug: course.slug, label: "Bài đã thiếu" }] };
    const text = formatPracticeContext(practice, demoCatalog, true);
    expect(text).toContain("Bài học liên quan không còn trong danh mục");
    expect(text).not.toContain("99999");
  });
});
