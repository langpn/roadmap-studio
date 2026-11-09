import { getAuth } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db";
import { getLessonMediaForLesson } from "@/lib/media/store";
import { parseBunnyEmbedUrl, refererOriginFromBase, resolveBunnyStream } from "@/lib/media/bunny-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lỗi chung, không kèm chi tiết upstream hay mã video. */
function failure(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Trả URL playlist HLS để client phát bằng trình phát riêng.
 *
 * Không nhận URL từ query/body: liên kết nhúng và mã video được đọc từ dữ liệu
 * của chính người đang đăng nhập, rồi kiểm tra lại theo đúng định dạng Bunny.
 * Máy chủ chỉ hỏi trang nhúng chính thức; không tải hay proxy nội dung video.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ lessonId: string }> },
): Promise<Response> {
  if (process.env.APP_MODE === "demo") return failure(404, "Bản trình diễn không phát video trực tiếp.");

  const session = await (await getAuth()).api.getSession({ headers: request.headers });
  if (!session) return failure(401, "Vui lòng đăng nhập lại.");

  const { lessonId: rawLessonId } = await context.params;
  const lessonId = typeof rawLessonId === "string" ? rawLessonId.trim() : "";
  if (!/^\d+$/.test(lessonId)) return failure(404, "Không tìm thấy bài học.");

  let entry;
  try {
    entry = await getLessonMediaForLesson(await getDatabase(), session.user.id, lessonId);
  } catch {
    return failure(500, "Chưa đọc được liên kết phát. Hãy thử lại.");
  }
  if (!entry) return failure(404, "Không tìm thấy liên kết phát cho bài học này.");
  if (entry.kind !== "bunny") return failure(404, "Bài học này không có nguồn phát trực tiếp.");

  // Chỉ tin dữ liệu đã lưu sau khi chuẩn hoá lại: mã video phải khớp URL nhúng.
  const embed = parseBunnyEmbedUrl(entry.embedUrl);
  if (!embed || embed.videoId !== entry.videoId) {
    return failure(422, "Liên kết phát đã lưu không hợp lệ. Hãy thu thập lại.");
  }

  // Referer lấy từ cấu hình của chính ứng dụng, không phải từ request của client.
  const origin = refererOriginFromBase(process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000");
  if (!origin) return failure(500, "Cấu hình địa chỉ ứng dụng chưa hợp lệ.");

  const result = await resolveBunnyStream({
    embedUrl: embed.url,
    videoId: embed.videoId,
    refererOrigin: origin,
  });

  if (!result.ok) {
    if (result.reason === "no-playlist") {
      return failure(422, "Chưa lấy được liên kết phát trực tiếp. Trình phát nhúng sẽ được dùng thay thế.");
    }
    return failure(502, "Không kết nối được nguồn phát. Trình phát nhúng sẽ được dùng thay thế.");
  }

  return Response.json({ url: result.url }, { headers: { "Cache-Control": "no-store" } });
}
