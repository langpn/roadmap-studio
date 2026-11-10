import { getDatabase } from "@/lib/db";
import { importCatalog, readImportedCatalog } from "./import";
import { loadCatalog } from "./source";
import type { Catalog } from "./normalize";
import { readFile } from "node:fs/promises";
import path from "node:path";

async function restoreEliteText(catalog: Catalog): Promise<Catalog> {
  if (process.env.CATALOG_MANIFEST || !catalog.courses.some((course) => course.slug === "elite")) return catalog;
  try {
    const root = process.env.CATALOG_SOURCE_ROOT || path.resolve(process.cwd(), "..");
    const source = JSON.parse(await readFile(path.resolve(root, "courses/elite/noi-dung.json"), "utf8")) as {
      chapters?: { lessons?: { url?: string; captured?: boolean; content_status?: string; hydration?: string; text?: string }[] }[];
    };
    const texts = new Map((source.chapters ?? []).flatMap((chapter) => (chapter.lessons ?? [])
      .filter((lesson) => lesson.captured === true && lesson.content_status === "read" && lesson.hydration === "content-present" && typeof lesson.url === "string" && typeof lesson.text === "string" && lesson.text.trim())
      .map((lesson) => [lesson.url, lesson.text!.trim()] as const)));
    return { ...catalog, courses: catalog.courses.map((course) => course.slug !== "elite" ? course : ({
      ...course, chapters: course.chapters.map((chapter) => ({
        ...chapter, lessons: chapter.lessons.map((lesson) => {
          const text = texts.get(lesson.url);
          return text ? { ...lesson, summary: text, summaryEvidence: "Phần chữ đã lưu từ trang bài học; chưa xác minh nội dung video." } : lesson;
        }),
      })),
    })) };
  } catch {
    return catalog;
  }
}

function restoreSavedTitles(saved: Catalog, source: Catalog): Catalog {
  const titles = new Map(source.courses.flatMap((course) => course.chapters.flatMap((chapter) =>
    chapter.lessons.filter((lesson) => !lesson.titleWithheld).map((lesson) => [
      `${course.slug}\0${chapter.id}\0${lesson.id}\0${lesson.url}`, lesson.title,
    ] as const),
  )));
  return {
    ...saved,
    courses: saved.courses.map((course) => ({
      ...course,
      chapters: course.chapters.map((chapter) => ({
        ...chapter,
        lessons: chapter.lessons.map((lesson) => {
          if (!lesson.titleWithheld) return lesson;
          const title = titles.get(`${course.slug}\0${chapter.id}\0${lesson.id}\0${lesson.url}`);
          return title === undefined ? lesson : { ...lesson, title, titleWithheld: false };
        }),
      })),
    })),
  };
}

export async function getActiveCatalog() {
  const db = await getDatabase();
  const saved = await readImportedCatalog(db);
  if (saved) {
    const hasWithheldTitles = saved.courses.some((course) => course.chapters.some((chapter) =>
      chapter.lessons.some((lesson) => lesson.titleWithheld),
    ));
    if (!hasWithheldTitles) return restoreEliteText(saved);
    try {
      return restoreEliteText(restoreSavedTitles(saved, await loadCatalog()));
    } catch {
      // Restoring old titles is optional: keep the valid snapshot available if the source cannot be used.
      return restoreEliteText(saved);
    }
  }
  if (process.env.NODE_ENV === "production") throw new Error("Chưa có danh mục được nhập vào database.");
  let catalog: Catalog;
  try {
    catalog = await loadCatalog();
  } catch (error) {
    if (!process.env.CATALOG_MANIFEST && !process.env.CATALOG_SOURCE_ROOT && (error as NodeJS.ErrnoException).code === "ENOENT") {
      return { courses: [], lessonCount: 0, chapterCount: 0 };
    }
    throw error;
  }
  await importCatalog(db, catalog);
  return restoreEliteText(catalog);
}
