import { getDatabase, closeDatabase } from "../src/lib/db";
import { importCatalog, previewCatalogChanges, readImportedCatalog } from "../src/lib/catalog/import";
import { loadCatalog } from "../src/lib/catalog/source";

async function main() {
  const db = await getDatabase();
  const current = await readImportedCatalog(db);
  const next = await loadCatalog();
  const diff = previewCatalogChanges(current, next);
  console.log(`Danh mục: ${next.courses.length} khóa, ${next.chapterCount} chương, ${next.lessonCount} bài.`);
  console.log(`So với bản đang lưu: thêm ${diff.added}, thay đổi ${diff.changed}, vắng ${diff.removed} bài.`);
  if (!process.argv.includes("--apply")) {
    console.log("Chưa nhập dữ liệu. Dùng --apply sau khi đã xem chênh lệch.");
    return;
  }
  await importCatalog(db, next);
  console.log("Đã lưu ảnh chụp danh mục; tiến độ hiện có được giữ theo mã bài.");
}

main().catch((error: unknown) => {
  console.error(`Không thể nhập danh mục: ${error instanceof Error ? error.message : "lỗi không xác định"}`);
  process.exitCode = 1;
}).finally(async () => { await closeDatabase(); });
