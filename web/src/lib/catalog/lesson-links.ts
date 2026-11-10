import type { Catalog, Lesson } from "./normalize";

/**
 * Mức bằng chứng của một gợi ý, độc lập với nhóm quan hệ.
 * `title`: chỉ ghép theo tiêu đề/chủ đề danh mục — mức mặc định của dữ liệu cũ.
 * `page_text`: đã đối chiếu phần chữ của cả hai trang bài, chưa xem video.
 * `learner_observation`: người học đã trực tiếp xem nội dung, ghi kèm nguồn quan sát.
 */
export type LessonBasis = "title" | "page_text" | "learner_observation";

export type LessonConnection = {
  from: { courseSlug: string; lessonId: string };
  to: { courseSlug: string; lessonId: string };
  kind: "foundation" | "support" | "advanced";
  reason: string;
  basis: LessonBasis;
  /** Nguồn của mức bằng chứng; bắt buộc khi `basis` cao hơn `title`. */
  evidence?: string;
};

export type RelatedLesson = {
  lesson: Lesson;
  courseTitle: string;
  kind: LessonConnection["kind"];
  reason: string;
  basis: LessonBasis;
  evidence?: string;
  /** Nhãn sẵn để giao diện không tự diễn giải mức bằng chứng. */
  basisLabel: string;
  direction: "outgoing" | "incoming";
};

/** Nhãn hiển thị cho từng mức bằng chứng; không suy rộng lên mức video. */
export const LESSON_BASIS_LABEL: Record<LessonBasis, string> = {
  title: "Gợi ý theo tiêu đề; chưa xác minh nội dung video",
  page_text: "Đối chiếu phần chữ hai trang; chưa xem nội dung video",
  learner_observation: "Theo nội dung người học đã xem; không suy ra toàn bộ video",
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
      ...(connection.evidence ? { evidence: connection.evidence } : {}),
      basisLabel: LESSON_BASIS_LABEL[connection.basis],
      direction: from === current ? "outgoing" : "incoming",
    });
  }
  return result;
}

/**
 * Chặn dữ liệu quan hệ hỏng trước khi nó tới giao diện: tự nối, trùng chiều, đích không
 * tồn tại và mức bằng chứng cao hơn phần đối chiếu thực có. Chạy trong test, không chạy
 * trong request path.
 */
export function findConnectionProblems(catalog: Catalog, connections: readonly LessonConnection[]): string[] {
  const key = (slug: string, id: string) => `${slug}\u0000${id}`;
  const known = new Set(catalog.courses.flatMap((course) => course.chapters.flatMap((chapter) =>
    chapter.lessons.map((lesson) => key(course.slug, lesson.id)))));
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const connection of connections) {
    const from = key(connection.from.courseSlug, connection.from.lessonId);
    const to = key(connection.to.courseSlug, connection.to.lessonId);
    const label = `${connection.from.courseSlug}:${connection.from.lessonId}>${connection.to.courseSlug}:${connection.to.lessonId}`;
    if (from === to) problems.push(`${label}: tự nối`);
    if (!known.has(from)) problems.push(`${label}: thiếu bài nguồn`);
    if (!known.has(to)) problems.push(`${label}: thiếu bài đích`);
    if (seen.has(`${from}>${to}`) || seen.has(`${to}>${from}`)) problems.push(`${label}: trùng hoặc ngược chiều`);
    if (!connection.reason.trim()) problems.push(`${label}: thiếu lý do`);
    if (connection.basis !== "title" && !connection.evidence?.trim()) {
      problems.push(`${label}: mức ${connection.basis} phải kèm nguồn`);
    }
    seen.add(`${from}>${to}`);
  }
  return problems;
}
