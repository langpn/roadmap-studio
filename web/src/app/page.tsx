import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Workspace } from "@/components/workspace";
import { getAuth } from "@/lib/auth/server";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { privateRoadmap } from "@/components/roadmap-data";
import { getActiveCatalog } from "@/lib/catalog/active";
import { getDatabase } from "@/lib/db";
import { validatedLessonPageUrl } from "@/lib/media/source";
import { getProgress } from "@/lib/progress/store";
import { practiceEntry } from "@/lib/practice-entry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Home({ searchParams }: PageProps) {
  const entry = practiceEntry(await searchParams);
  if (process.env.APP_MODE === "demo") {
    return <Workspace catalog={demoCatalog} roadmap={demoRoadmap} initialProgress={{ lessons: {}, practices: {}, lastOpenedLessonId: null }} userName="bạn" mode="demo" loginAvailable={false} {...entry} />;
  }
  const session = await (await getAuth()).api.getSession({ headers: await headers() });
  if (!session) redirect("/dang-nhap");
  const db = await getDatabase();
  const [catalog, progress] = await Promise.all([
    getActiveCatalog(),
    getProgress(db, session.user.id),
  ]);
  const lessonSourceUrls = Object.fromEntries(catalog.courses.flatMap((course) => course.chapters.flatMap((chapter) =>
    chapter.lessons.flatMap((lesson) => {
      const url = validatedLessonPageUrl(lesson.url, lesson.id);
      return url ? [[lesson.id, url]] : [];
    }),
  )));
  return <Workspace catalog={catalog} roadmap={privateRoadmap} initialProgress={progress} userName={session.user.name} accountId={session.user.id} mode="private" lessonSourceUrls={lessonSourceUrls} {...entry} />;
}
