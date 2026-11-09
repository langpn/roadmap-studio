import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { Workspace } from "@/components/workspace";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { PRACTICE_IDS } from "@/lib/progress/practice-ids";

it("giáo trình hiển thị cả khóa mới ngoài danh sách đã biết", () => {
  const catalog = structuredClone(demoCatalog);
  catalog.courses[0].slug = "baby-resolve";
  catalog.courses[1].title = "Khóa bổ sung giả lập";
  const output = renderToStaticMarkup(createElement(Workspace, {
    catalog,
    roadmap: demoRoadmap,
    initialProgress: { lessons: {}, practices: {}, lastOpenedLessonId: null },
    mode: "demo",
    userName: "Người học thử",
  }));
  expect(output).toContain("Khóa bổ sung giả lập");
  expect(output).toContain("Giáo trình (3 khóa)");
  expect(output).toContain("Bài thực hành");
  expect(output).toContain(`0/${PRACTICE_IDS.length}`);
});

it("ưu tiên bài Elite chưa hoàn thành trong bước tiếp theo của chế độ cá nhân", () => {
  const catalog = structuredClone(demoCatalog);
  const course = catalog.courses[0];
  course.slug = "elite";
  const lessons = course.chapters.flatMap((chapter) => chapter.lessons);
  const output = renderToStaticMarkup(createElement(Workspace, {
    catalog,
    roadmap: demoRoadmap,
    initialProgress: { lessons: { [lessons[0].id]: "completed" }, practices: {}, lastOpenedLessonId: null },
    mode: "private",
    userName: "Người học thử",
  }));
  expect(output).toContain(`Bắt đầu: ${lessons[1].title}`);
  expect(output).toContain("Mở bài học");
  expect(output).not.toContain("Mở việc cần làm");
});
