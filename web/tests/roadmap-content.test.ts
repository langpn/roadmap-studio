import { describe, expect, it } from "vitest";
import { privateRoadmap } from "@/components/roadmap-data";
import { loadCatalog } from "@/lib/catalog/source";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { PRACTICE_IDS } from "@/lib/progress/practice-ids";
import { hasPrivateCatalog } from "./private-catalog";

describe("nội dung roadmap theo đầu ra", () => {
  it("đưa các bước dự án lên trước mốc hoàn thiện tương ứng", () => {
    const ids = privateRoadmap.stages.flatMap((stage) => stage.practiceIds);
    for (const project of [
      ["edit-frame", "edit-audio", "edit-frame-audio"],
      ["edit-subtitles-text", "edit-export", "edit-subtitles"],
      ["brief-read", "brief-cut", "brief-broll", "clip-brief"],
      ["shortform-cut", "shortform-opening", "shortform-broll", "shortform-hook", "advanced-level-two"],
      ["longform-cut", "longform-assembly", "advanced-longform"],
      ["motion-plan", "motion-first-scene", "advanced-motion"],
    ]) {
      const positions = project.map((id) => ids.indexOf(id));
      expect(positions.every((position) => position >= 0)).toBe(true);
      for (let index = 1; index < positions.length; index += 1) {
        expect(positions[index - 1]).toBeLessThan(positions[index]);
      }
    }
  });

  it("giữ đủ 19 ID cũ và kết quả chính của những mốc được tách", () => {
    const legacyIds = [
      "prepare-project", "edit-cut", "edit-frame-audio", "edit-subtitles", "clip-first",
      "clip-brief", "portfolio-case", "profile-draft", "find-job", "proposal-draft",
      "shortform-cut", "shortform-hook", "advanced-level-two", "longform-cut", "longform-assembly",
      "advanced-longform", "motion-plan", "motion-first-scene", "advanced-motion",
    ];
    const orderedIds = privateRoadmap.stages.flatMap((stage) => stage.practiceIds);
    expect(new Set(orderedIds.filter((id) => legacyIds.includes(id)))).toEqual(new Set(legacyIds));
    const practice = (id: string) => privateRoadmap.practices.find((item) => item.id === id)!;
    for (const id of ["edit-frame-audio", "edit-subtitles", "clip-first", "clip-brief", "shortform-hook", "advanced-level-two", "advanced-longform", "advanced-motion"]) {
      expect(practice(id).kind).toBe("milestone");
      expect(demoRoadmap.practices.find((item) => item.id === id)?.kind).toBe("milestone");
    }
    expect(practice("edit-frame-audio").outputs.join(" ")).toMatch(/TH_01_KhungTieng.*nháp/);
    expect(practice("edit-subtitles").outputs.join(" ")).toMatch(/TH_01_Final.*project/);
    expect(practice("clip-first").outputs.join(" ")).toMatch(/MP4.*20–45/);
    expect(practice("clip-brief").outputs.join(" ")).toMatch(/MP4.*1080/);
    expect(practice("clip-brief").outputs.join(" ")).toMatch(/minh họa/);
    expect(practice("shortform-hook").outputs.join(" ")).toMatch(/mở đầu.*chữ.*minh họa/);
  });

  it("ưu tiên dự án học và giữ nhánh việc làm là tùy chọn", () => {
    for (const roadmap of [privateRoadmap, demoRoadmap]) {
      expect(roadmap.stages.map((stage) => stage.id)).toEqual(["stage-1", "stage-2", "stage-3", "stage-work"]);
      expect(roadmap.stages.map((stage) => stage.stageNumber)).toEqual([1, 2, 3, 4]);
      expect(roadmap.stages[3].optional).toBe(true);
      expect(roadmap.stages[0].practiceIds.slice(-3)).toEqual(["clip-first", "quality-review", "quality-revise"]);
      expect(roadmap.stages[3].practiceIds).toEqual([
        "portfolio-case", "profile-draft", "find-job", "proposal-draft",
        "job-outreach", "job-replies", "job-agreement", "job-delivery", "job-revisions", "job-income",
      ]);
    }
  });

  it("bước việc làm có điều kiện, đầu ra, tiêu chí và hướng dẫn giả lập trung thực", () => {
    const conditionalIds = ["job-replies", "job-agreement", "job-delivery", "job-revisions", "job-income"];
    for (const roadmap of [privateRoadmap, demoRoadmap]) {
      const practices = new Map(roadmap.practices.map((practice) => [practice.id, practice]));
      expect(practices.get("job-outreach")?.recommendation).toBeUndefined();
      for (const id of ["job-outreach", ...conditionalIds]) {
        const practice = practices.get(id)!;
        expect(practice.note).toMatch(/giả lập/);
        expect(practice.rawMaterials.length).toBeGreaterThan(0);
        expect(practice.steps!.length).toBeGreaterThanOrEqual(3);
        expect(practice.outputs.length).toBeGreaterThan(0);
        expect(practice.checklist.length).toBeGreaterThan(0);
        expect(practice.shortcutLessonIds.length).toBeGreaterThan(0);
      }
      for (const id of conditionalIds) expect(practices.get(id)?.recommendation).toBe("when_started");
      expect(practices.get("job-income")?.steps?.join(" ")).toMatch(/khấu trừ/);
      expect(practices.get("job-income")?.checklist.join(" ")).toMatch(/không (?:bị )?trừ/i);
    }
  });

  it("chia chặng thành nhiều việc có hướng dẫn và giữ hai bài tập cũ", () => {
    const orderedIds = privateRoadmap.stages.flatMap((stage) => stage.practiceIds);
    expect(new Set(orderedIds).size).toBe(orderedIds.length);
    expect(new Set(orderedIds)).toEqual(new Set(PRACTICE_IDS));
    expect(new Set(privateRoadmap.practices.map((practice) => practice.id))).toEqual(new Set(orderedIds));
    expect(orderedIds).toContain("clip-first");
    expect(orderedIds).toContain("clip-brief");
    expect(privateRoadmap.stages.every((stage) => stage.practiceIds.length >= 2)).toBe(true);
    for (const practice of privateRoadmap.practices) {
      expect(practice.steps?.length).toBeGreaterThanOrEqual(3);
      expect(practice.outputs.length).toBeGreaterThan(0);
      expect(practice.checklist.length).toBeGreaterThan(0);
      expect(practice.shortcutLessonIds.length).toBeGreaterThan(0);
    }
  });

  it.skipIf(!hasPrivateCatalog)("mọi học liệu cá nhân trỏ đúng khóa và bao gồm bài thực hành Elite", async () => {
    const catalog = await loadCatalog();
    const references = privateRoadmap.practices.flatMap((practice) => practice.shortcutLessonIds);
    for (const ref of references) {
      const course = catalog.courses.find((item) => item.slug === ref.courseSlug);
      expect(course?.chapters.some((chapter) => chapter.lessons.some((lesson) => lesson.id === ref.id))).toBe(true);
    }
    expect(references.filter((ref) => ref.courseSlug === "elite").map((ref) => ref.id)).toEqual(expect.arrayContaining(["5864", "5865", "1969", "2132"]));
  });

  it("demo có nhiều nhiệm vụ và bài liên quan mẫu, không chứa khóa thật", () => {
    const demoIds = demoRoadmap.stages.flatMap((stage) => stage.practiceIds);
    expect(new Set(demoIds)).toEqual(new Set(PRACTICE_IDS));
    expect(demoIds).toEqual(privateRoadmap.stages.flatMap((stage) => stage.practiceIds));
    expect(new Set(demoRoadmap.practices.map((practice) => practice.id))).toEqual(new Set(demoIds));
    expect(demoRoadmap.practices.every((practice) => practice.steps && practice.steps.length >= 3)).toBe(true);
    for (const practice of demoRoadmap.practices) {
      for (const ref of practice.shortcutLessonIds) {
        const course = demoCatalog.courses.find((item) => item.slug === ref.courseSlug);
        expect(course?.chapters.some((chapter) => chapter.lessons.some((lesson) => lesson.id === ref.id))).toBe(true);
      }
    }
    expect(JSON.stringify(demoRoadmap)).not.toMatch(/Baby Resolve|Elite Pro|seankangmvp\.com/i);
  });
});
