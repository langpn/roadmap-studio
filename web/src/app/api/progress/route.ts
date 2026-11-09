import { z } from "zod";
import { getAuth } from "@/lib/auth/server";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { getActiveCatalog } from "@/lib/catalog/active";
import { getDatabase } from "@/lib/db";
import { getProgress, recordLessonOpened, setLessonProgress, setPracticeProgress } from "@/lib/progress/store";
import { PRACTICE_IDS } from "@/lib/progress/practice-ids";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const expectedVersion = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{6}$/).nullable().optional();
const input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lesson"), id: z.string().regex(/^\d+$/), state: z.enum(["not_updated", "in_progress", "completed"]), expectedVersion }),
  z.object({ kind: z.literal("practice"), id: z.enum(PRACTICE_IDS), state: z.enum(["not_updated", "in_progress", "completed"]), expectedVersion }),
  z.object({ kind: z.literal("opened"), id: z.string().regex(/^\d+$/) }),
]);

export async function GET(request: Request) {
  if (process.env.APP_MODE === "demo") return new Response(null, { status: 404 });
  const session = await (await getAuth()).api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const progress = await getProgress(await getDatabase(), session.user.id);
  return Response.json(progress, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (process.env.APP_MODE === "demo") return Response.json({ error: "Bản trình diễn lưu riêng trên trình duyệt." }, { status: 404 });
  if (!hasTrustedOrigin(request)) return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  if (request.headers.get("x-roadmap-account") !== session.user.id) {
    return Response.json({ code: "ACCOUNT_CHANGED", error: "Tài khoản đã thay đổi. Hãy tải lại trang." }, { status: 409 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 }); }
  const parsed = input.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  const action = parsed.data;
  if (action.kind !== "opened" && action.expectedVersion === undefined) {
    return Response.json({ code: "CLIENT_OUTDATED", error: "Trang này đã cũ. Hãy tải lại trang trước khi cập nhật tiến độ." }, { status: 409 });
  }
  if (action.kind !== "practice") {
    const catalog = await getActiveCatalog();
    if (!catalog.courses.some((course) => course.chapters.some((chapter) => chapter.lessons.some((lesson) => lesson.id === action.id)))) {
      return Response.json({ error: "Không tìm thấy bài học." }, { status: 404 });
    }
  }
  try {
    const db = await getDatabase();
    if (action.kind === "opened") {
      const lesson = await recordLessonOpened(db, session.user.id, action.id);
      return Response.json({ ok: true, lesson });
    }
    const version = action.kind === "lesson"
      ? await setLessonProgress(db, session.user.id, action.id, action.state, action.expectedVersion!)
      : await setPracticeProgress(db, session.user.id, action.id, action.state, action.expectedVersion!);
    if (version === null) {
      const progress = await getProgress(db, session.user.id);
      const states = action.kind === "lesson" ? progress.lessons : progress.practices;
      const versions = action.kind === "lesson" ? progress.versions!.lessons : progress.versions!.practices;
      return Response.json({
        code: "PROGRESS_CONFLICT",
        error: "Tiến độ đã thay đổi ở nơi khác. Hãy xem lại trạng thái đã lưu trước khi cập nhật.",
        current: versions[action.id] ? { state: states[action.id], version: versions[action.id] } : null,
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ ok: true, version });
  } catch {
    return Response.json({ error: "Chưa lưu được tiến độ. Hãy thử lại." }, { status: 500 });
  }
}
