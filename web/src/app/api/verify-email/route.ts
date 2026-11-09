import { z } from "zod";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { getAuth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.APP_MODE === "demo") return new Response(null, { status: 404 });
  if (!hasTrustedOrigin(request)) return new Response(null, { status: 403 });
  let token: string;
  try { token = z.object({ token: z.string().min(1).max(4096) }).parse(await request.json()).token; }
  catch { return Response.json({ error: "Liên kết không hợp lệ." }, { status: 400 }); }
  try {
    await (await getAuth()).api.verifyEmail({ query: { token }, headers: request.headers });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Liên kết không hợp lệ hoặc đã hết hạn." }, { status: 400 });
  }
}
