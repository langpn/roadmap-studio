import type { PgliteDatabase } from "drizzle-orm/pglite";
import { and, desc, eq, sql } from "drizzle-orm";
import { lessonProgress, practiceProgress } from "@/lib/db/schema";

export type ProgressState = "not_updated" | "in_progress" | "completed";
export type Progress = {
  lessons: Record<string, ProgressState>;
  practices: Record<string, ProgressState>;
  lastOpenedLessonId: string | null;
  // Demo snapshots have no database versions.
  versions?: { lessons: Record<string, string>; practices: Record<string, string> };
};

// PostgreSQL timestamps have microsecond precision; Date would truncate it to milliseconds.
const lessonVersion = sql<string>`to_char(${lessonProgress.updatedAt}, 'YYYY-MM-DD HH24:MI:SS.US')`;
const practiceVersion = sql<string>`to_char(${practiceProgress.updatedAt}, 'YYYY-MM-DD HH24:MI:SS.US')`;

export async function getProgress(db: PgliteDatabase, userId: string): Promise<Progress> {
  const lessons = await db.select({ lessonId: lessonProgress.lessonId, state: lessonProgress.state, openedAt: lessonProgress.openedAt, version: lessonVersion })
    .from(lessonProgress).where(eq(lessonProgress.userId, userId)).orderBy(desc(lessonProgress.openedAt));
  const practices = await db.select({ practiceId: practiceProgress.practiceId, state: practiceProgress.state, version: practiceVersion })
    .from(practiceProgress).where(eq(practiceProgress.userId, userId));
  return {
    lessons: Object.fromEntries(lessons.map((lesson) => [lesson.lessonId, lesson.state as ProgressState])),
    practices: Object.fromEntries(practices.map((practice) => [practice.practiceId, practice.state as ProgressState])),
    lastOpenedLessonId: lessons.filter((lesson) => lesson.openedAt).sort((a, b) => b.openedAt!.getTime() - a.openedAt!.getTime())[0]?.lessonId ?? null,
    versions: {
      lessons: Object.fromEntries(lessons.map((lesson) => [lesson.lessonId, lesson.version])),
      practices: Object.fromEntries(practices.map((practice) => [practice.practiceId, practice.version])),
    },
  };
}
export async function setLessonProgress(db: PgliteDatabase, userId: string, lessonId: string, state: ProgressState, expectedVersion: string | null): Promise<string | null> {
  const rows = expectedVersion === null
    ? await db.insert(lessonProgress).values({ userId, lessonId, state }).onConflictDoNothing().returning({ version: lessonVersion })
    : await db.update(lessonProgress).set({
      state, updatedAt: sql`greatest(clock_timestamp()::timestamp, ${lessonProgress.updatedAt} + interval '1 microsecond')`,
    }).where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId), sql`${lessonProgress.updatedAt} = ${expectedVersion}::timestamp`))
      .returning({ version: lessonVersion });
  return rows[0]?.version ?? null;
}
export async function setPracticeProgress(db: PgliteDatabase, userId: string, practiceId: string, state: ProgressState, expectedVersion: string | null): Promise<string | null> {
  const rows = expectedVersion === null
    ? await db.insert(practiceProgress).values({ userId, practiceId, state }).onConflictDoNothing().returning({ version: practiceVersion })
    : await db.update(practiceProgress).set({
      state, updatedAt: sql`greatest(clock_timestamp()::timestamp, ${practiceProgress.updatedAt} + interval '1 microsecond')`,
    }).where(and(eq(practiceProgress.userId, userId), eq(practiceProgress.practiceId, practiceId), sql`${practiceProgress.updatedAt} = ${expectedVersion}::timestamp`))
      .returning({ version: practiceVersion });
  return rows[0]?.version ?? null;
}
export async function recordLessonOpened(db: PgliteDatabase, userId: string, lessonId: string): Promise<{ state: ProgressState; version: string }> {
  const openedAt = new Date();
  const [row] = await db.insert(lessonProgress).values({ userId, lessonId, openedAt }).onConflictDoUpdate({
    target: [lessonProgress.userId, lessonProgress.lessonId], set: { openedAt },
  }).returning({ state: lessonProgress.state, version: lessonVersion });
  return { state: row.state as ProgressState, version: row.version };
}
