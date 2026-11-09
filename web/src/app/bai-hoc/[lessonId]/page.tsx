import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { LessonStudyView } from "./lesson-study-view";
import { courseNeighbours, findLessonStudyContext } from "./lesson-study";
import { getAuth } from "@/lib/auth/server";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { getActiveCatalog } from "@/lib/catalog/active";
import { getPracticesForLesson } from "@/lib/catalog/lesson-practices";
import { getRelatedLessons } from "@/lib/catalog/lesson-links";
import type { Catalog } from "@/lib/catalog/normalize";
import { privateRoadmap, type RoadmapConfig } from "@/components/roadmap-data";
import { getDatabase } from "@/lib/db";
import { getLessonMediaForLesson } from "@/lib/media/store";
import { validatedLessonPageUrl } from "@/lib/media/source";
import { getProgress } from "@/lib/progress/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ demo?: string | string[] }>;
};

type DemoSetup = { catalog: Catalog; roadmap: RoadmapConfig };

/** ?demo=1 phân biệt bài mẫu khi /demo vẫn chạy trên máy chủ bản cá nhân. */
const DEMO_SUFFIX = "?demo=1";

function demoStudy(lessonId: string, setup: DemoSetup) {
  const context = findLessonStudyContext(setup.catalog, lessonId);
  if (!context) return null;
  const neighbours = courseNeighbours(context.course, lessonId);
  return (
    <LessonStudyView
      key={`demo-${lessonId}`}
      mode="demo"
      homeHref="/demo"
      roadmapHref="/demo"
      studySuffix={DEMO_SUFFIX}
      lesson={context.lesson}
      course={context.course}
      chapter={context.chapter}
      position={neighbours.position}
      total={neighbours.total}
      previousLesson={neighbours.previous}
      nextLesson={neighbours.next}
      initialState="not_updated"
      initialVersion={null}
      media={null}
      relatedLessons={getRelatedLessons(setup.catalog, setup.roadmap.lessonConnections ?? [], context.course.slug, lessonId)}
      relatedPractices={getPracticesForLesson(setup.roadmap.practices, context.course.slug, lessonId)}
    />
  );
}

function isDemoQuery(value: string | string[] | undefined): boolean {
  return (Array.isArray(value) ? value[0] : value) === "1";
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { lessonId } = await params;
  const demoRequested = isDemoQuery((await searchParams).demo) || process.env.APP_MODE === "demo";
  let found = demoRequested ? findLessonStudyContext(demoCatalog, lessonId) : null;
  if (!found && !demoRequested) {
    // Tiêu đề bài cá nhân chỉ đọc sau khi biết người xem đã đăng nhập.
    try {
      const session = await (await getAuth()).api.getSession({ headers: await headers() });
      if (session) found = findLessonStudyContext(await getActiveCatalog(), lessonId);
    } catch {
      // Trang học vẫn phải mở được khi danh mục chưa đọc xong.
    }
  }
  const title = found ? `${found.lesson.title} | Đường dựng` : "Bài học | Đường dựng";
  return {
    title,
    description: found ? `Bài học trong khóa ${found.course.title}.` : "Trang học bài.",
    robots: { index: false, follow: false },
  };
}

export default async function LessonStudyPage({ params, searchParams }: PageProps) {
  const { lessonId } = await params;
  if (!/^\d+$/.test(lessonId)) notFound();

  const demoRequested = isDemoQuery((await searchParams).demo) || process.env.APP_MODE === "demo";
  if (demoRequested) {
    const demo = demoStudy(lessonId, { catalog: demoCatalog, roadmap: demoRoadmap });
    if (demo) return demo;
    notFound();
  }

  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/dang-nhap");

  const db = await getDatabase();
  const catalog = await getActiveCatalog();
  const context = findLessonStudyContext(catalog, lessonId);
  if (!context) notFound();

  // Lỗi đọc tiến độ hoặc media không được chặn việc học bài.
  const [progressResult, mediaResult] = await Promise.allSettled([
    getProgress(db, session.user.id),
    getLessonMediaForLesson(db, session.user.id, lessonId),
  ]);
  const progress = progressResult.status === "fulfilled" ? progressResult.value : null;
  const media = mediaResult.status === "fulfilled" ? mediaResult.value : null;
  const loadNotice = progressResult.status === "rejected"
    ? "Chưa đọc được tiến độ đã lưu. Bài học vẫn mở; trạng thái hiển thị có thể chưa đúng và thao tác lưu sẽ được kiểm tra lại."
    : mediaResult.status === "rejected"
      ? "Chưa đọc được liên kết phát đã lưu. Bạn vẫn xem được mô tả và mở trang bài gốc."
      : undefined;
  const neighbours = courseNeighbours(context.course, lessonId);

  return (
    <LessonStudyView
      key={`private-${lessonId}`}
      mode="private"
      accountId={session.user.id}
      homeHref="/"
      lesson={context.lesson}
      course={context.course}
      chapter={context.chapter}
      position={neighbours.position}
      total={neighbours.total}
      previousLesson={neighbours.previous}
      nextLesson={neighbours.next}
      initialState={progress?.lessons[lessonId] ?? "not_updated"}
      initialVersion={progress?.versions?.lessons[lessonId] ?? null}
      loadNotice={loadNotice}
      media={media ? { kind: media.kind, embedUrl: media.embedUrl } : null}
      sourceUrl={validatedLessonPageUrl(context.lesson.url, context.lesson.id) ?? undefined}
      relatedLessons={getRelatedLessons(catalog, privateRoadmap.lessonConnections ?? [], context.course.slug, lessonId)}
      relatedPractices={getPracticesForLesson(privateRoadmap.practices, context.course.slug, lessonId)}
    />
  );
}
