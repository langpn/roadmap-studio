import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoadmapDiagram, type RoadmapDiagramProps } from "@/components/roadmap-diagram";
import type { PracticeBriefData, RoadmapConfig, RoadmapStageData } from "@/components/roadmap-data";

type Practice = PracticeBriefData & { kind?: "practice" | "milestone" };
type Stage = RoadmapStageData & { practiceIds: string[] };

const practices: Practice[] = [
  {
    id: "cut",
    shortTitle: "Cắt đoạn đầu",
    title: "Cắt đoạn video đầu tiên",
    targetDuration: "10 giây",
    target: "Cắt bỏ khoảng dừng trong một đoạn video.",
    note: "Bài tự luyện.",
    rawMaterials: ["Một đoạn video tự quay."],
    outputs: ["Một đoạn đã cắt."],
    checklist: ["Xem lại điểm cắt."],
    shortcutLessonIds: [],
    kind: "practice",
  },
  {
    id: "clip",
    shortTitle: "Clip đầu tiên",
    title: "Xuất clip đầu tiên",
    targetDuration: "30 giây",
    target: "Xuất một clip ngắn có tiếng rõ.",
    note: "Bài tự luyện.",
    rawMaterials: ["Một đoạn video tự quay."],
    outputs: ["Một file video."],
    checklist: ["Mở lại file xuất."],
    shortcutLessonIds: [],
  },
  {
    id: "portfolio",
    shortTitle: "Portfolio",
    title: "Tạo portfolio mẫu",
    targetDuration: "Một bản",
    target: "",
    note: "Bài tự luyện.",
    rawMaterials: ["Clip đã thực hiện."],
    outputs: ["Một trang giới thiệu các clip mẫu."],
    checklist: ["Kiểm tra liên kết."],
    shortcutLessonIds: [],
    kind: "milestone",
  },
  {
    id: "proposal",
    shortTitle: "Đề xuất",
    title: "Viết đề xuất mẫu",
    targetDuration: "Một bản",
    target: "Viết đề xuất cho một brief giả lập.",
    note: "Bài tự luyện.",
    rawMaterials: ["Một brief giả lập."],
    outputs: ["Một đề xuất mẫu."],
    checklist: ["Đọc lại đề xuất."],
    shortcutLessonIds: [],
  },
  {
    id: "unused",
    shortTitle: "Chưa xếp",
    title: "Bài chưa được xếp vào lộ trình",
    targetDuration: "Một bản",
    target: "Nội dung chưa được xếp.",
    note: "Bài tự luyện.",
    rawMaterials: [],
    outputs: [],
    checklist: [],
    shortcutLessonIds: [],
  },
];

const stages: Stage[] = [
  {
    id: "start",
    stageNumber: 1,
    title: "Chặng 1: Làm quen với dựng video",
    timeframe: "Ngày 1–7",
    description: "Thực hành những thao tác đầu tiên.",
    primaryCourseSlugs: ["fake-course"],
    milestonePracticeId: "clip",
    keyAction: "Xuất clip đầu tiên.",
    practiceIds: ["cut", "missing-step", "clip"],
  },
  {
    id: "work",
    stageNumber: 2,
    title: "Chuẩn bị nhận việc",
    timeframe: "Tuần 2",
    description: "Chuẩn bị mẫu và luyện đề xuất.",
    primaryCourseSlugs: [],
    milestonePracticeId: null,
    keyAction: "Chuẩn bị tài liệu mẫu.",
    practiceIds: ["portfolio", "proposal"],
  },
];

const roadmap: RoadmapConfig & { practices: Practice[]; stages: Stage[] } = {
  courseOrder: ["fake-course"],
  courseRoles: {},
  practices,
  stages,
};

const props: RoadmapDiagramProps = {
  catalog: {
    courses: [{ slug: "fake-course", title: "Khóa học giả để thử", url: "", position: 0, chapters: [], lessonCount: 0 }],
    chapterCount: 0,
    lessonCount: 0,
  },
  roadmap,
  progress: { lessons: {}, practices: { cut: "completed", clip: "in_progress" }, lastOpenedLessonId: null },
  onSelectCourse: () => {},
  onOpenPractice: () => {},
  onSelectLessonById: () => {},
  mode: "demo",
  recommendedPracticeId: "clip",
};

describe("sơ đồ lộ trình thực hành", () => {
  it("dùng từng bài Elite theo thứ tự thật và đặt mốc sau bài liên quan cuối cùng", () => {
    const lesson = (id: string, chapterId: string, title: string, position: number) => ({
      id, chapterId, courseSlug: "elite", title, position, url: "https://example.invalid/", kind: "unknown" as const,
      duration: null, titleWithheld: false,
    });
    const eliteCatalog: RoadmapDiagramProps["catalog"] = {
      courses: [{ slug: "elite", title: "Elite thật", url: "https://example.invalid/", position: 0, lessonCount: 3, chapters: [
        { id: "1", title: "Khởi đầu", url: "https://example.invalid/", position: 0, lessons: [lesson("101", "1", "Bài Elite một", 0), lesson("102", "1", "Bài Elite hai", 1)] },
        { id: "2", title: "Thực hành", url: "https://example.invalid/", position: 1, lessons: [lesson("103", "2", "Bài Elite ba", 0)] },
      ] }], chapterCount: 2, lessonCount: 3,
    };
    const checkpoint = { ...practices[1], kind: "milestone" as const, shortcutLessonIds: [
      { id: "101", label: "Bài một", courseSlug: "elite" },
      { id: "102", label: "Bài hai", courseSlug: "elite" },
    ] };
    const exercise = { ...practices[0], shortcutLessonIds: [{ id: "101", label: "Bài một", courseSlug: "elite" }] };
    const html = renderToStaticMarkup(createElement(RoadmapDiagram, {
      ...props, mode: "private", catalog: eliteCatalog,
      roadmap: { ...roadmap, practices: [checkpoint, exercise, practices[2]] },
      progress: { ...props.progress, lessons: { "101": "completed", "102": "in_progress" } },
    }));
    expect(html).toContain("Elite thật");
    expect(html).toContain("Bài Elite một");
    expect(html).toContain("Bài Elite hai");
    expect(html).toContain("Bài Elite ba");
    expect(html.indexOf("Bài Elite một")).toBeLessThan(html.indexOf("Cắt đoạn video đầu tiên"));
    expect(html.indexOf("Cắt đoạn video đầu tiên")).toBeLessThan(html.indexOf("Bài Elite hai"));
    expect(html.indexOf("Bài Elite hai")).toBeLessThan(html.indexOf("Xuất clip đầu tiên"));
    expect(html.indexOf("Xuất clip đầu tiên")).toBeLessThan(html.indexOf("Bài Elite ba"));
    expect(html).toContain("Đã hoàn thành");
    expect(html).toContain("Đang học");
    expect(html).toContain("Bài tự luyện");
    expect(html).not.toContain("Tạo portfolio mẫu");
  });

  it("hiển thị liên tục các chương của lộ trình mẫu", () => {
    const html = renderToStaticMarkup(createElement(RoadmapDiagram, { ...props, catalog: demoCatalog, roadmap: demoRoadmap }));
    expect(html).toContain("Lộ trình mẫu");
    expect(html).toContain("Sắp xếp tư liệu");
    expect(html).toContain("Xuất bản thử");
    expect(html.indexOf("Sắp xếp tư liệu")).toBeLessThan(html.indexOf("Xuất bản thử"));
    expect(html).not.toContain("aria-expanded");
  });

  it("hiển thị trạng thái rỗng khi chưa có giáo trình", () => {
    const html = renderToStaticMarkup(createElement(RoadmapDiagram, props));
    expect(html).toContain("Chưa có giáo trình Elite");
  });
});
