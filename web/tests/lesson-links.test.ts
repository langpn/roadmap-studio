import { describe, expect, it } from "vitest";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { getRelatedLessons } from "@/lib/catalog/lesson-links";

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
