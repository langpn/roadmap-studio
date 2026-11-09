import type { PracticeBriefData } from "@/components/roadmap-data";

export type LessonPractice = {
  practice: PracticeBriefData;
  /** Liên kết gốc trong `shortcutLessonIds`; giữ `purpose` nguyên văn, không tự suy lý do. */
  link: PracticeBriefData["shortcutLessonIds"][number];
};

/**
 * Tra ngược bài thực hành từ `shortcutLessonIds` theo `(courseSlug, lessonId)`.
 * Trả về chính đối tượng thực hành của lộ trình để mọi lối vào dùng chung một bản tiến độ.
 */
export function getPracticesForLesson(
  practices: readonly PracticeBriefData[],
  courseSlug: string,
  lessonId: string,
): LessonPractice[] {
  const seen = new Set<string>();
  const result: LessonPractice[] = [];
  for (const practice of practices) {
    const link = practice.shortcutLessonIds.find((item) => item.courseSlug === courseSlug && item.id === lessonId);
    if (!link || seen.has(practice.id)) continue;
    seen.add(practice.id);
    result.push({ practice, link });
  }
  return result;
}
