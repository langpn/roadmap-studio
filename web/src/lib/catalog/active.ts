import { getDatabase } from "@/lib/db";
import { importCatalog, readImportedCatalog } from "./import";
import { loadCatalog } from "./source";
import type { Catalog } from "./normalize";

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
    if (!hasWithheldTitles) return saved;
    try {
      return restoreSavedTitles(saved, await loadCatalog());
    } catch {
      // Restoring old titles is optional: keep the valid snapshot available if the source cannot be used.
      return saved;
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
  return catalog;
}
