import { z } from "zod";
import { claimInvitation, releaseInvitation } from "@/lib/auth/invitations";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { getAuth, getAuthSecret } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(254),
  password: z.string().min(10).max(128),
  invitation: z.string().min(32).max(128),
});

export async function POST(request: Request) {
  if (process.env.APP_MODE === "demo") return new Response(null, { status: 404 });
  if (!hasTrustedOrigin(request)) return new Response(null, { status: 403 });
  let data: z.infer<typeof input>;
  try { data = input.parse(await request.json()); } catch { return Response.json({ error: "Kiểm tra lại thông tin đăng ký." }, { status: 400 }); }
  const db = await getDatabase();
  const claimedAt = await claimInvitation(db, data.invitation);
  if (!claimedAt) return Response.json({ error: "Lời mời không hợp lệ, đã dùng hoặc hết hạn." }, { status: 400 });
  try {
    const auth = await getAuth();
    const headers = new Headers({ "x-roadmap-internal": await getAuthSecret() });
    await auth.api.signUpEmail({ headers, body: { name: data.name, email: data.email, password: data.password } });
    return Response.json({ ok: true });
  } catch {
    await releaseInvitation(db, data.invitation, claimedAt);
    return Response.json({ error: "Chưa tạo được tài khoản. Kiểm tra thông tin và thử lại." }, { status: 400 });
  }
}
