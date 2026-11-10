import type { Catalog, Course, Lesson } from "@/lib/catalog/normalize";
import type { LessonPractice } from "@/lib/catalog/lesson-practices";
import type { PracticeBriefData } from "@/components/roadmap-data";

export function formatLearningContext(course: Course, lesson: Lesson, practices: readonly LessonPractice[], demo: boolean, origin = "http://127.0.0.1:3001"): string {
  const practiceLines = practices.length
    ? practices.map(({ practice, link }) => `- ${practice.title} (${practice.id})${link.purpose ? `: ${link.purpose}` : ""}`)
    : ["- Chưa có bài thực hành liên quan."];
  return [
    `# ${lesson.title}`,
    `- Khóa: ${course.title} (${course.slug})`,
    `- Mã bài: ${lesson.id}`,
    `- Trang học: ${origin}/bai-hoc/${encodeURIComponent(lesson.id)}${demo ? "?demo=1" : ""}`,
    `- Bằng chứng: ${lesson.summary ? "Có phần chữ trang được lưu;" : "Chưa có phần chữ đối chiếu;"} chưa xác minh nội dung video.`,
    "",
    "## Bài thực hành liên quan",
    ...practiceLines,
    "",
    "## Tôi đã làm gì?",
    "",
    "## Vướng mắc và kết quả",
    "",
    "## Một điều rút ra",
  ].join("\n");
}

export function formatPracticeContext(practice: PracticeBriefData, catalog: Catalog, demo: boolean, origin = "http://127.0.0.1:3001"): string {
  const links = practice.shortcutLessonIds.flatMap((link) => {
    const course = catalog.courses.find((item) => item.slug === link.courseSlug);
    const lesson = course?.chapters.flatMap((chapter) => chapter.lessons).find((item) => item.id === link.id);
    if (!course || !lesson) return [];
    return [`- ${course.title} — ${lesson.title} (${lesson.id}): ${origin}/bai-hoc/${encodeURIComponent(lesson.id)}${demo ? "?demo=1" : ""}${link.purpose ? ` — ${link.purpose}` : ""}`];
  });
  return [
    `# ${practice.title}`,
    `- Mã thực hành: ${practice.id}`,
    `- Mục tiêu: ${practice.target || "Chưa có mục tiêu."}`,
    "- Đây là bài tự luyện của lộ trình; chưa xác minh nội dung video.",
    "",
    "## Bài học liên quan",
    ...links,
    ...(links.length < practice.shortcutLessonIds.length ? ["- Bài học liên quan không còn trong danh mục."] : []),
    ...(!practice.shortcutLessonIds.length ? ["- Chưa có bài học liên quan."] : []),
    "",
    "## Tôi đã làm gì?",
    "",
    "## Vướng mắc và kết quả",
    "",
    "## Một điều rút ra",
  ].join("\n");
}
