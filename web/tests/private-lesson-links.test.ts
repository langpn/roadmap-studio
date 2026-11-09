import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { privateRoadmap } from "@/components/roadmap-data";
import { Workspace } from "@/components/workspace";
import { getRelatedLessons } from "@/lib/catalog/lesson-links";
import { loadCatalog } from "@/lib/catalog/source";
import { hasPrivateCatalog } from "./private-catalog";

const privateIt = it.skipIf(!hasPrivateCatalog);

describe("mạng bài học cá nhân lấy Elite làm trục", () => {
  privateIt("đưa lối vào mạng bài học lên trang tổng quan cá nhân", async () => {
    const catalog = await loadCatalog();
    const html = renderToStaticMarkup(createElement(Workspace, {
      catalog,
      roadmap: privateRoadmap,
      initialProgress: { lessons: {}, practices: {}, lastOpenedLessonId: null },
      mode: "private",
      userName: "bạn",
    }));

    expect(html.includes("Khám phá bài học liên kết:")).toBe(true);
  });

  privateIt("gợi ý nền tảng cắt dựng và cho phép quay lại bài Elite", async () => {
    const catalog = await loadCatalog();
    const connections = privateRoadmap.lessonConnections ?? [];
    const forward = getRelatedLessons(catalog, connections, "elite", "5860");
    const backward = getRelatedLessons(catalog, connections, "baby-resolve", "2207");

    expect(forward.some((item) => item.lesson.courseSlug === "baby-resolve" && item.lesson.id === "2207")).toBe(true);
    expect(backward.some((item) => item.lesson.courseSlug === "elite" && item.lesson.id === "5860")).toBe(true);
  });

  privateIt("nối hai bài Elite khi phụ đề và thiết kế chữ cùng liên quan", async () => {
    const catalog = await loadCatalog();
    const connections = privateRoadmap.lessonConnections ?? [];
    const forward = getRelatedLessons(catalog, connections, "elite", "5862");
    const backward = getRelatedLessons(catalog, connections, "elite", "5863");

    expect(forward.some((item) => item.lesson.courseSlug === "elite" && item.lesson.id === "5863")).toBe(true);
    expect(backward.some((item) => item.lesson.courseSlug === "elite" && item.lesson.id === "5862")).toBe(true);
  });

  privateIt("đi và quay lại giữa các phần liên tiếp của chuỗi Elite", async () => {
    const catalog = await loadCatalog();
    const connections = privateRoadmap.lessonConnections ?? [];
    expect(getRelatedLessons(catalog, connections, "elite", "1961").some((item) => item.lesson.id === "1962")).toBe(true);
    const backward = getRelatedLessons(catalog, connections, "elite", "1962").find((item) => item.lesson.id === "1961");
    expect(backward?.reason).toContain("liền kề");
    expect(backward?.reason).not.toContain("tiếp theo");
  });

  privateIt("hiển thị và liên kết các bài Pro có tên trong danh mục cá nhân", async () => {
    const catalog = await loadCatalog();
    const connections = privateRoadmap.lessonConnections ?? [];
    const related = getRelatedLessons(catalog, connections, "elite", "2129");
    expect(related.some((item) => item.lesson.courseSlug === "elite-pro" && item.lesson.id === "3719" && !item.lesson.titleWithheld)).toBe(true);
    expect(getRelatedLessons(catalog, connections, "elite-pro", "3296").some((item) => item.lesson.id === "2183")).toBe(true);
  });

  privateIt("gợi ý bài Pro về 3D tracking kể cả khi tiêu đề có tên học viên", async () => {
    const catalog = await loadCatalog();
    const connections = privateRoadmap.lessonConnections ?? [];
    const pro = getRelatedLessons(catalog, connections, "elite", "2160").find((item) =>
      item.lesson.courseSlug === "elite-pro" && item.lesson.id === "3304",
    );
    expect(pro?.lesson.titleWithheld).toBe(false);
    expect(pro?.reason.toLowerCase()).toContain("tracking");
    expect(getRelatedLessons(catalog, connections, "elite-pro", "3304").some((item) => item.lesson.id === "2160")).toBe(true);
  });

  privateIt("chỉ nối các bài có trong đúng khóa, không lặp và không dùng tiêu đề đã ẩn", async () => {
    const catalog = await loadCatalog();
    const connections = privateRoadmap.lessonConnections ?? [];
    const lessons = new Map(catalog.courses.flatMap((course) => course.chapters.flatMap((chapter) =>
      chapter.lessons.map((lesson) => [String(`${course.slug}:${lesson.id}`), lesson] as const),
    )));
    const pairs = new Set<string>();

    expect(connections.length).toBeGreaterThan(0);
    for (const link of connections) {
      const from = `${link.from.courseSlug}:${link.from.lessonId}`;
      const to = `${link.to.courseSlug}:${link.to.lessonId}`;
      expect(link.from.courseSlug).toBe("elite");
      expect(lessons.get(from)).toBeDefined();
      expect(lessons.get(to)).toBeDefined();
      expect(lessons.get(from)?.titleWithheld).toBe(false);
      expect(lessons.get(to)?.titleWithheld).toBe(false);
      expect(from).not.toBe(to);
      expect(pairs.has(`${from}>${to}`)).toBe(false);
      expect(pairs.has(`${to}>${from}`)).toBe(false);
      expect(link.reason.trim().length).toBeGreaterThan(10);
      expect(link.basis).toBe("title");
      pairs.add(`${from}>${to}`);
    }
  });

  it("có gợi ý nền tảng, tìm việc và nâng cao, không nối từ bài đang cập nhật", () => {
    const connections = privateRoadmap.lessonConnections ?? [];
    const courses = new Set(connections.map((link) => link.to.courseSlug));

    for (const course of ["baby-resolve", "freelance-mvp", "elite-pro"]) {
      expect(courses.has(course)).toBe(true);
    }
    expect(connections.some((link) => ["5677", "5678", "5697"].includes(link.from.lessonId))).toBe(false);
    expect(JSON.stringify(connections)).not.toMatch(/https?:\/\/|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i);
  });
});
