import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadCatalog } from "@/lib/catalog/source";
import { hasPrivateCatalog } from "./private-catalog";

describe("danh mục từ dữ liệu đã kiểm duyệt", () => {
  it.skipIf(!hasPrivateCatalog)("đọc đủ chín khóa và giữ tiêu đề các bài feedback, review", async () => {
    const catalog = await loadCatalog();
    expect(catalog.courses).toHaveLength(9);
    expect(catalog.chapterCount).toBe(53);
    expect(catalog.lessonCount).toBe(1622);
    expect(catalog.courses.map((course) => course.lessonCount)).toEqual([135, 145, 32, 1160, 48, 25, 33, 16, 28]);
    const feedback = catalog.courses.find((course) => course.slug === "elite-pro")!.chapters.find((chapter) => chapter.id === "29")!;
    expect(feedback.lessons).toHaveLength(997);
    expect(feedback.lessons.every((lesson) => !lesson.titleWithheld)).toBe(true);
    const reviews = catalog.courses.find((course) => course.slug === "freelance-mvp")!.chapters.find((chapter) => chapter.id === "26")!;
    expect(reviews.lessons.every((lesson) => !lesson.titleWithheld)).toBe(true);
  });

  it.skipIf(!hasPrivateCatalog)("giữ trạng thái mô tả và thời điểm quan sát thật của nguồn", async () => {
    const catalog = await loadCatalog();
    const byId = new Map(catalog.courses.flatMap((course) => course.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => [lesson.id, lesson] as const))));
    expect(byId.get("5705")?.descriptionStatus).toBe("placeholder");
    expect(byId.get("2860")?.descriptionStatus).toBe("link_only");
    // Nguồn ưu tiên thay `unread` cũ của Elite Pro bằng trạng thái đã quan sát sau đợt đọc lại.
    expect(byId.get("6043")).toMatchObject({ descriptionStatus: "text", type: "unknown", kind: "unknown" });
    expect(byId.get("6043")?.observation?.sourceReference).toBe("courses/elite-pro/raw/lot-0002-0051/0005-lesson-6043.json");
    expect(byId.get("2902")?.observation?.sourceReference).toBe("review/hieu-dinh-tracking-elite-pro-1032-1053.json");
    expect(byId.get("2333")?.observation?.sourceReference).toBe("review/hieu-dinh-tracking-elite-pro-1082.json");
    expect(byId.get("3684")?.observation?.sourceLimit).toContain("worker");
    expect(byId.get("1994")?.observation).toEqual({
      observedAt: null,
      from: "2026-11-05T06:53:24.831Z",
      to: "2026-11-05T06:53:26.227Z",
      sourceReference: "courses/freelance-mvp/checkpoint.json",
    });
    // Khóa bổ sung: quan sát trang bài bổ sung trạng thái chữ, giữ riêng bằng chứng danh mục.
    expect(byId.get("5842")).toMatchObject({
      descriptionStatus: "text",
      // Danh mục ghi `reading`, trang bài chỉ thấy `unknown` và không có iframe: giữ nhãn danh mục.
      type: "reading",
      typeEvidence: "catalog_list",
      // Danh mục và trang bài đều không có nhãn thời lượng cho bài này; không tự suy từ player.
      duration: null,
    });
    expect(byId.get("5842")?.observation).toMatchObject({
      from: "2026-11-06T05:30:39.332Z",
      to: "2026-11-06T05:30:41.540Z",
      sourceReference: "review/khoa-khac-20261106/chi-tiet-trang/speed-ramping/5842.json",
    });
    // Iframe đã thấy không tự nâng loại bài lên mức đã mở trang; nhãn thời lượng của danh mục còn nguyên.
    expect(byId.get("4046")).toMatchObject({ type: "video", typeEvidence: "catalog_list", duration: "13 phút", descriptionStatus: "text" });
    expect(byId.get("3626")?.descriptionStatus).toBe("unknown");
    // Bản mở lại độc lập sau đó thấy chữ ở `/4554`, `/2926` nhưng tệp worker vẫn `unknown`: giữ nguyên,
    // không tự nâng trạng thái từ một lần quan sát khác nguồn.
    for (const id of ["4554", "2926"]) expect(byId.get(id)?.descriptionStatus).toBe("unknown");
    expect(byId.get("2956")).toMatchObject({ type: "reading", typeEvidence: "catalog_list", descriptionStatus: "text" });
    expect(catalog.courses.flatMap((course) => course.chapters.flatMap((chapter) => chapter.lessons))
      .filter((lesson) => ["speed-ramping", "upwork-mvp", "capcut-a-z", "fusion-101", "keyframe-animation"].includes(lesson.courseSlug)
        && lesson.observation)).toHaveLength(150);
    // 684 trạng thái cũ + 133 trang bài ghi `text` = đúng 817 của chỉ mục bằng chứng.
    expect(catalog.courses.flatMap((course) => course.chapters.flatMap((chapter) => chapter.lessons))
      .filter((lesson) => lesson.descriptionStatus === "text")).toHaveLength(817);
  });

  it.skipIf(!hasPrivateCatalog)("tách loại nguồn khỏi mức xác minh cho cả chín khóa", async () => {
    const catalog = await loadCatalog();
    const lessons = catalog.courses.flatMap((course) => course.chapters.flatMap((chapter) => chapter.lessons));
    const count = (pick: (lesson: (typeof lessons)[number]) => string) =>
      lessons.reduce<Record<string, number>>((map, lesson) => ({ ...map, [pick(lesson)]: (map[pick(lesson)] ?? 0) + 1 }), {});

    expect(count((lesson) => `${lesson.type}/${lesson.typeEvidence}`)).toEqual({
      "video/lesson_page": 329,
      "reading/lesson_page": 11,
      "unknown/unknown": 1132,
      // Khóa bổ sung chỉ đọc danh sách chương: giữ loại nguồn nhưng chưa xác minh.
      "video/catalog_list": 148,
      "reading/catalog_list": 2,
    });
    // Elite và Baby: nguồn ưu tiên xác nhận từng trang.
    for (const id of ["5860", "2207"]) expect(lessons.find((lesson) => lesson.id === id)).toMatchObject({ type: "video", typeEvidence: "lesson_page" });
    // Elite Pro: danh mục gốc chỉ có 28 trang bài đã mở.
    expect(lessons.find((lesson) => lesson.id === "3371")).toMatchObject({ type: "reading", typeEvidence: "lesson_page" });
    expect(lessons.find((lesson) => lesson.id === "6043")).toMatchObject({ type: "unknown", typeEvidence: "unknown" });
  });

  it("đọc khóa bổ sung từ manifest mà không sửa bộ nhập", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "roadmap-catalog-test-"));
    const course = (slug: string, id: string) => ({
      course: { name: `Khóa giả ${id}`, url: `https://seankangmvp.com/courses/${slug}` },
      chapters: [{ chapter_id: "1", title: "Chương giả", url: `https://seankangmvp.com/courses/${slug}/chapters/1/lessons`, lessons: [
        { lesson_id: id, name: `Bài giả ${id}`, url: `https://seankangmvp.com/courses/${slug}/chapters/1/lessons/${id}` },
      ] }],
    });
    await writeFile(path.join(root, "first.json"), JSON.stringify(course("first", "10001")));
    await writeFile(path.join(root, "extra.json"), JSON.stringify(course("extra", "10002")));
    await writeFile(path.join(root, "manifest.json"), JSON.stringify([
      { slug: "first", file: "first.json" }, { slug: "extra", file: "extra.json", supplemental: true },
    ]));
    const catalog = await loadCatalog({ root, manifestPath: path.join(root, "manifest.json") });
    expect(catalog.courses.map((course) => course.slug)).toEqual(["first", "extra"]);
    expect(catalog.lessonCount).toBe(2);
  });
});
