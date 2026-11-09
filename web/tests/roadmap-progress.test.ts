import { describe, expect, it } from "vitest";
import { hasUnfinishedPractices, recommendNextPractice } from "@/lib/progress/roadmap";
import { privateRoadmap } from "@/components/roadmap-data";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { PRACTICE_IDS } from "@/lib/progress/practice-ids";
import { readDemoProgress, writeDemoProgress } from "@/lib/progress/demo";
import type { ProgressState } from "@/lib/progress/store";

const stages = [
  { practiceIds: ["cut", "clip-first"] },
  { practiceIds: ["clip-brief", "portfolio"] },
];
const practices = ["cut", "clip-first", "clip-brief", "portfolio"].map((id) => ({ id }));

describe("gợi ý theo tiến độ roadmap", () => {
  it("sau clip đầu gợi ý đánh giá rồi sửa, dù trước đó đã làm proposal", () => {
    for (const roadmap of [privateRoadmap, demoRoadmap]) {
      const firstClip = Object.fromEntries([
        "prepare-project", "edit-cut", "edit-frame", "edit-audio", "edit-frame-audio",
        "edit-subtitles-text", "edit-export", "edit-subtitles", "clip-first",
        "portfolio-case", "profile-draft", "find-job", "proposal-draft",
      ].map((id) => [id, "completed" as ProgressState]));
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, firstClip)).toBe("quality-review");
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, { ...firstClip, "quality-review": "completed" })).toBe("quality-revise");
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, { ...firstClip, "quality-review": "completed", "quality-revise": "completed" })).toBe("brief-read");
    }
  });

  it("ưu tiên dự án học tiếp theo thay vì nhánh việc làm khi có proposal hoặc việc làm đang dở", () => {
    for (const roadmap of [privateRoadmap, demoRoadmap]) {
      const learningBeforeAdvanced = Object.fromEntries([
        "prepare-project", "edit-cut", "edit-frame", "edit-audio", "edit-frame-audio",
        "edit-subtitles-text", "edit-export", "edit-subtitles", "clip-first", "quality-review", "quality-revise",
        "brief-read", "brief-cut", "brief-broll", "clip-brief", "proposal-draft",
      ].map((id) => [id, "completed" as ProgressState]));
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, learningBeforeAdvanced)).toBe("shortform-cut");
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, { ...learningBeforeAdvanced, "job-replies": "in_progress" })).toBe("shortform-cut");
    }
  });

  it("chỉ gợi ý bước việc làm đã chủ động bắt đầu khi không còn bước học tự động", () => {
    for (const roadmap of [privateRoadmap, demoRoadmap]) {
      const learningDone = Object.fromEntries(roadmap.stages
        .filter((stage) => stage.id !== "stage-work")
        .flatMap((stage) => stage.practiceIds)
        .map((id) => [id, "completed" as ProgressState]));
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, learningDone)).toBeNull();
      expect(hasUnfinishedPractices(roadmap.stages, roadmap.practices, learningDone)).toBe(true);
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, { ...learningDone, "job-replies": "in_progress" })).toBe("job-replies");
    }
  });
  it("chọn việc đầu tiên chưa xong, kể cả khi đã hoàn thành mục ở sau", () => {
    expect(recommendNextPractice(stages, practices, {})).toBe("cut");
    expect(recommendNextPractice(stages, practices, { cut: "completed", "clip-brief": "completed" })).toBe("clip-first");
  });

  it("tiếp tục mục đang thực hiện thay vì coi đã hoàn thành", () => {
    expect(recommendNextPractice(stages, practices, { cut: "in_progress" })).toBe("cut");
    expect(recommendNextPractice(stages, practices, { cut: "completed", "clip-first": "in_progress" })).toBe("clip-first");
  });

  it("giữ tiến độ của hai bài tập trước và không đề xuất mục đã xong", () => {
    expect(recommendNextPractice(stages, practices, {
      cut: "completed", "clip-first": "completed", "clip-brief": "completed",
    })).toBe("portfolio");
  });

  it("bỏ qua ID không còn trong dữ liệu và trả null khi xong hết", () => {
    expect(recommendNextPractice([{ practiceIds: ["missing", "cut"] }], practices, {})).toBe("cut");
    expect(recommendNextPractice(stages, practices, {
      cut: "completed", "clip-first": "completed", "clip-brief": "completed", portfolio: "completed",
    })).toBeNull();
    expect(recommendNextPractice([], practices, {})).toBeNull();
  });

  it("không gợi ý bước mới chưa làm của dự án đã hoàn thành, nhưng vẫn tiếp tục bước đang làm", () => {
    const completed = Object.fromEntries(
      privateRoadmap.stages.slice(0, 2).flatMap((stage) => stage.practiceIds).map((id) => [id, "completed" as const]),
    );
    const previousProgress = { ...completed, "job-outreach": "completed" as const, "advanced-level-two": "completed" as const };
    expect(recommendNextPractice(privateRoadmap.stages, privateRoadmap.practices, previousProgress)).toBe("longform-cut");
    expect(recommendNextPractice(privateRoadmap.stages, privateRoadmap.practices, {
      ...previousProgress, "shortform-hook": "in_progress",
    })).toBe("shortform-hook");
  });

  it("giữ khả năng đọc 19 ID cũ và chỉ gợi ý nhánh việc làm khi chủ động bắt đầu", () => {
    const legacyIds = [
      "prepare-project", "edit-cut", "edit-frame-audio", "edit-subtitles", "clip-first",
      "clip-brief", "portfolio-case", "profile-draft", "find-job", "proposal-draft",
      "shortform-cut", "shortform-hook", "advanced-level-two", "longform-cut", "longform-assembly",
      "advanced-longform", "motion-plan", "motion-first-scene", "advanced-motion",
    ];
    const legacySkip: Record<string, string> = {
      "shortform-cut": "advanced-level-two", "shortform-hook": "advanced-level-two",
      "longform-cut": "advanced-longform", "longform-assembly": "advanced-longform",
      "motion-plan": "advanced-motion", "motion-first-scene": "advanced-motion",
    };
    const previousProgress = Object.fromEntries(legacyIds.map((id) => [id, "completed" as ProgressState]));
    const legacyPractices = privateRoadmap.practices.filter((practice) => legacyIds.includes(practice.id));
    for (const id of legacyIds) {
      for (const state of ["not_updated", "in_progress"] as const) {
        const progress = { ...previousProgress, "job-outreach": "completed" as const, [id]: state };
        const expected = legacyIds.find((candidate) => progress[candidate] !== "completed" && (
          progress[candidate] === "in_progress" || !legacySkip[candidate] || progress[legacySkip[candidate]] !== "completed"
        )) ?? null;
        const optional = ["portfolio-case", "profile-draft", "find-job", "proposal-draft"].includes(id);
        expect(recommendNextPractice(privateRoadmap.stages, legacyPractices, progress), `${id}: ${state}`)
          .toBe(optional && state === "not_updated" ? null : expected);
      }
    }
    const progress: Record<string, ProgressState> = { "prepare-project": "completed", "edit-cut": "completed", "clip-first": "completed" };
    expect(recommendNextPractice(privateRoadmap.stages, privateRoadmap.practices, progress)).toBe("edit-frame-audio");
  });

  it("đưa các bước brief mới lên trước clip-brief chưa bắt đầu, nhưng không chặn clip-brief đang làm", () => {
    const progress = Object.fromEntries(
      privateRoadmap.stages[0].practiceIds.map((id) => [id, "completed" as ProgressState]),
    );
    expect(recommendNextPractice(privateRoadmap.stages, privateRoadmap.practices, progress)).toBe("brief-read");
    expect(recommendNextPractice(privateRoadmap.stages, privateRoadmap.practices, {
      ...progress, "clip-brief": "in_progress",
    })).toBe("clip-brief");
  });

  it("bỏ qua bước mới chưa bắt đầu trước mốc cũ đã bắt đầu hoặc đã xong, nhưng tiếp tục bước mới đang làm", () => {
    const allComplete = Object.fromEntries(PRACTICE_IDS.map((id) => [id, "completed" as ProgressState]));
    for (const [milestone, firstNew] of [
      ["edit-frame-audio", "edit-frame"], ["edit-subtitles", "edit-subtitles-text"],
      ["clip-brief", "brief-read"], ["shortform-hook", "shortform-opening"],
    ]) {
      for (const milestoneState of ["in_progress", "completed"] as const) {
        const progress = { ...allComplete, [firstNew]: "not_updated" as const, [milestone]: milestoneState };
        expect(recommendNextPractice(privateRoadmap.stages, privateRoadmap.practices, progress)).toBe(
          milestoneState === "in_progress" ? milestone : null,
        );
        expect(hasUnfinishedPractices(privateRoadmap.stages, privateRoadmap.practices, progress)).toBe(true);
        expect(recommendNextPractice(privateRoadmap.stages, privateRoadmap.practices, {
          ...progress, [firstNew]: "in_progress",
        })).toBe(firstNew);
      }
    }
  });

  it("không gợi ý bước chờ chưa bắt đầu; null không có nghĩa mọi bước đã hoàn thành", () => {
    const conditionalIds = ["job-replies", "job-agreement", "job-delivery", "job-revisions", "job-income"];
    const allComplete = Object.fromEntries(PRACTICE_IDS.map((id) => [id, "completed" as ProgressState]));
    const waiting = Object.freeze({ ...allComplete, ...Object.fromEntries(conditionalIds.map((id) => [id, "not_updated" as const])) });
    for (const roadmap of [privateRoadmap, demoRoadmap]) {
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, waiting)).toBeNull();
      expect(hasUnfinishedPractices(roadmap.stages, roadmap.practices, waiting)).toBe(true);
      expect(hasUnfinishedPractices(roadmap.stages, roadmap.practices, allComplete)).toBe(false);
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, { ...waiting, "job-outreach": "not_updated" })).toBeNull();
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, { ...waiting, "job-outreach": "in_progress" })).toBe("job-outreach");
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, { ...waiting, "job-income": "in_progress", "job-replies": "in_progress" })).toBe("job-replies");
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, { ...waiting, "job-income": "in_progress", "job-replies": "completed" })).toBe("job-income");
    }
    expect(waiting["job-replies"]).toBe("not_updated");
  });

  it("gợi ý dự án tiếp theo sau hai clip mà không cần bước tiếp cận", () => {
    for (const roadmap of [privateRoadmap, demoRoadmap]) {
      const firstTwoStagesDone = Object.fromEntries(
        roadmap.stages.slice(0, 2).flatMap((stage) => stage.practiceIds).map((id) => [id, "completed" as ProgressState]),
      );
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, firstTwoStagesDone)).toBe("shortform-cut");
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, { ...firstTwoStagesDone, "job-replies": "in_progress" })).toBe("shortform-cut");
    }
  });

  it("không tự chuyển sang tiếp cận khi đã hoàn thành proposal nhưng clip thứ hai còn dở", () => {
    for (const roadmap of [privateRoadmap, demoRoadmap]) {
      const firstStageDone = Object.fromEntries(
        roadmap.stages[0].practiceIds.map((id) => [id, "completed" as ProgressState]),
      );
      const readyToContact = {
        ...firstStageDone,
        "portfolio-case": "completed" as const,
        "profile-draft": "completed" as const,
        "find-job": "completed" as const,
        "proposal-draft": "completed" as const,
      };
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, readyToContact)).toBe("brief-read");
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, {
        ...readyToContact, "job-outreach": "completed",
      })).toBe("brief-read");
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, {
        ...readyToContact, "job-replies": "in_progress",
      })).toBe("brief-read");
      expect(recommendNextPractice(roadmap.stages, roadmap.practices, {
        ...firstStageDone, "job-outreach": "in_progress",
      })).toBe("brief-read");
    }
  });

  it("demo và private áp dụng cùng chính sách gợi ý cho mọi ID", () => {
    const recommendationPolicy = (roadmap: typeof privateRoadmap) => Object.fromEntries(
      roadmap.practices.map((practice) => [practice.id, practice.recommendation ?? "default"]),
    );
    expect(recommendationPolicy(demoRoadmap)).toEqual(recommendationPolicy(privateRoadmap));
    const examples: Record<string, ProgressState>[] = [
      {},
      { "prepare-project": "completed", "edit-cut": "completed", "edit-frame-audio": "in_progress" },
      { "prepare-project": "completed", "edit-cut": "completed", "clip-first": "completed", "edit-audio": "in_progress" },
      Object.fromEntries(PRACTICE_IDS.map((id) => [id, "completed" as const])),
    ];
    for (const progress of examples) {
      expect(recommendNextPractice(demoRoadmap.stages, demoRoadmap.practices, progress))
        .toBe(recommendNextPractice(privateRoadmap.stages, privateRoadmap.practices, progress));
    }
  });

  it("đọc tiến độ demo cũ và lưu ID mới mà không tự đánh dấu các bước được thêm", () => {
    const entries = new Map<string, string>();
    const storage: Storage = {
      get length() { return entries.size; },
      clear: () => entries.clear(),
      getItem: (key) => entries.get(key) ?? null,
      key: (index) => Array.from(entries.keys())[index] ?? null,
      removeItem: (key) => { entries.delete(key); },
      setItem: (key, value) => { entries.set(key, value); },
    };
    storage.setItem("roadmap-demo-progress", JSON.stringify({ practices: {
      "bai-tap-1": "completed", "practice-2": "in_progress", "edit-frame-audio": "completed",
    } }));
    const initial = { lessons: {}, practices: {}, lastOpenedLessonId: null };
    const restored = readDemoProgress(storage, initial);
    expect(restored.practices["clip-first"]).toBe("completed");
    expect(restored.practices["clip-brief"]).toBe("in_progress");
    expect(restored.practices["edit-frame-audio"]).toBe("completed");
    expect(restored.practices["edit-frame"]).toBeUndefined();
    expect(restored.practices["brief-read"]).toBeUndefined();
    expect(storage.length).toBe(1);
    writeDemoProgress(storage, { kind: "practice", id: "job-income", state: "in_progress" });
    expect(readDemoProgress(storage, initial).practices["job-income"]).toBe("in_progress");
    expect(PRACTICE_IDS).toContain("job-income");
  });
});
