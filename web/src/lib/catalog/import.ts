import type { PgliteDatabase } from "drizzle-orm/pglite";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { catalogHistory, catalogSnapshot } from "@/lib/db/schema";
import type { Catalog } from "./normalize";

function lessons(catalog: Catalog | null) {
  return new Map((catalog?.courses ?? []).flatMap((course) => course.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => [lesson.id, lesson] as const))));
}

export function previewCatalogChanges(old: Catalog | null, next: Catalog): { added: number; changed: number; removed: number } {
  const before = lessons(old);
  const after = lessons(next);
  let added = 0, changed = 0, removed = 0;
  for (const [id, lesson] of after) {
    const previous = before.get(id);
    if (!previous) added += 1;
    else if (JSON.stringify(previous) !== JSON.stringify(lesson)) changed += 1;
  }
  for (const id of before.keys()) if (!after.has(id)) removed += 1;
  return { added, changed, removed };
}

function validate(catalog: Catalog): void {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  let chapterCount = 0, lessonCount = 0;
  for (const course of catalog.courses) {
    if (!course.slug || slugs.has(course.slug)) throw new Error("Mã khóa bị thiếu hoặc trùng.");
    slugs.add(course.slug);
    let courseCount = 0;
    for (const chapter of course.chapters) {
      chapterCount += 1;
      for (const lesson of chapter.lessons) {
        const url = new URL(lesson.url);
        const allowed = url.hostname === "seankangmvp.com" || (process.env.NODE_ENV === "test" && url.hostname === "example.invalid");
        if (!allowed || url.protocol !== "https:" || url.search || url.hash || !/^\d+$/.test(lesson.id) || ids.has(lesson.id)) throw new Error("Danh mục có URL hoặc mã bài không hợp lệ.");
        if (lesson.courseSlug !== course.slug || lesson.chapterId !== chapter.id) throw new Error("Bài học không khớp chương.");
        ids.add(lesson.id); lessonCount += 1; courseCount += 1;
      }
    }
    if (courseCount !== course.lessonCount) throw new Error("Tổng bài trong khóa không khớp.");
  }
  if (catalog.lessonCount !== lessonCount || catalog.chapterCount !== chapterCount) throw new Error("Tổng danh mục không khớp.");
}

export async function importCatalog(db: PgliteDatabase, catalog: Catalog): Promise<void> {
  validate(catalog);
  const content = JSON.stringify(catalog);
  const digest = createHash("sha256").update(content).digest("hex");
  await db.transaction(async (tx) => {
    await tx.insert(catalogHistory).values({ content, digest }).onConflictDoNothing();
    await tx.insert(catalogSnapshot).values({ id: "active", content, digest }).onConflictDoUpdate({
      target: catalogSnapshot.id, set: { content, digest, importedAt: new Date() },
    });
  });
}

export async function readImportedCatalog(db: PgliteDatabase): Promise<Catalog | null> {
  const [snapshot] = await db.select().from(catalogSnapshot).where(eq(catalogSnapshot.id, "active")).limit(1);
  return snapshot ? JSON.parse(snapshot.content) as Catalog : null;
}
