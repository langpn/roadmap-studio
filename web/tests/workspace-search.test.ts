import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Workspace } from "@/components/workspace";
import { EliteRoadmap } from "@/components/elite-roadmap";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import type { Progress } from "@/lib/progress/store";

function workspace(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(createElement(Workspace, {
    catalog: demoCatalog,
    roadmap: demoRoadmap,
    initialProgress: { lessons: {}, practices: {}, lastOpenedLessonId: null } as Progress,
    mode: "demo",
    userName: "Người học thử",
    ...overrides,
  }));
}

describe("tìm kiếm trong không gian học", () => {
  it("giữ ô tìm toàn hệ thống và hướng dẫn tìm không dấu", () => {
    const html = workspace();
    expect(html).toContain("Tìm kiếm bài học toàn hệ thống");
    expect(html).toContain(`Tìm kiếm bài học trên ${demoCatalog.courses.length} khóa (không dấu)`);
  });

  it("bước tiếp theo là bài Elite chưa hoàn thành sớm nhất theo thứ tự nguồn", () => {
    const catalog = structuredClone(demoCatalog);
    catalog.courses[0].slug = "elite";
    const lessons = catalog.courses[0].chapters.flatMap((chapter) => chapter.lessons);
    const html = workspace({
      catalog,
      mode: "private",
      initialProgress: {
        // Hoàn thành bài 1 và bài 4: bài 4 xong trước nhưng không được nhảy cóc qua bài 2.
        lessons: { [lessons[0].id]: "completed", [lessons[3].id]: "completed" },
        practices: {},
        lastOpenedLessonId: lessons[3].id,
      },
    });
    expect(html).toContain(`Bắt đầu: ${lessons[1].title}`);
  });

  it("không có khóa Elite thì quay về gợi ý bài thực hành, không bịa bài Elite", () => {
    const html = workspace({ mode: "private" });
    expect(html).toContain("Chưa có giáo trình Elite");
    expect(html).toContain("Mở việc cần làm");
    expect(html).not.toContain("Bài tiếp theo theo thứ tự giáo trình Elite");
  });

  it("bản cá nhân không có danh mục vẫn mở được và chỉ đường nhập danh mục", () => {
    const html = workspace({
      catalog: { courses: [], chapterCount: 0, lessonCount: 0 },
      mode: "private",
    });
    expect(html).toContain("Chưa có danh mục bài học trên máy này");
    expect(html).toContain("Chưa có giáo trình Elite");
  });
});

describe("lộ trình Elite khi danh mục thiếu hoặc lệch", () => {
  const props = {
    catalog: demoCatalog,
    roadmap: demoRoadmap,
    progress: { lessons: {}, practices: {}, lastOpenedLessonId: null } as Progress,
    onSelectCourse: () => {},
    onOpenPractice: () => {},
    onSelectLessonById: () => {},
    mode: "private" as const,
  };

  it("báo chưa có giáo trình khi danh mục không có khóa Elite", () => {
    const html = renderToStaticMarkup(createElement(EliteRoadmap, props));
    expect(html).toContain("Chưa có giáo trình Elite");
    expect(html).toContain("Hãy nhập danh mục có khóa Elite");
  });

  it("chương rỗng hiện thông báo riêng, không làm hỏng lộ trình", () => {
    const catalog = structuredClone(demoCatalog);
    catalog.courses[0].slug = "elite";
    catalog.courses[0].chapters.push({
      id: "999", title: "Chương chưa có bài", url: "https://example.invalid/", position: 9, lessons: [],
    });
    const html = renderToStaticMarkup(createElement(EliteRoadmap, { ...props, catalog }));
    expect(html).toContain("Chưa có bài học trong chương này.");
    expect(html).toContain("Chương chưa có bài");
  });

  it("liệt kê bài theo đúng thứ tự chương/bài của danh mục", () => {
    const catalog = structuredClone(demoCatalog);
    catalog.courses[0].slug = "elite";
    const html = renderToStaticMarkup(createElement(EliteRoadmap, { ...props, catalog }));
    const chapters = catalog.courses[0].chapters;
    const first = chapters[0].lessons;
    for (let index = 1; index < first.length; index += 1) {
      expect(html.indexOf(first[index - 1].title)).toBeLessThan(html.indexOf(first[index].title));
    }
    expect(html.indexOf(first.at(-1)!.title)).toBeLessThan(html.indexOf(chapters[1].lessons[0].title));
  });
});
