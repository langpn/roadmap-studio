import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoadmapDiagram } from "@/components/roadmap-diagram";
import { Workspace } from "@/components/workspace";
import { privateRoadmap } from "@/components/roadmap-data";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { PRACTICE_IDS } from "@/lib/progress/practice-ids";
import { loadCatalog } from "@/lib/catalog/source";
import { hasPrivateCatalog } from "./private-catalog";

const privateIt = it.skipIf(!hasPrivateCatalog);

const emptyProgress = { lessons: {}, practices: {}, lastOpenedLessonId: null };

function unescape(html: string) {
  return html.replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
}

/** Chuỗi node đã render của trục Elite, theo đúng thứ tự xuất hiện. */
function trunkNodes(html: string) {
  return [...html.matchAll(/data-kind="(lesson|practice|milestone)">[\s\S]*?<strong>([\s\S]*?)<\/strong>/g)]
    .map((match) => ({ kind: match[1], title: unescape(match[2]) }));
}

function renderTrunk(catalog: Awaited<ReturnType<typeof loadCatalog>>) {
  return renderToStaticMarkup(createElement(RoadmapDiagram, {
    catalog,
    roadmap: privateRoadmap,
    progress: emptyProgress,
    onSelectCourse: () => {},
    onOpenPractice: () => {},
    onSelectLessonById: () => {},
    mode: "private",
  }));
}

function renderWorkspace(entryPracticeId: string, practices: Record<string, "completed"> = {}) {
  return renderToStaticMarkup(createElement(Workspace, {
    catalog: demoCatalog,
    roadmap: demoRoadmap,
    initialProgress: { ...emptyProgress, practices },
    userName: "bạn",
    mode: "demo" as const,
    entryPracticeId,
  }));
}

describe("bộ 36 thực hành giữ nguyên mã và neo (9.5)", () => {
  it("có đúng 36 mã, không trùng, và demo dùng cùng bộ mã với bản cá nhân", () => {
    const ids = privateRoadmap.stages.flatMap((stage) => stage.practiceIds);

    expect(ids).toHaveLength(36);
    expect(new Set(ids).size).toBe(36);
    expect(new Set(ids)).toEqual(new Set(PRACTICE_IDS));
    expect(privateRoadmap.practices.map((practice) => practice.id)).toEqual(ids);
    // Demo giữ cùng bộ mã; thứ tự chặng của demo khác bản cá nhân nên so theo tập.
    expect(new Set(demoRoadmap.stages.flatMap((stage) => stage.practiceIds))).toEqual(new Set(ids));
    expect(new Set(demoRoadmap.practices.map((practice) => practice.id))).toEqual(new Set(ids));
  });

  privateIt("23 mục có neo nằm ngay sau bài Elite liên quan cuối cùng theo thứ tự nguồn", async () => {
    const catalog = await loadCatalog();
    const elite = catalog.courses.find((course) => course.slug === "elite")!;
    const lessons = elite.chapters.flatMap((chapter) => chapter.lessons);
    const indexById = new Map(lessons.map((lesson, index) => [lesson.id, index]));
    const sequence = trunkNodes(renderTrunk(catalog));
    const onTrunk = sequence.filter((node) => node.kind !== "lesson").map((node) => node.title);

    const anchored = privateRoadmap.practices.filter((practice) => practice.shortcutLessonIds
      .some((link) => link.courseSlug === "elite" && indexById.has(link.id)));
    expect(anchored).toHaveLength(23);

    for (const practice of anchored) {
      const related = practice.shortcutLessonIds
        .filter((link) => link.courseSlug === "elite" && indexById.has(link.id));
      // Neo là bài Elite xa nhất theo thứ tự nguồn, không phải bài đầu tiên được liệt kê.
      const anchor = related
        .map((link) => link.id)
        .sort((left, right) => indexById.get(right)! - indexById.get(left)!)[0];
      const anchorTitle = lessons[indexById.get(anchor)!].title;
      const at = sequence.findIndex((node) => node.kind !== "lesson" && node.title === practice.title);
      const precedingLesson = sequence.slice(0, at).reverse().find((node) => node.kind === "lesson");

      expect(at, `${practice.id} phải có trên trục`).toBeGreaterThanOrEqual(0);
      expect(precedingLesson?.title, `${practice.id} phải nằm sau ${anchor}`).toBe(anchorTitle);
    }

    // Không nhân đôi mốc trên trục: mỗi bài thực hành xuất hiện đúng một lần.
    expect(new Set(onTrunk).size).toBe(onTrunk.length);
    expect(onTrunk).toHaveLength(23);

    // Trường hợp neo vắt qua chương: shortform-cut tham chiếu bài ở chương 5 và 6, neo phải là bài cuối.
    const spanning = privateRoadmap.practices.find((practice) => practice.id === "shortform-cut")!;
    const spanningAnchor = spanning.shortcutLessonIds
      .filter((link) => link.courseSlug === "elite" && indexById.has(link.id))
      .map((link) => link.id)
      .sort((left, right) => indexById.get(right)! - indexById.get(left)!)[0];
    expect(spanningAnchor).toBe("2133");
    const spanningAt = sequence.findIndex((node) => node.kind !== "lesson" && node.title === spanning.title);
    expect(sequence.slice(0, spanningAt).reverse().find((node) => node.kind === "lesson")?.title)
      .toBe(lessons[indexById.get("2133")!].title);
  });

  privateIt("13 mục không có neo không bị gắn vào bài Elite tùy ý", async () => {
    const catalog = await loadCatalog();
    const elite = catalog.courses.find((course) => course.slug === "elite")!;
    const indexById = new Set(elite.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id)));
    const onTrunk = new Set(trunkNodes(renderTrunk(catalog)).filter((node) => node.kind !== "lesson").map((node) => node.title));

    const unanchored = privateRoadmap.practices.filter((practice) => !practice.shortcutLessonIds
      .some((link) => link.courseSlug === "elite" && indexById.has(link.id)));
    expect(unanchored).toHaveLength(13);
    for (const practice of unanchored) {
      expect(onTrunk.has(practice.title), `${practice.id} không được nằm trên trục`).toBe(false);
    }
  });

  it("cả 36 mục giữ đúng mã và trạng thái khi mở từ lối vào thực hành", () => {
    for (const practice of demoRoadmap.practices) {
      const html = renderWorkspace(practice.id, { [practice.id]: "completed" });
      const completed = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
        .map(([button]) => button)
        .find((button) => button.includes("Đã hoàn thành") && button.includes('aria-pressed="true"'));

      expect(html, `${practice.id} phải mở được`).toContain('role="dialog"');
      expect(unescape(html)).toContain(practice.title);
      expect(completed, `${practice.id} phải đọc đúng trạng thái đã lưu`).toBeDefined();
    }
  });

  privateIt("mọi lối vào đều tra cùng một mã thực hành, không tạo bản sao tiến độ", async () => {
    const catalog = await loadCatalog();
    const ids = privateRoadmap.stages.flatMap((stage) => stage.practiceIds);
    const byId = new Map(privateRoadmap.practices.map((practice) => [practice.id, practice]));
    const trunkTitles = new Set(trunkNodes(renderTrunk(catalog)).map((node) => node.title));

    // Cùng một mã: danh sách thực hành, trục, và mã API đều dùng đúng bộ PRACTICE_IDS.
    for (const id of ids) {
      expect(byId.has(id)).toBe(true);
      expect(PRACTICE_IDS).toContain(id);
    }
    // Mốc trên trục mở đúng bài thực hành đó, không sinh mã thứ hai cho cùng tiêu đề.
    for (const practice of privateRoadmap.practices) {
      const onTrunk = trunkTitles.has(practice.title);
      const unanchored = !practice.shortcutLessonIds.some((link) => link.courseSlug === "elite"
        && catalog.courses.find((course) => course.slug === "elite")?.chapters
          .flatMap((chapter) => chapter.lessons).some((lesson) => lesson.id === link.id));
      expect(onTrunk).toBe(!unanchored);
    }
  });
});
