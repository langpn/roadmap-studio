import { z } from "zod";
import { bootstrapFirstAdmin, SetupUnavailableError } from "@/lib/auth/bootstrap";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { getAuth, getAuthSecret } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024;

const input = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(10).max(128),
});

const invalid = () => Response.json({ error: "Kiểm tra lại tên, email và mật khẩu." }, { status: 400, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  if (process.env.APP_MODE === "demo") return new Response(null, { status: 404 });
  if (!hasTrustedOrigin(request)) return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) return invalid();
  let text: string;
  try {
    text = await request.text();
  } catch {
    return invalid();
  }
  if (text.length > MAX_BYTES) return invalid();

  let data: z.infer<typeof input>;
  try {
    data = input.parse(JSON.parse(text));
  } catch {
    return invalid();
  }

  try {
    const db = await getDatabase();
    await bootstrapFirstAdmin(db, await getAuth(), await getAuthSecret(), data);
    return Response.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SetupUnavailableError) {
      return Response.json({ error: error.message }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ error: "Chưa thiết lập được tài khoản quản trị. Hãy thử lại." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
