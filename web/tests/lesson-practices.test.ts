import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonDetail } from "@/components/lesson-detail";
import { LessonStudyView } from "@/app/bai-hoc/[lessonId]/lesson-study-view";
import { PracticeBrief } from "@/components/practice-brief";
import { RelatedPractices } from "@/components/related-practices";
import { Workspace } from "@/components/workspace";
import { practiceEntry } from "@/lib/practice-entry";
import { getPracticesForLesson } from "@/lib/catalog/lesson-practices";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { privateRoadmap } from "@/components/roadmap-data";
import type { PracticeBriefData } from "@/components/roadmap-data";
import type { Catalog } from "@/lib/catalog/normalize";

const basics = demoCatalog.courses[0];
const chapter = basics.chapters[1];
const lesson = chapter.lessons[0];

function practice(overrides: Partial<PracticeBriefData> = {}): PracticeBriefData {
  return {
    id: "p1",
    shortTitle: "Thực hành 1",
    title: "Thực hành mẫu 1",
    targetDuration: "Ngắn",
    target: "Có đầu ra.",
    note: "Ghi chú.",
    rawMaterials: ["Tư liệu."],
    steps: ["Bước một."],
    outputs: ["Đầu ra."],
    checklist: ["Tiêu chí."],
    shortcutLessonIds: [{ id: lesson.id, label: "Bài mẫu", courseSlug: basics.slug, role: "main", purpose: "Lý do thật." }],
    ...overrides,
  };
}

function drawer(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(createElement(LessonDetail, {
    lesson, course: basics, chapter,
    currentState: "not_updated" as const,
    mode: "demo" as const,
    onStateChange: () => {},
    onClose: () => {},
    ...overrides,
  }));
}

function study(overrides: Partial<Parameters<typeof LessonStudyView>[0]> = {}) {
  return renderToStaticMarkup(createElement(LessonStudyView, {
    mode: "demo" as const,
    homeHref: "/demo",
    roadmapHref: "/demo",
    lesson, course: basics, chapter,
    position: 1,
    total: basics.lessonCount,
    previousLesson: null,
    nextLesson: null,
    initialState: "not_updated" as const,
    initialVersion: null,
    media: null,
    relatedLessons: [],
    ...overrides,
  }));
}

describe("tra ngược practice theo shortcutLessonIds", () => {
  it("trả nhiều thực hành cùng một bài, giữ đúng thứ tự lộ trình", () => {
    const second = practice({ id: "p2", title: "Thực hành mẫu 2" });
    const found = getPracticesForLesson([practice(), second], basics.slug, lesson.id);

    expect(found.map((item) => item.practice.id)).toEqual(["p1", "p2"]);
    expect(found[0].link.purpose).toBe("Lý do thật.");
  });

  it("không lẫn bài cùng mã ở khóa khác", () => {
    const other = practice({ id: "p3", shortcutLessonIds: [{ id: lesson.id, courseSlug: "demo-story", label: "Khác khóa" }] });

    expect(getPracticesForLesson([other], basics.slug, lesson.id)).toEqual([]);
  });

  it("không nhân đôi tiến độ khi bài được tham chiếu hai lần trong cùng một thực hành", () => {
    const twice = practice({
      shortcutLessonIds: [
        { id: lesson.id, courseSlug: basics.slug, label: "Lần một" },
        { id: lesson.id, courseSlug: basics.slug, label: "Lần hai" },
      ],
    });

    const found = getPracticesForLesson([twice], basics.slug, lesson.id);
    expect(found).toHaveLength(1);
    expect(found[0].practice).toBe(twice);
  });

  it("giữ nguyên đối tượng practice của lộ trình để dùng chung một bản tiến độ", () => {
    const found = getPracticesForLesson(demoRoadmap.practices, basics.slug, lesson.id);

    expect(found.length).toBeGreaterThan(0);
    for (const item of found) {
      expect(demoRoadmap.practices).toContain(item.practice);
    }
  });

  it("tìm được thực hành cho bài ngoài Elite", () => {
    const story = demoCatalog.courses[1];
    const found = getPracticesForLesson(demoRoadmap.practices, story.slug, story.chapters[0].lessons[0].id);

    expect(found.length).toBeGreaterThan(0);
    expect(found[0].link.courseSlug).toBe(story.slug);
  });

  it("demo chỉ trả thực hành của lộ trình mẫu", () => {
    const found = getPracticesForLesson(demoRoadmap.practices, basics.slug, lesson.id);
    const demoIds = new Set(demoRoadmap.practices.map((item) => item.id));

    expect(found.length).toBeGreaterThan(0);
    expect(found.every((item) => demoIds.has(item.practice.id))).toBe(true);
    expect(JSON.stringify(found)).not.toMatch(/Baby Resolve|Elite Pro|seankangmvp\.com/i);
  });

  it("lộ trình cá nhân trả nhiều thực hành cho cùng bài Elite 5860", () => {
    const found = getPracticesForLesson(privateRoadmap.practices, "elite", "5860");
    const ids = found.map((item) => item.practice.id);

    expect(ids).toContain("edit-cut");
    expect(new Set(ids).size).toBe(ids.length);
    expect(found.every((item) => item.link.courseSlug === "elite" && item.link.id === "5860")).toBe(true);
  });

  it("mọi liên kết thực hành của lộ trình cá nhân đều có practice tương ứng", () => {
    const found = getPracticesForLesson(privateRoadmap.practices, "elite", "5862");

    expect(found.length).toBeGreaterThan(1);
    expect(found.every((item) => privateRoadmap.practices.includes(item.practice))).toBe(true);
  });

  it("tìm được thực hành từ bài Baby Resolve ngoài Elite", () => {
    const found = getPracticesForLesson(privateRoadmap.practices, "baby-resolve", "2207");
    const ids = found.map((item) => item.practice.id);

    expect(ids.length).toBeGreaterThan(1);
    expect(ids).toContain("edit-cut");
    expect(found.every((item) => item.link.courseSlug === "baby-resolve")).toBe(true);
  });
});

describe("bảng chi tiết bài", () => {
  it("để thực hành liên quan trên trang học", () => {
    const html = drawer({ relatedPractices: getPracticesForLesson(demoRoadmap.practices, basics.slug, lesson.id), onOpenPractice: () => {} });
    expect(html).not.toContain("Bài thực hành dùng bài này");
    expect(html).toContain(`href="/bai-hoc/${lesson.id}?demo=1"`);
  });
});

describe("trang học hiển thị và mở thực hành", () => {
  it("dẫn về trang chủ kèm mã thực hành và bài đang xem", () => {
    const html = study({ relatedPractices: getPracticesForLesson(demoRoadmap.practices, basics.slug, lesson.id) });

    expect(html).toContain("Bài thực hành dùng bài này");
    expect(html).toContain(`href="/demo?practice=edit-cut&amp;lesson=${lesson.id}"`);
  });

  it("bản cá nhân dùng trang chủ cá nhân và không lộ dữ liệu bài thật khác", () => {
    const catalog: Catalog = demoCatalog;
    const html = study({ mode: "private", homeHref: "/", roadmapHref: "/", relatedPractices: getPracticesForLesson(demoRoadmap.practices, basics.slug, lesson.id) });

    expect(html).toContain(`href="/?practice=edit-cut&amp;lesson=${lesson.id}"`);
    expect(JSON.stringify(catalog)).not.toContain("seankangmvp.com");
  });

  it("vẫn dựng được khi không có thực hành nào", () => {
    const html = study({ relatedPractices: [] });

    expect(html).not.toContain("Bài thực hành dùng bài này");
    expect(html).toContain("Mô tả bài");
  });

  it("thành phần thực hành nói rõ khi danh sách rỗng", () => {
    const html = renderToStaticMarkup(createElement(RelatedPractices, { items: [] }));

    expect(html).toContain("Chưa có bài thực hành nào tham chiếu bài học này.");
  });
});

describe("lối vào thực hành trên trang lộ trình", () => {
  const workspace = (overrides: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(Workspace, {
    catalog: demoCatalog,
    roadmap: demoRoadmap,
    initialProgress: { lessons: {}, practices: {}, lastOpenedLessonId: null },
    userName: "bạn",
    mode: "demo" as const,
    ...overrides,
  }));

  it("đọc cặp mã thực hành và bài, bỏ qua mã sai", () => {
    expect(practiceEntry({ practice: "edit-cut", lesson: "90003" })).toEqual({ entryPracticeId: "edit-cut", entryLessonId: "90003" });
    expect(practiceEntry({ lesson: "90003" })).toEqual({});
    expect(practiceEntry({})).toEqual({});
    expect(practiceEntry({ practice: ["edit-cut", "khác"] })).toEqual({ entryPracticeId: "edit-cut", entryLessonId: undefined });
  });

  it("mở sẵn thực hành khi vào từ trang học, kèm lối quay lại bài", () => {
    const html = workspace({ entryPracticeId: "edit-cut", entryLessonId: "90003" });

    expect(html).toContain("Cắt một đoạn nói rõ ý");
    expect(html).toContain('href="/bai-hoc/90003?demo=1"');
    expect(html).toContain("Quay lại bài học");
  });

  it("bỏ qua mã thực hành không có trong lộ trình", () => {
    const html = workspace({ entryPracticeId: "khong-ton-tai", entryLessonId: "90003" });

    expect(html).not.toContain('role="dialog"');
  });

  it("không gắn lối về khi mã bài không còn trong danh mục", () => {
    const html = workspace({ entryPracticeId: "edit-cut", entryLessonId: "999999" });

    expect(html).toContain("Cắt một đoạn nói rõ ý");
    expect(html).not.toContain("Quay lại bài học");
  });

  it("không mở gì khi trang chủ vào bình thường", () => {
    const html = workspace();

    expect(html).not.toContain("Bài thực hành dùng bài này");
    expect(html).not.toContain("Quay lại bài học");
  });
});

describe("quay lại ngữ cảnh bài sau khi xem thực hành", () => {
  it("thực hành có nút quay lại bài khi mở từ bảng chi tiết", () => {
    const html = renderToStaticMarkup(createElement(PracticeBrief, {
      practice: demoRoadmap.practices.find((item) => item.id === "edit-cut")!,
      catalog: demoCatalog,
      currentState: "not_updated" as const,
      mode: "demo" as const,
      onStateChange: () => {},
      onSelectLesson: () => {},
      onClose: () => {},
      onBack: () => {},
    }));

    expect(html).toContain("Quay lại bài học");
  });

  it("hiển thị đích vắng trong danh sách học liệu mà không lỗi", () => {
    const broken = practice({ shortcutLessonIds: [{ id: "999999", label: "Bài đã mất", courseSlug: basics.slug }] });
    const html = renderToStaticMarkup(createElement(PracticeBrief, {
      practice: broken,
      catalog: demoCatalog,
      currentState: "not_updated" as const,
      mode: "demo" as const,
      onStateChange: () => {},
      onSelectLesson: () => {},
      onClose: () => {},
    }));

    expect(html).toContain("Không khả dụng");
    const buttons = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(([button]) => button);
    expect(buttons.some((button) => button.includes("Bài đã mất"))).toBe(false);
  });
});
