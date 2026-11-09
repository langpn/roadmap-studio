import type { ProgressState } from "@/lib/progress/store";
import { searchable, type Catalog, type Chapter, type Course, type Lesson } from "./normalize";

export type LessonMatch = { lesson: Lesson; course: Course; chapter: Chapter };

/**
 * Tìm theo tên và trạng thái, giữ thứ tự nguồn. `total` đếm cả phần vượt
 * giới hạn hiển thị để giao diện báo không che kết quả.
 */
export function searchLessonMatches(
  catalog: Catalog,
  query: string,
  status: "all" | ProgressState = "all",
  progress: Readonly<Record<string, ProgressState>> = {},
  limit = 60,
): { matches: LessonMatch[]; total: number } {
  const needle = searchable(query.trim());
  const byId = /^\d+$/.test(needle);
  const matches: LessonMatch[] = [];
  let total = 0;
  for (const course of catalog.courses) {
    for (const chapter of course.chapters) {
      for (const lesson of chapter.lessons) {
        if (needle && !searchable(lesson.title).includes(needle) && !(byId && lesson.id === needle)) continue;
        if (status !== "all" && (progress[lesson.id] ?? "not_updated") !== status) continue;
        total += 1;
        if (matches.length < limit) matches.push({ lesson, course, chapter });
      }
    }
  }
  return { matches, total };
}
