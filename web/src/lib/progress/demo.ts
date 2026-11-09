import type { Progress, ProgressState } from "./store";

const snapshotKey = "roadmap-demo-progress";
const lessonPrefix = "roadmap-demo-lesson-";
const practicePrefix = "roadmap-demo-practice-";
const openedKey = "roadmap-demo-opened";

export type DemoChange =
  | { kind: "lesson" | "practice"; id: string; state: ProgressState }
  | { kind: "opened"; id: string };

function isState(value: unknown): value is ProgressState {
  return value === "not_updated" || value === "in_progress" || value === "completed";
}

function states(value: unknown): Record<string, ProgressState> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, ProgressState] => isState(entry[1])));
}

/** Đọc ảnh chụp của các bản cũ và các mục lưu riêng của bản mới. */
export function readDemoProgress(storage: Storage, initial: Progress): Progress {
  let snapshot: Partial<Progress> = {};
  const stored = storage.getItem(snapshotKey);
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) snapshot = parsed as Partial<Progress>;
    } catch {
      // Giữ nguyên dữ liệu cũ nếu bị hỏng; các mục riêng vẫn đọc được.
    }
  }

  const lessons = { ...initial.lessons, ...states(snapshot.lessons) };
  const practices = { ...initial.practices, ...states(snapshot.practices) };
  let lastOpenedLessonId = typeof snapshot.lastOpenedLessonId === "string"
    ? snapshot.lastOpenedLessonId : initial.lastOpenedLessonId;

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    const value = storage.getItem(key);
    if (key.startsWith(lessonPrefix) && isState(value)) lessons[key.slice(lessonPrefix.length)] = value;
    if (key.startsWith(practicePrefix) && isState(value)) practices[key.slice(practicePrefix.length)] = value;
    if (key === openedKey && value) lastOpenedLessonId = value;
  }
  practices["clip-first"] ??= practices["bai-tap-1"] ?? practices["practice-1"];
  practices["clip-brief"] ??= practices["bai-tap-2"] ?? practices["practice-2"];
  return { lessons, practices, lastOpenedLessonId };
}

/** Mỗi trạng thái có khóa riêng để hai tab không ghi đè những mục khác. */
export function writeDemoProgress(storage: Storage, change: DemoChange): void {
  const key = change.kind === "lesson" ? `${lessonPrefix}${change.id}`
    : change.kind === "practice" ? `${practicePrefix}${change.id}` : openedKey;
  storage.setItem(key, change.kind === "opened" ? change.id : change.state);
}

export function applyDemoChange(progress: Progress, change: DemoChange): Progress {
  if (change.kind === "lesson") return { ...progress, lessons: { ...progress.lessons, [change.id]: change.state } };
  if (change.kind === "practice") return { ...progress, practices: { ...progress.practices, [change.id]: change.state } };
  return { ...progress, lastOpenedLessonId: change.id };
}
