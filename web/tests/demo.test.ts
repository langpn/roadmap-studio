import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import DemoPage from "@/app/demo/page";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { hasPrivateCatalog, readRealLessons } from "./real-catalog";

/** Trang chủ đọc tham số lối vào thực hành; test không truyền tham số. */
const EMPTY = { searchParams: Promise.resolve({}) };

// Tên bài ngắn dễ trùng câu tiếng Việt thường, nên chỉ so từ 12 ký tự.
const MIN_TITLE = 12;
const MIN_DESCRIPTION = 30;

it("bản trình diễn chỉ có dữ liệu giả và không dẫn đến khóa học thật", () => {
  const payload = JSON.stringify(demoCatalog);
  expect(demoCatalog.courses.length).toBeGreaterThan(0);
  expect(demoCatalog.lessonCount).toBeGreaterThan(0);
  expect(payload).not.toContain("seankangmvp.com");
  expect(payload).not.toContain("Baby Resolve");
  expect(payload).not.toContain("Elite Pro");
});

it("mọi bài và khóa demo dùng địa chỉ mẫu, không trỏ website thật", () => {
  const urls = [
    ...demoCatalog.courses.map((course) => course.url),
    ...demoCatalog.courses.flatMap((course) => course.chapters.flatMap((chapter) => [
      chapter.url, ...chapter.lessons.map((lesson) => lesson.url),
    ])),
  ];
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) expect(new URL(url).hostname).toBe("example.invalid");
  for (const course of demoCatalog.courses) expect(course.slug.startsWith("demo-")).toBe(true);
  expect(JSON.stringify(demoRoadmap)).not.toContain("https://");
});

it.skipIf(!hasPrivateCatalog)("dữ liệu demo không trùng tên, mô tả, URL hay mã bài của danh mục thật", () => {
  const lessons = readRealLessons();
  const demo = JSON.stringify({ catalog: demoCatalog, roadmap: demoRoadmap });
  const demoIds = new Set(demoCatalog.courses.flatMap((course) => course.chapters.flatMap((chapter) =>
    chapter.lessons.map((lesson) => lesson.id))));

  for (const lesson of lessons) {
    expect(demoIds.has(lesson.id), `mã bài thật: ${lesson.id}`).toBe(false);
    expect(demo).not.toContain(lesson.url);
    if (lesson.name.length >= MIN_TITLE) expect(demo).not.toContain(lesson.name);
    if (lesson.description.length >= MIN_DESCRIPTION) expect(demo).not.toContain(lesson.description);
  }
});

it.skipIf(!hasPrivateCatalog)("HTML trang demo không trả tên, mô tả hay URL bài thật", async () => {
  const html = renderToStaticMarkup(await DemoPage(EMPTY));
  expect(html).toContain("Chế độ thử nghiệm");
  for (const lesson of readRealLessons()) {
    expect(html).not.toContain(lesson.url);
    if (lesson.name.length >= MIN_TITLE) expect(html).not.toContain(lesson.name);
    if (lesson.description.length >= MIN_DESCRIPTION) expect(html).not.toContain(lesson.description);
  }
  expect(html).not.toContain("seankangmvp.com");
});
