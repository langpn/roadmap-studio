import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadCatalog } from "@/lib/catalog/source";
import { loadPriorityObservations, priorityKey } from "@/lib/catalog/priority";

const source = (slug: string, lessons: unknown[]) => ({
  course: { name: `Khóa ${slug}`, url: `https://seankangmvp.com/courses/${slug}` },
  chapters: [{
    chapter_id: "8",
    title: "Chương mẫu",
    url: `https://seankangmvp.com/courses/${slug}/chapters/8/lessons`,
    lessons,
  }],
});

const lesson = (id: string, extra: Record<string, unknown> = {}, slug = "sample") => ({
  lesson_id: id,
  name: `Bài ${id}`,
  url: `https://seankangmvp.com/courses/${slug}/chapters/8/lessons/${id}`,
  type: "video",
  ...extra,
});

async function fixture(files: Record<string, unknown>) {
  const root = await mkdtemp(path.join(tmpdir(), "roadmap-priority-"));
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(content));
  }
  await writeFile(path.join(root, "manifest.json"), JSON.stringify([{ slug: "sample", file: "sample.json" }]));
  return { root, manifestPath: path.join(root, "manifest.json") };
}

describe("nguồn ưu tiên và loại bài", () => {
  it("giữ loại nguồn tách khỏi mức xác minh", async () => {
    const { root, manifestPath } = await fixture({
      "sample.json": source("sample", [
        lesson("1", { evidence: ["chapter_page", "lesson_page"] }),
        lesson("2", { evidence: ["chapter_page"] }),
        lesson("3", { type: "reading", evidence: ["chapter_page", "lesson_page"] }),
        lesson("4", { type: "unknown" }),
        lesson("5", {}),
      ]),
    });
    const catalog = await loadCatalog({ root, manifestPath });
    const lessons = catalog.courses[0].chapters[0].lessons;
    expect(lessons.map((entry) => entry.type)).toEqual(["video", "video", "reading", "unknown", "video"]);
    expect(lessons.map((entry) => entry.typeEvidence)).toEqual(["lesson_page", "catalog_list", "lesson_page", "unknown", "catalog_list"]);
    // Nhãn hiển thị không được nói chắc "video" khi chỉ đọc danh sách chương.
    expect(lessons.map((entry) => entry.kind)).toEqual(["video", "unknown", "reading", "unknown", "unknown"]);
  });

  it("không tự nhận video từ nhãn thời lượng hoặc iframe chưa xác định", async () => {
    const { root, manifestPath } = await fixture({
      "sample.json": source("sample", [
        lesson("1", { type: "unknown", duration_display: "5 phút", evidence: ["chapter_page"], video_embed_host: "iframe.mediadelivery.net" }),
      ]),
    });
    const [entry] = (await loadCatalog({ root, manifestPath })).courses[0].chapters[0].lessons;
    expect(entry).toMatchObject({ kind: "unknown", type: "unknown", typeEvidence: "unknown", duration: "5 phút" });
  });

  it("đọc nguồn ưu tiên theo mã bài và bỏ qua tệp thiếu", async () => {    const { root } = await fixture({
      "courses/elite/doi-chieu-schema.json": {
        chapters: [{ lessons: [
          { lesson_id: "1", type: "reading", description_status: "placeholder", evidence: ["chapter_page", "lesson_page"] },
          { lesson_id: "2", description_status: "link_only" },
        ] }],
      },
    });
    const priority = await loadPriorityObservations(root);
    expect(priority.get(priorityKey("elite", "1"))).toMatchObject({ type: "reading", description_status: "placeholder", evidence: ["chapter_page", "lesson_page"] });
    expect(priority.get(priorityKey("elite", "2"))).toMatchObject({ description_status: "link_only" });
    expect(priority.has(priorityKey("elite", "3"))).toBe(false);
    // Mã bài trùng ở khóa khác không được nhận trạng thái của Elite.
    expect(priority.has(priorityKey("baby-resolve", "1"))).toBe(false);
  });

  it("đọc chỉ mục Elite Pro dùng trường nguồn quan sát riêng", async () => {
    const { root } = await fixture({
      "review/chi-muc-trang-elite-pro-sau-thu-lai-39.json": {
        lessons: [{ lessonId: "6043", description_status_at_snapshot: "text", observation_source_reference: "courses/elite-pro/raw/x.json" }],
      },
    });
    const priority = await loadPriorityObservations(root);
    expect(priority.get(priorityKey("elite-pro", "6043"))).toMatchObject({
      description_status: "text",
      observation: { source_reference: "courses/elite-pro/raw/x.json" },
    });
  });

  it("đọc thư mục quan sát trang bài, bỏ checkpoint và không lấy loại/thời lượng từ trang", async () => {
    const { root } = await fixture({
      "review/khoa-khac-20261106/chi-tiet-trang/speed-ramping/7001.json": {
        lessonId: "7001",
        url: "https://seankangmvp.com/courses/speed-ramping/chapters/45/lessons/7001",
        type: "unknown",
        description_status: "text",
        duration_display: null,
        observation: { startedAt: "2026-11-06T05:24:27.907Z", finishedAt: "2026-11-06T05:24:30.776Z" },
        limits_and_disclaimers: "Chỉ kiểm tra phần chữ hiển thị.",
        duration_scope_note: "Không mở player.",
      },
      "review/khoa-khac-20261106/chi-tiet-trang/speed-ramping/7002.json": {
        lessonId: "7002",
        url: "https://seankangmvp.com/courses/speed-ramping/chapters/45/lessons/7002",
        type: "video",
        description_status: "unknown",
        observation: { startedAt: "2026-11-06T05:25:00.000Z", finishedAt: "2026-11-06T05:25:02.000Z" },
      },
      "review/khoa-khac-20261106/chi-tiet-trang/speed-ramping/checkpoint.json": {
        lessonId: "7003", url: "https://seankangmvp.com/courses/speed-ramping/chapters/45/lessons/7003",
      },
    });
    const priority = await loadPriorityObservations(root);
    expect(priority.get(priorityKey("speed-ramping", "7001"))).toEqual({
      description_status: "text",
      observation: {
        observed_between: { from: "2026-11-06T05:24:27.907Z", to: "2026-11-06T05:24:30.776Z" },
        source_reference: "review/khoa-khac-20261106/chi-tiet-trang/speed-ramping/7001.json",
        source_limit: "Chỉ kiểm tra phần chữ hiển thị. Không mở player.",
      },
    });
    // Trang bài không đổi loại/thời lượng của danh mục, nên bản ghép không mang hai trường đó.
    expect(priority.get(priorityKey("speed-ramping", "7001"))).not.toHaveProperty("type");
    expect(priority.get(priorityKey("speed-ramping", "7001"))).not.toHaveProperty("duration_display");
    // Trang không thấy chữ vẫn giữ `unknown`, không tự thành mô tả đã đọc hay nâng thành video.
    expect(priority.get(priorityKey("speed-ramping", "7002"))).toEqual({
      description_status: "unknown",
      observation: {
        observed_between: { from: "2026-11-06T05:25:00.000Z", to: "2026-11-06T05:25:02.000Z" },
        source_reference: "review/khoa-khac-20261106/chi-tiet-trang/speed-ramping/7002.json",
      },
    });
    expect(priority.has(priorityKey("speed-ramping", "7003"))).toBe(false);
  });

  it("từ chối tệp quan sát có URL ngoài host hoặc mã bài không khớp", async () => {
    const cases: [string, string, string?, string?][] = [
      ["7001.json", "7001", "https://example.com/courses/speed-ramping/chapters/45/lessons/7001"],
      ["7001.json", "7001", "https://seankangmvp.com/courses/speed-ramping/chapters/45/lessons/7002"],
      ["7001.json", "7001", "https://seankangmvp.com/courses/speed-ramping/chapters/45/lessons/7001?token=x"],
      ["9999.json", "7001", undefined],
      ["7001.json", "7001", undefined, "https://seankangmvp.com/courses/speed-ramping/chapters/45/lessons/7002"],
    ];
    for (const [file, id, url, actualUrl] of cases) {
      const { root } = await fixture({
        [`review/khoa-khac-20261106/chi-tiet-trang/speed-ramping/${file}`]: {
          lessonId: id,
          url: url ?? "https://seankangmvp.com/courses/speed-ramping/chapters/45/lessons/7001",
          ...(actualUrl ? { actualUrl } : {}),
          description_status: "text",
        },
      });
      await expect(loadPriorityObservations(root)).rejects.toThrow();
    }
    // Cùng đường dẫn nhưng có query theo dõi trên URL cuối thì không chặn cả danh mục.
    const ok = await fixture({
      "review/khoa-khac-20261106/chi-tiet-trang/speed-ramping/7001.json": {
        lessonId: "7001",
        url: "https://seankangmvp.com/courses/speed-ramping/chapters/45/lessons/7001",
        actualUrl: "https://seankangmvp.com/courses/speed-ramping/chapters/45/lessons/7001?utm_source=x",
        description_status: "text",
      },
    });
    expect((await loadPriorityObservations(ok.root)).get(priorityKey("speed-ramping", "7001"))).toMatchObject({
      description_status: "text",
    });
  });
});
