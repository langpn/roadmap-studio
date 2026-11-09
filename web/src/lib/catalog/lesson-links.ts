import type { Catalog, Lesson } from "./normalize";

export type LessonConnection = {
  from: { courseSlug: string; lessonId: string };
  to: { courseSlug: string; lessonId: string };
  kind: "foundation" | "support" | "advanced";
  reason: string;
  basis: "title";
};

export type RelatedLesson = {
  lesson: Lesson;
  courseTitle: string;
  kind: LessonConnection["kind"];
  reason: string;
  basis: LessonConnection["basis"];
  direction: "outgoing" | "incoming";
};

export function getRelatedLessons(
  catalog: Catalog,
  connections: readonly LessonConnection[],
  courseSlug: string,
  lessonId: string,
): RelatedLesson[] {
  const key = (slug: string, id: string) => `${slug}\u0000${id}`;
  const lessons = new Map<string, { lesson: Lesson; courseTitle: string }>();
  for (const course of catalog.courses) {
    for (const chapter of course.chapters) {
      for (const lesson of chapter.lessons) {
        lessons.set(key(course.slug, lesson.id), { lesson, courseTitle: course.title });
      }
    }
  }

  const current = key(courseSlug, lessonId);
  if (!lessons.has(current)) return [];

  const result: RelatedLesson[] = [];
  const seen = new Set<string>();
  for (const connection of connections) {
    const from = key(connection.from.courseSlug, connection.from.lessonId);
    const to = key(connection.to.courseSlug, connection.to.lessonId);
    if (from === to || (from !== current && to !== current)) continue;

    const other = from === current ? to : from;
    const item = lessons.get(other);
    if (!item || seen.has(other)) continue;
    seen.add(other);
    result.push({
      ...item,
      kind: connection.kind,
      reason: connection.reason,
      basis: connection.basis,
      direction: from === current ? "outgoing" : "incoming",
    });
  }
  return result;
}
