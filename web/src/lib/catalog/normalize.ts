import { verifiedSummaries } from "./curated";

type RawObservationReference = {
  from_reference?: { file?: string | null } | null;
} | string | null;

type RawObservation = {
  observed_at?: string | null;
  observed_between?: { from?: string | null; to?: string | null } | null;
  source_reference?: RawObservationReference;
  /** Baby mang giới hạn quan sát ngay trong observation. */
  source_limit?: string | null;
  sourceLimit?: string | null;
} | null;

type RawLesson = {
  lesson_id?: string;
  name: string;
  url: string;
  type?: string;
  duration_display?: string | null;
  description_status?: string;
  observation?: RawObservation;
  /** Chỉ có ở một số nguồn; dùng để biết loại bài đã được mở trang hay chỉ đọc danh sách. */
  evidence?: string[];
};

export type { RawLesson };

export type RawCourse = {
  slug: string;
  supplemental?: boolean;
  course: { name: string; url: string };
  chapters: {
    chapter_id?: string;
    title?: string;
    name?: string;
    url: string;
    lessons: RawLesson[];
  }[];
};

export type DescriptionStatus = "text" | "link_only" | "placeholder" | "not_present" | "unread" | "unknown";

/** Loại bài theo nguồn gốc, tách khỏi mức xác minh. */
export type LessonType = "video" | "reading" | "unknown";

/** Mức bằng chứng cho loại bài: trang bài đã mở, chỉ đọc danh sách, hay nguồn không ghi. */
export type LessonTypeEvidence = "lesson_page" | "catalog_list" | "unknown";

/** Nguồn và khoảng thời gian đã quan sát bài, tách khỏi nội dung mô tả. */
export type LessonObservation = {
  observedAt: string | null;
  from: string | null;
  to: string | null;
  sourceReference: string | null;
  /** Giới hạn của nguồn quan sát, giữ nguyên văn để không suy rộng mức bằng chứng. */
  sourceLimit?: string;
};

export type Lesson = {
  id: string;
  chapterId: string;
  courseSlug: string;
  title: string;
  url: string;
  position: number;
  /** Loại an toàn để hiển thị: chỉ nhận `video`/`reading` khi bằng chứng đủ mạnh. */
  kind: LessonType;
  /** Loại thô theo nguồn, giữ riêng để không đánh đồng với mức xác minh. */
  type?: LessonType;
  /** Mức bằng chứng cho `type`: trang bài đã mở, chỉ đọc danh mục, hay không rõ. */
  typeEvidence?: LessonTypeEvidence;
  duration: string | null;
  titleWithheld: boolean;
  /** Thiếu ở ảnh chụp cũ (trước khi lưu trạng thái) nghĩa là chưa đủ bằng chứng, không phải mô tả đã đọc. */
  descriptionStatus?: DescriptionStatus;
  /** Chỉ có khi nguồn ghi nhận thời điểm hoặc tham chiếu quan sát. */
  observation?: LessonObservation;
  summary?: string | null;
  summaryEvidence?: string | null;
};

export type Chapter = {
  id: string;
  title: string;
  url: string;
  position: number;
  lessons: Lesson[];
};

export type Course = {
  slug: string;
  title: string;
  url: string;
  position: number;
  chapters: Chapter[];
  lessonCount: number;
};

export type Catalog = { courses: Course[]; lessonCount: number; chapterCount: number };

/**
 * Chỉ nhận host/path nguồn hợp lệ rồi làm sạch query/fragment (có thể chứa tham số theo dõi).
 * Không lưu tham số; nhờ vậy ảnh chụp cũ và mới so sánh được với nhau.
 */
function sourceUrl(value: string, expectedPath: RegExp, label: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "seankangmvp.com" || url.port || url.username || url.password) {
    throw new Error(`Đường dẫn ${label} không hợp lệ`);
  }
  if (!expectedPath.test(url.pathname)) throw new Error(`Đường dẫn ${label} không hợp lệ`);
  url.search = "";
  url.hash = "";
  return url;
}

const descriptionStatuses: readonly DescriptionStatus[] = ["text", "link_only", "placeholder", "not_present", "unread", "unknown"];

/**
 * Giữ đúng trạng thái nguồn. Nguồn chưa có trường này (ảnh chụp cũ) thì không ghi,
 * để ảnh chụp đã lưu không bị coi là thay đổi và không tự nhận là đã đọc mô tả.
 * Giá trị lạ trở thành `unknown` thay vì tin vào nhãn không hiểu.
 */
function descriptionStatus(value: string | undefined): DescriptionStatus | undefined {
  if (value === undefined) return undefined;
  return descriptionStatuses.find((status) => status === value) ?? "unknown";
}

function timestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Bỏ query/fragment (có thể chứa token) khỏi tham chiếu nguồn. */
function sourceReference(value: RawObservationReference | undefined): string | null {
  const text = typeof value === "string"
    ? value
    // Elite ghi tham chiếu dạng object; lấy tệp ghi mốc bắt đầu quan sát.
    : (value as { from_reference?: { file?: unknown } } | null)?.from_reference?.file;
  if (typeof text !== "string" || !text) return null;
  try {
    const url = new URL(text);
    return `${url.origin}${url.pathname}`;
  } catch {
    return text.replace(/[?#].*$/, "");
  }
}

function observation(raw: RawObservation): LessonObservation | null {
  const limit = raw?.source_limit ?? raw?.sourceLimit;
  const mapped: LessonObservation = {
    observedAt: timestamp(raw?.observed_at),
    from: timestamp(raw?.observed_between?.from),
    to: timestamp(raw?.observed_between?.to),
    sourceReference: sourceReference(raw?.source_reference),
    ...(limit ? { sourceLimit: limit } : {}),
  };
  return Object.entries(mapped).some(([key, value]) => key !== "sourceLimit" && value !== null) ? mapped : null;
}

/**
 * Loại bài theo nguồn và mức bằng chứng đã có. Nhãn `video` chỉ được coi là đã xác nhận
 * khi nguồn thực sự mở trang bài; đọc từ danh sách chương thì vẫn giữ để đối chiếu nhưng
 * hạ mức bằng chứng xuống `catalog_list`.
 */
function lessonType(lesson: RawLesson): { type: LessonType; evidence: LessonTypeEvidence } {
  const type: LessonType = lesson.type === "video" || lesson.type === "reading" ? lesson.type : "unknown";
  const openedPage = (lesson.evidence ?? []).includes("lesson_page");
  const evidence: LessonTypeEvidence = openedPage ? "lesson_page" : type === "unknown" ? "unknown" : "catalog_list";
  return { type, evidence };
}

export function normalizeCatalog(inputs: RawCourse[]): Catalog {
  const seen = new Set<string>();
  const slugs = new Set<string>();
  let lessonCount = 0;
  let chapterCount = 0;
  const courses: Course[] = inputs.map((input, courseIndex) => {
    if (!input.slug || slugs.has(input.slug)) throw new Error("Mã khóa học bị thiếu hoặc trùng");
    slugs.add(input.slug);
    const courseUrl = sourceUrl(input.course.url, /^\/courses\/[^/]+$/, "khóa học");
    const chapters = input.chapters.map((chapter, chapterIndex): Chapter => {
      const chapterUrl = sourceUrl(chapter.url, /^\/courses\/[^/]+\/chapters\/\d+\/lessons$/, "chương");
      const match = chapterUrl.pathname.match(/^\/courses\/[^/]+\/chapters\/(\d+)\/lessons$/);
      if (!match || !chapterUrl.pathname.startsWith(`${courseUrl.pathname}/chapters/`)) throw new Error("Đường dẫn chương không hợp lệ");
      const chapterId = match[1];
      if (chapter.chapter_id && String(chapter.chapter_id) !== chapterId) throw new Error("Mã chương không khớp");
      chapterCount += 1;
      const lessons = chapter.lessons.map((lesson, lessonIndex): Lesson => {
        const url = sourceUrl(lesson.url, /^\/courses\/[^/]+\/chapters\/\d+\/lessons\/\d+$/, "bài");
        const lessonMatch = url.pathname.match(/^\/courses\/[^/]+\/chapters\/(\d+)\/lessons\/(\d+)$/);
        if (!lessonMatch || !url.pathname.startsWith(`${chapterUrl.pathname}/`) || lessonMatch[1] !== chapterId) throw new Error("Đường dẫn bài không khớp chương");
        const id = lessonMatch[2];
        if (lesson.lesson_id && String(lesson.lesson_id) !== id) throw new Error("Mã bài không khớp");
        if (seen.has(id)) throw new Error("Mã bài bị trùng");
        seen.add(id);
        lessonCount += 1;
        const observed = observation(lesson.observation ?? null);
        const status = descriptionStatus(lesson.description_status);
        const { type, evidence } = lessonType(lesson);
        return {
          id,
          chapterId,
          courseSlug: input.slug,
          title: lesson.name.normalize("NFC"),
          url: url.href,
          position: lessonIndex,
          // `kind` là nhãn an toàn để hiển thị: video chỉ hiện khi nguồn đã mở trang bài.
          // Loại thô và mức xác minh vẫn giữ riêng ở `type`/`typeEvidence`.
          kind: evidence === "lesson_page" || type === "reading" ? type : "unknown",
          type,
          typeEvidence: evidence,
          duration: lesson.duration_display ?? null,
          titleWithheld: false,
          ...(status ? { descriptionStatus: status } : {}),
          ...(observed ? { observation: observed } : {}),
          summary: verifiedSummaries[id] ?? null,
          summaryEvidence: verifiedSummaries[id] ? "Đã đối chiếu phần chữ trang; chưa xem nội dung video." : null,
        };
      });
      return { id: chapterId, title: (chapter.name ?? chapter.title ?? `Chương ${chapterIndex + 1}`).normalize("NFC"), url: chapterUrl.href, position: chapterIndex, lessons };
    });
    return { slug: input.slug, title: input.course.name.normalize("NFC"), url: courseUrl.href, position: courseIndex, chapters, lessonCount: chapters.reduce((n, chapter) => n + chapter.lessons.length, 0) };
  });
  return { courses, lessonCount, chapterCount };
}

export function searchable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
}

export function searchLessons(catalog: Catalog, query: string): Lesson[] {
  const needle = searchable(query.trim());
  if (!needle) return [];
  return catalog.courses.flatMap((course) => course.chapters.flatMap((chapter) => chapter.lessons.filter((lesson) => searchable(lesson.title).includes(needle))));
}
