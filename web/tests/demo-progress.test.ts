import { describe, expect, it } from "vitest";
import { applyDemoChange, readDemoProgress, writeDemoProgress } from "@/lib/progress/demo";
import type { Progress } from "@/lib/progress/store";

function storage(entries: Record<string, string>): Storage {
  const values = new Map(Object.entries(entries));
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
    clear: () => { values.clear(); },
  };
}

const initial = { lessons: {}, practices: {}, lastOpenedLessonId: null };

describe("đọc tiến độ demo đời cũ", () => {
  it("nhận các khóa lẻ cũ và ưu tiên trạng thái mã hiện hành", () => {
    const saved = storage({
      "roadmap-demo-practice-bai-tap-1": "completed",
      "roadmap-demo-practice-practice-2": "in_progress",
    });
    expect(readDemoProgress(saved, initial).practices).toMatchObject({
      "clip-first": "completed", "clip-brief": "in_progress",
    });
    saved.setItem("roadmap-demo-practice-clip-first", "not_updated");
    expect(readDemoProgress(saved, initial).practices["clip-first"]).toBe("not_updated");
  });
});

describe("tiến độ demo tách khỏi dữ liệu cá nhân", () => {
  it("mỗi mục một khóa riêng để hai tab không ghi đè nhau", () => {
    const saved = storage({});
    writeDemoProgress(saved, { kind: "practice", id: "edit-cut", state: "completed" });
    writeDemoProgress(saved, { kind: "lesson", id: "90001", state: "in_progress" });
    writeDemoProgress(saved, { kind: "opened", id: "90001" });
    expect(saved.getItem("roadmap-demo-practice-edit-cut")).toBe("completed");
    expect(saved.getItem("roadmap-demo-lesson-90001")).toBe("in_progress");
    expect(saved.getItem("roadmap-demo-opened")).toBe("90001");
    expect(readDemoProgress(saved, initial)).toMatchObject({
      lessons: { "90001": "in_progress" },
      practices: { "edit-cut": "completed" },
      lastOpenedLessonId: "90001",
    });
  });

  it("chỉ đọc khóa roadmap-demo-*, bỏ qua khóa lạ và giá trị hỏng", () => {
    const saved = storage({
      "roadmap-progress": JSON.stringify({ lessons: { "5860": "completed" } }),
      "roadmap-demo-progress": "{hỏng",
      "roadmap-demo-lesson-90001": "bịa",
      "roadmap-demo-practice-edit-cut": "in_progress",
    });
    const progress = readDemoProgress(saved, initial);
    expect(progress.lessons).toEqual({});
    expect(progress.practices).toEqual({ "edit-cut": "in_progress" });
    expect(JSON.stringify(progress)).not.toContain("5860");
  });

  it("áp thay đổi vào bản sao, không sửa tiến độ gốc", () => {
    const before: Progress = { lessons: { "90000": "completed" }, practices: {}, lastOpenedLessonId: null };
    const next = applyDemoChange(before, { kind: "practice", id: "edit-cut", state: "in_progress" });
    expect(next.practices["edit-cut"]).toBe("in_progress");
    expect(before.practices["edit-cut"]).toBeUndefined();
    expect(before.lessons["90000"]).toBe("completed");
  });
});
