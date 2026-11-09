import type { Catalog, Chapter, Course, Lesson } from "@/lib/catalog/normalize";

export type LessonStudyContext = {
  course: Course;
  chapter: Chapter;
  lesson: Lesson;
};

/** Tìm bài và ngữ cảnh khóa/chương của bài trong danh mục đang dùng. */
export function findLessonStudyContext(catalog: Catalog, lessonId: string): LessonStudyContext | null {
  for (const course of catalog.courses) {
    for (const chapter of course.chapters) {
      const lesson = chapter.lessons.find((entry) => entry.id === lessonId);
      if (lesson) return { course, chapter, lesson };
    }
  }
  return null;
}

export type CourseNeighbours = {
  previous: Lesson | null;
  next: Lesson | null;
  /** Vị trí 1-based trong khóa; 0 khi bài không thuộc khóa. */
  position: number;
  total: number;
};

/** Bài trước và bài kế tiếp theo đúng thứ tự chương/bài của khóa. */
export function courseNeighbours(course: Course, lessonId: string): CourseNeighbours {
  const lessons = course.chapters.flatMap((chapter) => chapter.lessons);
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return { previous: null, next: null, position: 0, total: lessons.length };
  return {
    previous: lessons[index - 1] ?? null,
    next: lessons[index + 1] ?? null,
    position: index + 1,
    total: lessons.length,
  };
}
