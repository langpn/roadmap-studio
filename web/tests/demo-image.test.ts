import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasPrivateCatalog, readRealLessons } from "./real-catalog";

// Output Next.js mà Dockerfile copy vào image chạy. Chỉ kiểm tra sau `pnpm build`;
// chưa build thì bỏ qua thay vì báo sai.
const distDir = path.resolve(process.cwd(), process.env.ROADMAP_BUILD_DIR ?? ".next");
const demoManifest = path.join(distDir, "server/app/demo/page.js.nft.json");
const demoClientManifest = path.join(distDir, "server/app/demo/page_client-reference-manifest.js");

// Tên bài ngắn dễ trùng câu tiếng Việt thường, nên chỉ so từ 12 ký tự.
const MIN_TITLE = 12;
const MIN_DESCRIPTION = 30;

/** Tệp server mà route /demo thật sự tải, theo dấu vết build của Next.js. */
function demoServerFiles(): string[] {
  const manifest = JSON.parse(readFileSync(demoManifest, "utf8")) as { files: string[] };
  return manifest.files
    .map((file) => path.normalize(path.join(path.dirname(demoManifest), file)))
    .filter((file) => existsSync(file) && statSync(file).isFile());
}

/** Chunk JS mà trình duyệt tải khi mở /demo. */
function demoClientFiles(): string[] {
  const manifest = readFileSync(demoClientManifest, "utf8");
  const chunks = new Set(manifest.match(/\/_next\/static\/chunks\/[^"']+\.js/g) ?? []);
  return [...chunks]
    .map((chunk) => path.join(distDir, "static", chunk.replace("/_next/static/", "")))
    .filter((file) => existsSync(file));
}

function findLeaks(files: string[], needles: string[]): string[] {
  const leaks: string[] = [];
  for (const file of files) {
    const content = readFileSync(file, "utf8");
    for (const needle of needles) {
      if (content.includes(needle)) leaks.push(`${path.relative(distDir, file)}: ${needle.slice(0, 60)}`);
    }
  }
  return leaks;
}

const describeImage = describe.skipIf(!hasPrivateCatalog || !existsSync(demoManifest));

describeImage("image demo không chứa dữ liệu bài học thật", () => {
  it("bundle /demo tải không có tên, mô tả hay URL bài thật", () => {
    const lessons = readRealLessons();
    const needles = [
      ...lessons.map((lesson) => lesson.name).filter((name) => name.length >= MIN_TITLE),
      ...lessons.map((lesson) => lesson.description).filter((text) => text.length >= MIN_DESCRIPTION),
      ...lessons.map((lesson) => lesson.url).filter(Boolean),
    ];
    expect(findLeaks([...demoServerFiles(), ...demoClientFiles()], needles)).toEqual([]);
  });

  it("asset công khai của demo không chứa đường dẫn khóa học thật", () => {
    const player = path.resolve(process.cwd(), "public/demo/player-sample.mp4");
    const assets = demoServerFiles().map((file) => readFileSync(file, "latin1"));
    if (existsSync(player)) assets.push(readFileSync(player).toString("latin1"));
    for (const content of assets) expect(content).not.toContain("seankangmvp.com/courses/");
  });

  it("bộ kiểm tra nhận ra dữ liệu thật khi nó thật sự có mặt", () => {
    // Đối chứng: cùng bộ lọc phải bắt được tệp nguồn thật, nếu không test trên là vô nghĩa.
    const source = path.resolve(process.cwd(), "..", "courses/elite/danh-muc.json");
    const needles = readRealLessons().map((lesson) => lesson.name).filter((name) => name.length >= MIN_TITLE);
    expect(findLeaks([source], needles).length).toBeGreaterThan(0);
  });
});
