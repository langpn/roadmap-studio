import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { RawLesson } from "./normalize";

/**
 * Nguồn ưu tiên theo `review/nguon-uu-tien.md` và `design.md` mục 2.
 * Mỗi tệp chỉ bổ sung trạng thái/loại/quan sát; không ghi đè danh mục gốc trên đĩa.
 * `courseDir` là gốc để hiểu tham chiếu tương đối trong tệp, vì Elite ghi `raw/…`.
 * Năm khóa bổ sung có một tệp quan sát cho mỗi bài trong `dir` (không có tệp tổng đủ thời gian).
 */
type PrioritySource =
  | { slug: string; file: string; courseDir: string }
  | { slug: string; dir: string };

const prioritySources: readonly PrioritySource[] = [
  { slug: "baby-resolve", file: "courses/baby-resolve/doi-chieu-schema.json", courseDir: "courses/baby-resolve" },
  { slug: "elite", file: "courses/elite/doi-chieu-schema.json", courseDir: "courses/elite" },
  { slug: "elite-pro", file: "review/chi-muc-trang-elite-pro-sau-thu-lai-39.json", courseDir: "courses/elite-pro" },
  // Thư mục dùng tên khóa của nguồn, khác slug danh mục ở CapCut và Upwork.
  { slug: "speed-ramping", dir: "review/khoa-khac-20261106/chi-tiet-trang/speed-ramping" },
  { slug: "upwork-mvp", dir: "review/khoa-khac-20261106/chi-tiet-trang/upwork-mvp-tieng-free" },
  { slug: "capcut-a-z", dir: "review/khoa-khac-20261106/chi-tiet-trang/khoa-hoc-capcut-a-z-free" },
  { slug: "fusion-101", dir: "review/khoa-khac-20261106/chi-tiet-trang/fusion-101" },
  { slug: "keyframe-animation", dir: "review/khoa-khac-20261106/chi-tiet-trang/keyframe-animation" },
];

/** Khoá theo khóa + mã bài để một mã trùng ở khóa khác không nhận nhầm trạng thái. */
export function priorityKey(courseSlug: string, lessonId: string): string {
  return `${courseSlug}\0${lessonId}`;
}

type UnknownRecord = Record<string, unknown>;

function lessonIdOf(lesson: UnknownRecord): string | null {
  if (typeof lesson.lesson_id === "string") return lesson.lesson_id;
  if (typeof lesson.lessonId === "string") return lesson.lessonId;
  const url = typeof lesson.url === "string" ? lesson.url : null;
  return url ? url.split("/").pop() ?? null : null;
}

/**
 * Elite ghi tham chiếu tương đối so với thư mục khóa (`raw/noi-dung.jsonl`), nguồn khác ghi từ gốc
 * dự án. Chỉ ghép tiền tố khi tệp đó thực sự tồn tại, để không bịa đường dẫn.
 */
async function resolveReference(text: string, root: string, courseDir: string): Promise<string> {
  if (text.includes("://") || text.startsWith("courses/") || text.startsWith("review/")) return text;
  const candidate = `${courseDir}/${text.replace(/^\.\//, "")}`;
  try {
    await stat(path.resolve(root, candidate));
    return candidate;
  } catch {
    return text;
  }
}

async function observationOf(
  lesson: UnknownRecord,
  root: string,
  courseDir: string,
): Promise<RawLesson["observation"]> {
  const observation = lesson.observation as UnknownRecord | null | undefined;
  if (!observation) {
    // Ưu tiên bản hiệu đính đã lược tham số theo dõi khi chỉ mục Elite Pro có chỉ định.
    const reference = typeof lesson.resource_overlay_reference === "string"
      ? lesson.resource_overlay_reference
      : lesson.observation_source_reference;
    return typeof reference === "string" ? { source_reference: reference } : undefined;
  }
  const value = observation.source_reference;
  const text = typeof value === "string"
    ? value
    : (value as { from_reference?: { file?: unknown } } | null)?.from_reference?.file;
  const resolved = typeof text === "string" ? await resolveReference(text, root, courseDir) : null;
  return { ...observation, source_reference: resolved } as RawLesson["observation"];
}

/**
 * Tệp quan sát một trang bài: chỉ bổ sung trạng thái chữ và khoảng quan sát.
 * `type`/thời lượng của trang bài không ghi đè danh mục: iframe đã thấy chưa chứng minh loại bài,
 * còn nhãn thời lượng ở trang chương là nguồn khác và không được biến thành `null`.
 */
async function overlayFromPage(entryFile: string, root: string, slug: string): Promise<[string, Partial<RawLesson>]> {
  const page = JSON.parse(await readFile(path.resolve(root, entryFile), "utf8")) as UnknownRecord;
  const name = path.basename(entryFile);
  const id = typeof page.lessonId === "string" ? page.lessonId : "";
  let url: URL | null = null;
  try {
    url = typeof page.url === "string" ? new URL(page.url) : null;
  } catch {
    url = null;
  }
  const tail = url ? url.pathname.split("/").pop() ?? "" : "";
  // Trang bị chuyển hướng thì phần chữ quan sát được có thể thuộc bài khác; không ghép vào bài này.
  // So sánh đường dẫn đã bỏ query/fragment để tham số theo dõi không tự chặn cả danh mục.
  if (typeof page.actualUrl === "string") {
    let actual: URL | null = null;
    try {
      actual = new URL(page.actualUrl);
    } catch {
      actual = null;
    }
    if (!actual || !url || actual.hostname !== url.hostname || actual.pathname !== url.pathname) {
      throw new Error(`Tệp quan sát ${entryFile} ghi URL cuối khác URL bài`);
    }
  }
  if (!/^\d+$/.test(id) || `${id}.json` !== name || !url || url.protocol !== "https:" || url.hostname !== "seankangmvp.com"
    || url.port || url.username || url.password || url.search || url.hash || tail !== id) {
    throw new Error(`Tệp quan sát ${entryFile} có URL hoặc mã bài không hợp lệ`);
  }
  const entry: Partial<RawLesson> = {};
  if (typeof page.description_status === "string") entry.description_status = page.description_status;
  const observation = page.observation as UnknownRecord | null | undefined;
  const from = typeof observation?.startedAt === "string" ? observation.startedAt : null;
  const to = typeof observation?.finishedAt === "string" ? observation.finishedAt : null;
  if (observation && (from || to)) {
    const limit = [page.limits_and_disclaimers, page.duration_scope_note]
      .filter((value) => typeof value === "string" && value)
      .join(" ");
    entry.observation = {
      observed_between: { from, to },
      source_reference: entryFile,
      ...(limit ? { source_limit: limit } : {}),
    };
  }
  return [priorityKey(slug, id), entry];
}

/** Đọc thư mục quan sát một bài một tệp; tệp `checkpoint.json` chỉ là tiến độ của worker. */
async function overlayFromDir(root: string, slug: string, dir: string): Promise<Map<string, Partial<RawLesson>>> {
  const overlay = new Map<string, Partial<RawLesson>>();
  let names: string[];
  try {
    names = await readdir(path.resolve(root, dir));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return overlay;
    throw error;
  }
  for (const name of names) {
    if (!name.endsWith(".json") || name === "checkpoint.json") continue;
    const pair = await overlayFromPage(`${dir}/${name}`, root, slug);
    // Hai tệp cùng mã bài thì không đoán bản đúng; dừng để đối chiếu thay vì ghi đè lặng lẽ.
    if (overlay.has(pair[0])) throw new Error(`Mã bài ${pair[0].split("\0")[1]} có nhiều tệp quan sát trong ${dir}`);
    overlay.set(pair[0], pair[1]);
  }
  return overlay;
}

/** Gom mọi bài trong một tệp ưu tiên về cùng một dạng phẳng theo khoá khóa + mã bài. */
async function overlayFrom(
  json: UnknownRecord,
  root: string,
  slug: string,
  courseDir: string,
): Promise<Map<string, Partial<RawLesson>>> {
  const chapters = Array.isArray(json.chapters) ? (json.chapters as UnknownRecord[]) : null;
  const lessons = chapters
    ? chapters.flatMap((chapter) => (Array.isArray(chapter.lessons) ? (chapter.lessons as UnknownRecord[]) : []))
    : Array.isArray(json.lessons) ? (json.lessons as UnknownRecord[]) : [];
  const overlay = new Map<string, Partial<RawLesson>>();
  for (const lesson of lessons) {
    const id = lessonIdOf(lesson);
    if (!id) continue;
    const entry: Partial<RawLesson> = {};
    const status = lesson.description_status ?? lesson.description_status_at_snapshot;
    if (typeof status === "string") entry.description_status = status;
    if (typeof lesson.type === "string") entry.type = lesson.type;
    if (Array.isArray(lesson.evidence)) entry.evidence = lesson.evidence as string[];
    const observation = await observationOf(lesson, root, courseDir);
    // Chỉ ghi đè khi nguồn ưu tiên thực sự có quan sát; nếu không, giữ nguyên của danh mục gốc.
    if (observation) entry.observation = observation;
    overlay.set(priorityKey(slug, id), entry);
  }
  return overlay;
}

/**
 * Đọc các tệp ưu tiên hiện có. Tệp thiếu được bỏ qua để bản sao không có dữ liệu
 * riêng vẫn dựng được; tệp hỏng thì báo lỗi thay vì lặng lẽ mất trạng thái.
 */
export async function loadPriorityObservations(root: string): Promise<Map<string, Partial<RawLesson>>> {
  const merged = new Map<string, Partial<RawLesson>>();
  for (const source of prioritySources) {
    if ("dir" in source) {
      for (const [key, entry] of await overlayFromDir(root, source.slug, source.dir)) {
        merged.set(key, { ...merged.get(key), ...entry });
      }
      continue;
    }
    const { slug, file, courseDir } = source;
    let json: UnknownRecord;
    try {
      json = JSON.parse(await readFile(path.resolve(root, file), "utf8")) as UnknownRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const [key, entry] of await overlayFrom(json, root, slug, courseDir)) {
      merged.set(key, { ...merged.get(key), ...entry });
    }
  }
  return merged;
}
