import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SearchResults } from "@/components/search-results";
import { searchLessonMatches } from "@/lib/catalog/search";
import { demoCatalog } from "@/lib/catalog/demo";
import type { ProgressState } from "@/lib/progress/store";

const basics = demoCatalog.courses[0];

function render(overrides: Partial<Parameters<typeof SearchResults>[0]> = {}) {
  const { matches, total } = searchLessonMatches(demoCatalog, "sap xep");
  return renderToStaticMarkup(createElement(SearchResults, {
    query: "sap xep",
    status: "all" as const,
    matches,
    total,
    progress: {} as Record<string, ProgressState>,
    onStatusChange: () => {},
    onSelect: () => {},
    onClear: () => {},
    ...overrides,
  }));
}

describe("tìm bài theo tên và trạng thái", () => {
  it("tìm không dấu, không phân biệt hoa thường và giữ thứ tự nguồn", () => {
    const { matches } = searchLessonMatches(demoCatalog, "  SAP XEP  ");
    expect(matches.map((match) => match.lesson.title)).toEqual(["Sắp xếp tư liệu", "Cắt và sắp xếp"]);
    expect(matches[0].course.slug).toBe(basics.slug);
    expect(matches[0].chapter.id).toBe(basics.chapters[0].id);
  });

  it("tìm được theo mã bài và theo vị trí trong tên", () => {
    const byId = searchLessonMatches(demoCatalog, "90003");
    expect(byId.matches.map((match) => match.lesson.title)).toEqual(["Cắt và sắp xếp"]);
    expect(searchLessonMatches(demoCatalog, "timeline").matches.map((match) => match.lesson.title))
      .toEqual(["Đưa clip vào timeline"]);
  });

  it("lọc theo trạng thái trên kết quả đã tìm và đếm đúng tổng", () => {
    const all = searchLessonMatches(demoCatalog, "");
    const completed = searchLessonMatches(demoCatalog, "", "completed", { "90000": "completed", "90004": "in_progress" });
    expect(completed.matches.map((match) => match.lesson.id)).toEqual(["90000"]);
    expect(completed.total).toBe(1);
    expect(all.total).toBe(demoCatalog.lessonCount);
    const inProgress = searchLessonMatches(demoCatalog, "", "in_progress", { "90004": "in_progress" });
    expect(inProgress.matches.map((match) => match.lesson.id)).toEqual(["90004"]);
    const notUpdated = searchLessonMatches(demoCatalog, "", "not_updated", { "90000": "completed" });
    expect(notUpdated.total).toBe(demoCatalog.lessonCount - 1);
    expect(notUpdated.matches.some((match) => match.lesson.id === "90000")).toBe(false);
  });

  it("chặn số kết quả hiển thị nhưng vẫn báo tổng thật", () => {
    const limited = searchLessonMatches(demoCatalog, "", "all", {}, 2);
    expect(limited.matches).toHaveLength(2);
    expect(limited.total).toBe(demoCatalog.lessonCount);
  });

  it("nêu rõ khi không có kết quả và cho xóa bộ lọc", () => {
    const html = render({ matches: [], total: 0, query: "khong co bai nao" });
    expect(html).toContain("Không tìm thấy bài học nào phù hợp với từ khóa");
    expect(html).toContain("khong co bai nao");
    expect(html).toContain("Xóa tìm kiếm");
    expect(html).toContain("0 bài phù hợp");
  });

  it("nêu cả từ khóa và trạng thái khi bộ lọc trạng thái không khớp", () => {
    const html = render({ matches: [], total: 0, status: "completed" });
    expect(html).toContain("và trạng thái “Đã hoàn thành”");
  });

  it("hiển thị bài khớp kèm đường dẫn khóa/chương và trạng thái đọc được", () => {
    const html = render({ progress: { "90000": "completed" } as Record<string, ProgressState> });
    expect(html).toContain("Sắp xếp tư liệu");
    expect(html).toContain("Làm quen dựng phim &gt; Bắt đầu với project (Bài #90000)");
    expect(html).toContain("Đã hoàn thành");
    expect(html).not.toContain("Đang hiển thị");
  });

  it("báo phần kết quả bị cắt khi vượt giới hạn", () => {
    const { matches } = searchLessonMatches(demoCatalog, "", "all", {}, 2);
    const html = render({ matches, total: demoCatalog.lessonCount });
    expect(html).toContain(`Đang hiển thị 2 trên ${demoCatalog.lessonCount} kết quả`);
  });
});
