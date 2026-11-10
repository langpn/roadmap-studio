import { createAuth } from "@/lib/auth/config";
import { bootstrapFirstAdmin } from "@/lib/auth/bootstrap";
import { demoCatalog } from "@/lib/catalog/demo";
import { importCatalog, readImportedCatalog } from "@/lib/catalog/import";
import { closeDatabase, getDatabase } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getLessonMedia, importLessonMedia } from "@/lib/media/store";
import { getProgress, recordLessonOpened, setLessonProgress, setPracticeProgress } from "@/lib/progress/store";

// Tiến trình con cho kiểm thử "khởi động lại": mỗi lần chạy là một tiến trình mới
// mở đúng PGLITE_DATA_DIR, nên dữ liệu phải đến từ đĩa chứ không từ bộ nhớ.

// Giá trị giả cố định: chỉ dùng cho database fixture trong thư mục tạm.
const secret = "local-db-fixture-secret-not-a-real-credential";
const email = "restart-owner@example.invalid";
const password = "mat-khau-thu-cuc-bo-1234";
const lessonId = demoCatalog.courses[0].chapters[0].lessons[0].id;

async function main(): Promise<void> {
  const phase = process.argv[2];
  const db = await getDatabase();
  const auth = createAuth(db, { secret, baseURL: "http://127.0.0.1:3001" });

  if (phase === "seed") {
    await bootstrapFirstAdmin(db, auth, secret, { name: "Chủ máy thử", email, password });
    const [owner] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
    await importCatalog(db, demoCatalog);
    await setLessonProgress(db, owner.id, lessonId, "completed", null);
    await recordLessonOpened(db, owner.id, lessonId);
    await setPracticeProgress(db, owner.id, "clip-first", "in_progress", null);
    await importLessonMedia(db, owner.id, {
      version: 1,
      collectedAt: "2026-11-08T10:00:00.000Z",
      entries: [{
        lessonId,
        kind: "bunny",
        videoId: "00000000-0000-4000-8000-000000000001",
        embedUrl: "https://iframe.mediadelivery.net/embed/431650/00000000-0000-4000-8000-000000000001",
      }],
    }, demoCatalog);
    console.log("seed xong");
    return;
  }

  // phase "verify": đọc lại sau khi tiến trình trước đã đóng và thoát.
  const [owner] = await db.select({ id: user.id, role: user.role }).from(user).where(eq(user.email, email));
  const signIn = await auth.api.signInEmail({ body: { email, password } });
  console.log(JSON.stringify({
    ownerRole: owner?.role ?? null,
    signedInId: signIn.user.id,
    catalogLessons: (await readImportedCatalog(db))?.lessonCount ?? 0,
    progress: await getProgress(db, owner.id),
    media: await getLessonMedia(db, owner.id),
  }));
}

main().catch((error: unknown) => {
  console.error(`Lỗi tiến trình con: ${error instanceof Error ? error.message : "không xác định"}`);
  process.exitCode = 1;
}).finally(async () => { await closeDatabase(); });
