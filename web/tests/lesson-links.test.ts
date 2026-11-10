import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LessonDetail } from "@/components/lesson-detail";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import {
  LESSON_BASIS_LABEL,
  findConnectionProblems,
  getRelatedLessons,
  type LessonConnection,
} from "@/lib/catalog/lesson-links";
import { eliteRelatedLinks } from "@/lib/catalog/elite-related-links";
import { crossCourseLinks } from "@/lib/catalog/cross-course-links";
import { privateRoadmap } from "@/components/roadmap-data";
import { loadCatalog } from "@/lib/catalog/source";
import { hasPrivateCatalog } from "./private-catalog";

const privateIt = it.skipIf(!hasPrivateCatalog);

const exampleConnection = {
  from: { courseSlug: "demo-basics", lessonId: "90003" },
  to: { courseSlug: "demo-story", lessonId: "90006" },
  kind: "foundation" as const,
  reason: "Ôn cách chọn cảnh trước khi sắp xếp clip.",
  basis: "title" as const,
};

describe("liên kết giữa các bài học", () => {
  it("tìm được bài nền liên quan từ bài đang học", () => {
    const related = getRelatedLessons(demoCatalog, [exampleConnection], "demo-basics", "90003");

    expect(related).toHaveLength(1);
    expect(related[0]).toMatchObject({
      lesson: { id: "90006", title: "Chọn cảnh", courseSlug: "demo-story" },
      courseTitle: "Kể chuyện bằng hình ảnh",
      kind: "foundation",
      reason: "Ôn cách chọn cảnh trước khi sắp xếp clip.",
      basis: "title",
      direction: "outgoing",
    });
  });

  it("cho phép từ bài bổ trợ quay lại đúng bài xuất phát", () => {
    const related = getRelatedLessons(demoCatalog, [exampleConnection], "demo-story", "90006");

    expect(related).toHaveLength(1);
    expect(related[0]).toMatchObject({
      lesson: { id: "90003", title: "Cắt và sắp xếp", courseSlug: "demo-basics" },
      courseTitle: "Làm quen dựng phim",
      direction: "incoming",
      reason: exampleConnection.reason,
    });
  });

  it("không tạo liên kết hỏng, tự trỏ đến mình hoặc lặp lại cùng một bài", () => {
    const links = [
      exampleConnection,
      exampleConnection,
      { ...exampleConnection, to: { courseSlug: "demo-story", lessonId: "khong-co" } },
      { ...exampleConnection, to: exampleConnection.from },
    ];

    expect(getRelatedLessons(demoCatalog, links, "demo-basics", "90003").map((link) => link.lesson.id)).toEqual(["90006"]);
    expect(getRelatedLessons(demoCatalog, links, "demo-story", "khong-co")).toEqual([]);
    expect(getRelatedLessons(demoCatalog, links, "demo-work", "90003")).toEqual([]);
  });

  it("trả danh sách rỗng cho bài không được gợi ý", () => {
    expect(getRelatedLessons(demoCatalog, [exampleConnection], "demo-basics", "90000")).toEqual([]);
  });

  it("demo có liên kết đi lại giữa các bài giả mà không tham chiếu khóa thật", () => {
    const connections = demoRoadmap.lessonConnections ?? [];
    const forward = getRelatedLessons(demoCatalog, connections, "demo-basics", "90003");
    const backward = getRelatedLessons(demoCatalog, connections, "demo-story", "90006");

    expect(forward.map((item) => item.lesson.id)).toContain("90006");
    expect(backward.map((item) => item.lesson.id)).toContain("90003");
    expect(JSON.stringify(connections)).not.toMatch(/baby-resolve|elite|seankangmvp/i);
  });
});

describe("dữ liệu mạng quan hệ bài–bài (9.3)", () => {
  privateIt("giữ nguyên 372 quan hệ cũ và không đổi nhóm nền tảng/bổ trợ/chuyên sâu", () => {
    const count = (links: readonly LessonConnection[]) => links.reduce<Record<string, number>>((total, link) => ({
      ...total, [link.kind]: (total[link.kind] ?? 0) + 1,
    }), {});

    // Mốc 08/11/2026: 372 cạnh, trong đó 74 foundation, 199 support, 99 advanced.
    expect(eliteRelatedLinks).toHaveLength(372);
    expect(count(eliteRelatedLinks)).toEqual({ foundation: 74, support: 199, advanced: 99 });
    expect(privateRoadmap.lessonConnections?.slice(0, 372)).toEqual(eliteRelatedLinks);
  });

  privateIt("không có cạnh tự nối, trùng chiều, ngược chiều hay đích không tồn tại", async () => {
    const catalog = await loadCatalog();

    expect(findConnectionProblems(catalog, privateRoadmap.lessonConnections ?? [])).toEqual([]);
    expect(findConnectionProblems(catalog, eliteRelatedLinks)).toEqual([]);
  });

  privateIt("giữ 372 cạnh đó khi thêm quan hệ giữa hai khóa bất kỳ có căn cứ", async () => {
    const catalog = await loadCatalog();
    const all = privateRoadmap.lessonConnections ?? [];

    expect(all.length).toBeGreaterThan(eliteRelatedLinks.length);
    // Mọi cạnh thêm vào vẫn phải qua cùng bộ kiểm tra và vẫn có chiều về.
    const added = all.slice(eliteRelatedLinks.length);
    for (const link of added) {
      const forward = getRelatedLessons(catalog, all, link.from.courseSlug, link.from.lessonId);
      const backward = getRelatedLessons(catalog, all, link.to.courseSlug, link.to.lessonId);
      const at = (items: typeof forward) =>
        items.find((item) => item.lesson.courseSlug === link.to.courseSlug && item.lesson.id === link.to.lessonId);
      expect(at(forward)?.direction).toBe("outgoing");
      expect(backward.some((item) => item.lesson.courseSlug === link.from.courseSlug && item.lesson.id === link.from.lessonId)).toBe(true);
    }
  });

  it("quan hệ liên khóa mới chỉ dùng bài có trong danh mục khi có danh mục thật", () => {
    for (const link of crossCourseLinks) {
      expect(link.from.courseSlug).not.toBe("elite");
      expect(link.to.courseSlug).not.toBe(link.from.courseSlug);
      expect(link.from.lessonId).not.toBe(link.to.lessonId);
      expect(link.basis).toBe("page_text");
      expect(link.evidence?.trim().length).toBeGreaterThan(40);
    }
  });

  privateIt("mở được quan hệ liên khóa từ cả hai phía", async () => {
    const catalog = await loadCatalog();
    const all = privateRoadmap.lessonConnections ?? [];

    for (const link of crossCourseLinks) {
      expect(getRelatedLessons(catalog, all, link.from.courseSlug, link.from.lessonId)
        .some((item) => item.lesson.courseSlug === link.to.courseSlug && item.lesson.id === link.to.lessonId)).toBe(true);
      expect(getRelatedLessons(catalog, all, link.to.courseSlug, link.to.lessonId)
        .some((item) => item.lesson.courseSlug === link.from.courseSlug && item.lesson.id === link.from.lessonId)).toBe(true);
    }
  });

  privateIt("bài chỉ có cạnh đến vẫn hiện mục liên kết trong bảng chi tiết", async () => {
    const catalog = await loadCatalog();
    const all = privateRoadmap.lessonConnections ?? [];
    // Bài đích nằm ở khóa không có cạnh đi nào: nếu giao diện chỉ dựa vào khóa nguồn thì mục này bị ẩn.
    const target = crossCourseLinks[0].to;
    const related = getRelatedLessons(catalog, all, target.courseSlug, target.lessonId);
    const course = catalog.courses.find((item) => item.slug === target.courseSlug)!;
    const chapter = course.chapters.find((item) => item.lessons.some((lesson) => lesson.id === target.lessonId))!;
    const lesson = chapter.lessons.find((item) => item.id === target.lessonId)!;

    expect(related.length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(createElement(LessonDetail, {
      lesson,
      course,
      chapter,
      currentState: "not_updated" as const,
      mode: "private" as const,
      onStateChange: () => {},
      onClose: () => {},
      relatedLessons: related,
      showRelatedLessons: related.length > 0,
      onSelectRelatedLesson: () => {},
    }));

    expect(html).toContain("Bài học liên kết");
    expect(html).toContain("Bài liên kết đến đây");
    expect(html).toContain(related.find((item) => item.lesson.courseSlug === "upwork-mvp")!.reason);
  });

  it("báo đúng lỗi dữ liệu thay vì lặng lẽ bỏ qua", () => {
    const broken = [
      exampleConnection,
      exampleConnection,
      { ...exampleConnection, to: exampleConnection.from },
      { ...exampleConnection, to: { courseSlug: "demo-story", lessonId: "khong-co" } },
      { ...exampleConnection, reason: "  " },
      { ...exampleConnection, to: { courseSlug: "demo-work", lessonId: "90009" }, basis: "page_text" as const },
    ];

    const problems = findConnectionProblems(demoCatalog, broken).join("\n");
    expect(problems).toMatch(/trùng hoặc ngược chiều/);
    expect(problems).toMatch(/tự nối/);
    expect(problems).toMatch(/thiếu bài đích/);
    expect(problems).toMatch(/thiếu lý do/);
    expect(problems).toMatch(/page_text phải kèm nguồn/);
  });
});

describe("phân biệt mức bằng chứng của gợi ý (9.4)", () => {
  it("mỗi mức bằng chứng có nhãn riêng và không nhãn nào nhận là đã xem video", () => {
    expect(Object.keys(LESSON_BASIS_LABEL)).toEqual(["title", "page_text", "learner_observation"]);
    for (const label of Object.values(LESSON_BASIS_LABEL)) {
      expect(label).not.toMatch(/đã xem toàn bộ video|video đã xác minh/i);
    }
    expect(LESSON_BASIS_LABEL.title).toMatch(/chưa xác minh nội dung video/);
    expect(LESSON_BASIS_LABEL.page_text).toMatch(/chưa xem nội dung video/);
    expect(LESSON_BASIS_LABEL.learner_observation).toMatch(/không suy ra toàn bộ video/);
  });

  it("trả kèm lý do, mức bằng chứng và nguồn tương ứng", () => {
    const connection: LessonConnection = {
      ...exampleConnection,
      basis: "page_text",
      evidence: "Đối chiếu chữ trang hai bài; chưa xem video.",
    };
    const [related] = getRelatedLessons(demoCatalog, [connection], "demo-basics", "90003");

    expect(related.reason).toBe(connection.reason);
    expect(related.basis).toBe("page_text");
    expect(related.evidence).toBe(connection.evidence);
    expect(related.basisLabel).toBe(LESSON_BASIS_LABEL.page_text);
  });

  it("dữ liệu cũ chỉ có tiêu đề không tự được nâng mức xác minh", () => {
    for (const link of [...(demoRoadmap.lessonConnections ?? []), ...eliteRelatedLinks]) {
      expect(link.basis).toBe("title");
      expect(link.evidence).toBeUndefined();
    }
    const [related] = getRelatedLessons(demoCatalog, [exampleConnection], "demo-basics", "90003");
    expect(related.basisLabel).toBe(LESSON_BASIS_LABEL.title);
  });

  it("mức quan sát của người học hiển thị riêng và không suy ra toàn bộ video", () => {
    const connection: LessonConnection = {
      ...exampleConnection,
      basis: "learner_observation",
      evidence: "Người học ghi đã xem đoạn chọn cảnh trong bài này ngày 09/11.",
    };
    const [related] = getRelatedLessons(demoCatalog, [connection], "demo-basics", "90003");
    const html = renderToStaticMarkup(createElement(LessonDetail, {
      lesson: demoCatalog.courses[0].chapters[1].lessons[0],
      course: demoCatalog.courses[0],
      chapter: demoCatalog.courses[0].chapters[1],
      currentState: "not_updated" as const,
      mode: "demo" as const,
      onStateChange: () => {},
      onClose: () => {},
      relatedLessons: [related],
      showRelatedLessons: true,
    }));

    expect(related.basis).toBe("learner_observation");
    expect(html).toContain("Theo nội dung người học đã xem; không suy ra toàn bộ video");
    expect(html).toContain(connection.evidence);
    // Không được nói rằng cả video đã được xác minh.
    expect(html).not.toMatch(/toàn bộ video đã xác minh|đã xem toàn bộ video/i);
  });

  privateIt("mức bằng chứng trong dữ liệu thật khớp với nguồn đã ghi", async () => {
    const catalog = await loadCatalog();
    const all = privateRoadmap.lessonConnections ?? [];

    for (const link of all) {
      if (link.basis === "title") continue;
      expect(link.evidence?.trim().length).toBeGreaterThan(0);
      const [related] = getRelatedLessons(catalog, [link], link.from.courseSlug, link.from.lessonId);
      expect(related.basisLabel).toBe(LESSON_BASIS_LABEL[link.basis]);
      expect(related.evidence).toBe(link.evidence);
    }
    // Chưa có quan sát trực tiếp nào, nên không mục nào được mang mức đó.
    expect(all.filter((link) => link.basis === "learner_observation")).toEqual([]);
  });
});
