import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { normalizeCatalog, type Catalog, type RawCourse, type RawLesson } from "./normalize";
import { loadPriorityObservations, priorityKey } from "./priority";

const defaultSources = [
    ["baby-resolve", "courses/baby-resolve/danh-muc.json"],
    ["elite", "courses/elite/danh-muc.json"],
    ["freelance-mvp", "courses/freelance-mvp/danh-muc.json"],
    ["elite-pro", "courses/elite-pro/danh-muc.json"],
    ["speed-ramping", "review/khoa-khac-20261106/speed-ramping.json"],
    ["upwork-mvp", "review/khoa-khac-20261106/upwork-mvp.json"],
    ["capcut-a-z", "review/khoa-khac-20261106/capcut-a-z.json"],
    ["fusion-101", "review/khoa-khac-20261106/fusion-101.json"],
    ["keyframe-animation", "review/khoa-khac-20261106/keyframe-animation.json"],
  ] as const;

const sourceSchema = z.array(z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  file: z.string().min(1),
  supplemental: z.boolean().optional(),
})).min(1);

function lessonId(lesson: RawLesson): string {
  return lesson.lesson_id ?? lesson.url.split("/").pop() ?? "";
}

/**
 * Ghép trạng thái/loại từ nguồn ưu tiên vào danh mục gốc theo mã bài.
 * Chỉ điền trường mà nguồn ưu tiên thực sự có; thiếu thì giữ nguyên danh mục.
 */
function applyPriority(raw: RawCourse, priority: Map<string, Partial<RawLesson>>): RawCourse {
  if (priority.size === 0) return raw;
  return {
    ...raw,
    chapters: raw.chapters.map((chapter) => ({
      ...chapter,
      lessons: chapter.lessons.map((lesson) => {
        const overlay = priority.get(priorityKey(raw.slug, lessonId(lesson)));
        return overlay ? { ...lesson, ...overlay } : lesson;
      }),
    })),
  };
}

export async function loadCatalog(options: { root?: string; manifestPath?: string } = {}): Promise<Catalog> {
  const root = path.resolve(/*turbopackIgnore: true*/ options.root || process.env.CATALOG_SOURCE_ROOT || path.resolve(process.cwd(), ".."));
  const manifestPath = options.manifestPath ?? process.env.CATALOG_MANIFEST;
  const sources = manifestPath
    ? sourceSchema.parse(JSON.parse(await readFile(/*turbopackIgnore: true*/ manifestPath, "utf8")))
    : defaultSources.map(([slug, file], index) => ({ slug, file, supplemental: index >= 4 }));
  const raw = await Promise.all(sources.map(async ({ slug, file, supplemental }): Promise<RawCourse> => {
    const resolved = path.resolve(root, file);
    const relative = path.relative(root, resolved);
    if (path.isAbsolute(file) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
      throw new Error("Đường dẫn danh mục phải nằm trong thư mục nguồn.");
    }
    const json = JSON.parse(await readFile(/*turbopackIgnore: true*/ resolved, "utf8")) as Omit<RawCourse, "slug">;
    return { ...json, slug, supplemental };
  }));
  // Nguồn ưu tiên chỉ áp cho danh mục mặc định có đường dẫn đã biết; manifest riêng tự chịu trách nhiệm.
  const priority = manifestPath ? new Map<string, Partial<RawLesson>>() : await loadPriorityObservations(root);
  return normalizeCatalog(raw.map((course) => applyPriority(course, priority)));
}
