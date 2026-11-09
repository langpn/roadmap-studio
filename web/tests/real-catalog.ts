import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Chín tệp danh mục thật; chỉ dùng trong test, không đi vào sản phẩm. */
const sourceFiles = [
  "courses/baby-resolve/danh-muc.json", "courses/elite/danh-muc.json",
  "courses/freelance-mvp/danh-muc.json", "courses/elite-pro/danh-muc.json",
  "review/khoa-khac-20261106/speed-ramping.json", "review/khoa-khac-20261106/upwork-mvp.json",
  "review/khoa-khac-20261106/capcut-a-z.json", "review/khoa-khac-20261106/fusion-101.json",
  "review/khoa-khac-20261106/keyframe-animation.json",
];

export const hasPrivateCatalog = !process.env.CATALOG_MANIFEST && !process.env.CATALOG_SOURCE_ROOT
  && sourceFiles.every((file) => existsSync(path.join(path.resolve(process.cwd(), ".."), file)));

export type RealLesson = { id: string; name: string; url: string; description: string };

/** Đọc thẳng tệp danh mục đã kiểm duyệt, không qua bộ nhập đang thay đổi. */
export function readRealLessons(): RealLesson[] {
  const root = path.resolve(process.cwd(), "..");
  return sourceFiles.flatMap((file) => {
    const raw = JSON.parse(readFileSync(path.join(root, file), "utf8")) as {
      chapters: { lessons?: { name?: string; url?: string; description?: string }[] }[];
    };
    return raw.chapters.flatMap((chapter) => chapter.lessons ?? []).map((lesson) => ({
      id: (lesson.url ?? "").split("/").pop() ?? "",
      name: lesson.name ?? "",
      url: lesson.url ?? "",
      description: (lesson.description ?? "").replace(/\s+/g, " ").trim(),
    }));
  });
}
