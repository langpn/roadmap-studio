import { getAuth } from "@/lib/auth/server";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { getActiveCatalog } from "@/lib/catalog/active";
import { getDatabase } from "@/lib/db";
import { importLessonMedia, getLessonMedia } from "@/lib/media/store";
import { parseLessonMediaMap } from "@/lib/media/lesson-media-map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 512 * 1024;

export async function GET(request: Request) {
  if (process.env.APP_MODE === "demo") return Response.json({ error: "Bản trình diễn không lưu liên kết." }, { status: 404 });
  const session = await (await getAuth()).api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });
  const entries = await getLessonMedia(await getDatabase(), session.user.id);
  return Response.json({ entries }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (process.env.APP_MODE === "demo") return Response.json({ error: "Bản trình diễn không lưu liên kết." }, { status: 404 });
  if (!hasTrustedOrigin(request)) return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  const session = await (await getAuth()).api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Vui lòng đăng nhập lại." }, { status: 401 });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) return Response.json({ error: "Tệp quá lớn. Chỉ nhận tối đa 512 KB." }, { status: 413 });

  let text: string;
  try {
    text = await request.text();
  } catch {
    return Response.json({ error: "Không đọc được nội dung gửi lên." }, { status: 400 });
  }
  if (text.length > MAX_BYTES) return Response.json({ error: "Tệp quá lớn. Chỉ nhận tối đa 512 KB." }, { status: 413 });

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    return Response.json({ error: "Nội dung không phải JSON hợp lệ." }, { status: 400 });
  }

  const parsed = parseLessonMediaMap(parsedJson);
  if (!parsed.ok) return Response.json({ error: parsed.errors.join(" ") }, { status: 400 });

  const catalog = await getActiveCatalog();
  if (catalog.courses.length === 0) {
    return Response.json({ error: "Chưa có danh mục bài học. Hãy nhập danh mục trước khi thêm liên kết phát." }, { status: 409 });
  }

  try {
    const result = await importLessonMedia(await getDatabase(), session.user.id, parsed.map, catalog);
    if (result.imported === 0) {
      return Response.json({
        error: "Không có liên kết nào khớp với bài trong danh mục hiện tại.",
        rejected: result.rejected,
      }, { status: 422 });
    }
    return Response.json({ imported: result.imported, replaced: result.replaced, rejected: result.rejected, skipped: parsed.skipped });
  } catch {
    return Response.json({ error: "Lưu liên kết chưa xong. Hãy thử lại." }, { status: 500 });
  }
}
