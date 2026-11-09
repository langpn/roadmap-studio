import type { Catalog, Course } from "./normalize";

const examples = [
  { title: "Làm quen dựng phim", slug: "demo-basics", chapters: [
    { title: "Bắt đầu với project", lessons: ["Sắp xếp tư liệu", "Tạo project", "Đưa clip vào timeline"] },
    { title: "Hoàn thiện clip", lessons: ["Cắt và sắp xếp", "Thêm chữ", "Xuất bản thử"] },
  ] },
  { title: "Kể chuyện bằng hình ảnh", slug: "demo-story", chapters: [
    { title: "Làm việc với nhịp dựng", lessons: ["Chọn cảnh", "Cân bằng hình và tiếng", "Kiểm tra bản xuất"] },
  ] },
  { title: "Chuẩn bị nhận dự án", slug: "demo-work", chapters: [
    { title: "Làm việc theo brief", lessons: ["Đọc yêu cầu", "Ước lượng thời gian", "Chuẩn bị mẫu giới thiệu"] },
  ] },
];

let nextLessonId = 90000;
let nextChapterId = 900;
const courses: Course[] = examples.map((course, courseIndex) => {
  const chapters = course.chapters.map((chapter, chapterIndex) => {
    const id = String(nextChapterId++);
    return {
      id, title: chapter.title, url: "https://example.invalid/", position: chapterIndex,
      lessons: chapter.lessons.map((title, position) => ({
        id: String(nextLessonId++), chapterId: id, courseSlug: course.slug, title,
        url: "https://example.invalid/", position, kind: "unknown" as const,
        duration: null, titleWithheld: false,
      })),
    };
  });
  return { slug: course.slug, title: course.title, url: "https://example.invalid/", position: courseIndex, chapters, lessonCount: chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0) };
});

export const demoCatalog: Catalog = {
  courses,
  chapterCount: courses.reduce((sum, course) => sum + course.chapters.length, 0),
  lessonCount: courses.reduce((sum, course) => sum + course.lessonCount, 0),
};
