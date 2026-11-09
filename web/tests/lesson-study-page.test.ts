import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LessonStudyView } from "@/app/bai-hoc/[lessonId]/lesson-study-view";
import { courseNeighbours, findLessonStudyContext } from "@/app/bai-hoc/[lessonId]/lesson-study";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { getRelatedLessons } from "@/lib/catalog/lesson-links";

const course = demoCatalog.courses[0];
const chapter = course.chapters[0];
const lesson = chapter.lessons[1];
const neighbours = courseNeighbours(course, lesson.id);
const related = getRelatedLessons(demoCatalog, demoRoadmap.lessonConnections ?? [], course.slug, lesson.id);

function study(overrides: Partial<Parameters<typeof LessonStudyView>[0]> = {}) {
  return renderToStaticMarkup(createElement(LessonStudyView, {
    mode: "demo" as const,
    homeHref: "/demo",
    lesson,
    course,
    chapter,
    position: neighbours.position,
    total: neighbours.total,
    previousLesson: neighbours.previous,
    nextLesson: neighbours.next,
    initialState: "not_updated" as const,
    initialVersion: null,
    media: null,
    relatedLessons: related,
    ...overrides,
  }));
}

describe("trang học bài", () => {
  it("tìm bài kèm khóa và chương, trả null cho mã không có", () => {
    const found = findLessonStudyContext(demoCatalog, lesson.id);
    expect(found?.course.slug).toBe(course.slug);
    expect(found?.chapter.id).toBe(chapter.id);
    expect(found?.lesson.title).toBe(lesson.title);
    expect(findLessonStudyContext(demoCatalog, "999999")).toBeNull();
  });

  it("nối bài trước và bài kế tiếp theo đúng thứ tự, kể cả hai đầu khóa", () => {
    expect(neighbours.position).toBe(2);
    expect(neighbours.total).toBe(course.lessonCount);
    expect(neighbours.previous?.title).toBe(chapter.lessons[0].title);
    expect(neighbours.next?.title).toBe(chapter.lessons[2].title);

    const first = course.chapters[0].lessons[0];
    expect(courseNeighbours(course, first.id).previous).toBeNull();
    const last = course.chapters.at(-1)!.lessons.at(-1)!;
    expect(courseNeighbours(course, last.id).next).toBeNull();
    expect(courseNeighbours(course, "999999").position).toBe(0);
  });

  it("hiển thị tiêu đề, vị trí, bài trước và bài kế tiếp bằng liên kết thật", () => {
    const html = study();
    expect(html).toContain(lesson.title);
    expect(html).toContain(`Bài 2/${course.lessonCount} trong khóa`);
    expect(html).toContain(`href="/bai-hoc/${neighbours.previous!.id}"`);
    expect(html).toContain(`href="/bai-hoc/${neighbours.next!.id}"`);
    expect(html).toContain('href="/demo"');
    expect(html).toContain("Chưa có bài liên kết gợi ý");
  });

  it("nêu rõ bài chưa có mô tả đối chiếu thay vì tự viết nội dung", () => {
    const html = study();
    expect(html).toContain("Mô tả bài");
    expect(html).toContain("Đây là bài mẫu, chưa có mô tả đối chiếu.");
    expect(html).toContain("không phải nội dung video");
  });

  it("hiển thị mô tả đã đối chiếu và nguồn đối chiếu khi danh mục có", () => {
    const withSummary = { ...lesson, summary: "Phần chữ giới thiệu timeline và công cụ cắt.", summaryEvidence: "Đã đối chiếu phần chữ trang." };
    const html = study({ lesson: withSummary });
    expect(html).toContain("Phần chữ giới thiệu timeline và công cụ cắt.");
    expect(html).toContain("Đã đối chiếu phần chữ trang.");
    expect(html).toContain("Đã đối chiếu phần chữ trên trang");
  });

  it("bản thử nghiệm dùng trình phát mẫu và không mở liên kết website gốc", () => {
    const html = study({ mode: "demo", sourceUrl: "https://seankangmvp.com/courses/x/chapters/1/lessons/1" });
    expect(html).toContain("Video mẫu chỉ để thử trình phát");
    expect(html).toContain("Bản thử nghiệm không mở liên kết ra website khóa học.");
    expect(html).not.toContain("seankangmvp.com");
    expect(html).toContain("Bản thử nghiệm");
  });

  it("bản cá nhân chưa có liên kết phát thì chỉ đường tới trang thu thập", () => {
    const html = study({ mode: "private", homeHref: "/" });
    expect(html).toContain("Chưa có liên kết phát cho bài này.");
    expect(html).toContain('href="/thu-thap"');
    expect(html).toContain("Bản cá nhân");
  });

  it("không in mã video hay liên kết nhúng ra nội dung trang", () => {
    const embedUrl = "https://iframe.mediadelivery.net/embed/431650/00000000-0000-4000-8000-000000000001";
    const html = study({
      mode: "private",
      homeHref: "/",
      media: { kind: "bunny" as const, embedUrl },
      sourceUrl: `https://seankangmvp.com/courses/x/chapters/1/lessons/${lesson.id}`,
    });
    expect(html).not.toContain(embedUrl);
    expect(html).not.toContain("00000000-0000-4000-8000-000000000001");
    expect(html).toContain(`href="https://seankangmvp.com/courses/x/chapters/1/lessons/${lesson.id}"`);
  });

  it("bài đọc ở bản cá nhân không hứa có video", () => {
    const html = study({ mode: "private", homeHref: "/", lesson: { ...lesson, kind: "reading" as const, summary: null, summaryEvidence: null } });
    expect(html).toContain("Bài đọc");
    expect(html).toContain("Bài này là bài đọc trên website gốc nên không có video riêng.");
    expect(html).not.toContain("Đang mở video bài học");
  });

  it("nêu rõ khi tiến độ hoặc liên kết phát không đọc được nhưng vẫn mở bài", () => {
    const html = study({ mode: "private", homeHref: "/", loadNotice: "Chưa đọc được tiến độ đã lưu. Bài học vẫn mở." });
    expect(html).toContain("Chưa đọc được tiến độ đã lưu");
    expect(html).toContain(lesson.title);
    expect(html).toContain("Tiến độ của bạn");
  });

  it("không có thông báo tải khi dữ liệu đọc được", () => {
    expect(study()).not.toContain("role=\"status\"");
  });

  it("vị trí trong chương lấy theo mảng nguồn chứ không theo position đã lưu", () => {
    // position lệch sau khi nhập lại không được làm sai vị trí hiển thị.
    const drifted = { ...lesson, position: 9 };
    const html = study({ lesson: drifted });
    expect(html).toContain(`Bài 2/${chapter.lessons.length}`);
  });

  it("bài liên kết dẫn sang trang học của đúng bài", () => {
    const linkedLesson = course.chapters[1].lessons[0];
    const linkedRelated = getRelatedLessons(demoCatalog, demoRoadmap.lessonConnections ?? [], course.slug, linkedLesson.id);
    expect(linkedRelated.length).toBeGreaterThan(0);
    const html = renderToStaticMarkup(createElement(LessonStudyView, {
      mode: "demo" as const,
      homeHref: "/demo",
      lesson: linkedLesson,
      course,
      chapter: course.chapters[1],
      position: 7,
      total: course.lessonCount,
      previousLesson: null,
      nextLesson: null,
      initialState: "not_updated" as const,
      initialVersion: null,
      media: null,
      relatedLessons: linkedRelated,
    }));
    expect(html).toContain("Bài học liên kết");
    expect(html).toContain("Nền tảng");
    expect(html).toContain(`href="/bai-hoc/${linkedRelated[0].lesson.id}"`);
    expect(html).toContain(linkedRelated[0].reason);
  });
});
