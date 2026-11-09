import { Workspace } from "@/components/workspace";
import { demoCatalog } from "@/lib/catalog/demo";
import { demoRoadmap } from "@/lib/catalog/demo-roadmap";
import { practiceEntry } from "@/lib/practice-entry";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DemoPage({ searchParams }: PageProps) {
  const entry = practiceEntry(await searchParams);
  return <Workspace catalog={demoCatalog} roadmap={demoRoadmap} initialProgress={{ lessons: {}, practices: {}, lastOpenedLessonId: null }} userName="bạn" mode="demo" loginAvailable={process.env.APP_MODE !== "demo"} {...entry} />;
}
