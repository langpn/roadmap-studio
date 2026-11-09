import type { PgliteDatabase } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import { lessonMedia } from "@/lib/db/schema";
import type { Catalog } from "@/lib/catalog/normalize";
import type { LessonMediaEntry, LessonMediaMap } from "./lesson-media-map";

export type StoredLessonMedia = LessonMediaEntry;

/** Lessons that exist in the active catalog, used to reject unknown ids. */
function knownLessonIds(catalog: Catalog): Set<string> {
  return new Set(catalog.courses.flatMap((course) => course.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id))));
}

export async function getLessonMedia(db: PgliteDatabase, userId: string): Promise<StoredLessonMedia[]> {
  const rows = await db.select({
    lessonId: lessonMedia.lessonId,
    kind: lessonMedia.kind,
    videoId: lessonMedia.videoId,
    embedUrl: lessonMedia.embedUrl,
  }).from(lessonMedia).where(eq(lessonMedia.userId, userId));
  return rows.map((row) => ({
    lessonId: row.lessonId,
    kind: row.kind as StoredLessonMedia["kind"],
    videoId: row.videoId,
    embedUrl: row.embedUrl,
  }));
}

export async function getLessonMediaForLesson(db: PgliteDatabase, userId: string, lessonId: string): Promise<StoredLessonMedia | null> {
  const [row] = await db.select({
    lessonId: lessonMedia.lessonId,
    kind: lessonMedia.kind,
    videoId: lessonMedia.videoId,
    embedUrl: lessonMedia.embedUrl,
  }).from(lessonMedia)
    .where(and(eq(lessonMedia.userId, userId), eq(lessonMedia.lessonId, lessonId)))
    .limit(1);
  if (!row) return null;
  return { lessonId: row.lessonId, kind: row.kind as StoredLessonMedia["kind"], videoId: row.videoId, embedUrl: row.embedUrl };
}

export type ImportLessonMediaResult = { imported: number; replaced: number; rejected: number };

/**
 * Upserts the learner's own collected links. Entries whose lesson id is not in
 * the active catalog are rejected rather than stored, so a stale file cannot
 * introduce rows that later pages cannot resolve.
 */
export async function importLessonMedia(
  db: PgliteDatabase,
  userId: string,
  map: LessonMediaMap,
  catalog: Catalog,
): Promise<ImportLessonMediaResult> {
  const known = knownLessonIds(catalog);
  const accepted: LessonMediaEntry[] = [];
  let rejected = 0;
  for (const entry of map.entries) {
    if (known.has(entry.lessonId)) accepted.push(entry);
    else rejected += 1;
  }
  if (accepted.length === 0) return { imported: 0, replaced: 0, rejected };

  const existing = new Set((await getLessonMedia(db, userId)).map((entry) => entry.lessonId));
  let replaced = 0;
  for (const entry of accepted) if (existing.has(entry.lessonId)) replaced += 1;

  const collectedAt = new Date(map.collectedAt);
  const safeCollectedAt = Number.isNaN(collectedAt.getTime()) ? new Date() : collectedAt;

  await db.transaction(async (tx) => {
    for (const entry of accepted) {
      await tx.insert(lessonMedia).values({
        userId,
        lessonId: entry.lessonId,
        kind: entry.kind,
        videoId: entry.videoId,
        embedUrl: entry.embedUrl,
        collectedAt: safeCollectedAt,
      }).onConflictDoUpdate({
        target: [lessonMedia.userId, lessonMedia.lessonId],
        set: {
          kind: entry.kind,
          videoId: entry.videoId,
          embedUrl: entry.embedUrl,
          collectedAt: safeCollectedAt,
          updatedAt: new Date(),
        },
      });
    }
  });

  return { imported: accepted.length, replaced, rejected };
}

export async function deleteLessonMedia(db: PgliteDatabase, userId: string): Promise<void> {
  await db.delete(lessonMedia).where(eq(lessonMedia.userId, userId));
}
