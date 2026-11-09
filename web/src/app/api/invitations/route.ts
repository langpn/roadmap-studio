import { getAuth } from "@/lib/auth/server";
import { hasTrustedOrigin } from "@/lib/auth/origin";
import { createInvitation } from "@/lib/auth/invitations";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.APP_MODE === "demo") return new Response(null, { status: 404 });
  if (!hasTrustedOrigin(request)) return new Response(null, { status: 403 });
  const session = await (await getAuth()).api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  try {
    const token = await createInvitation(await getDatabase(), session.user.id);
    const base = process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000";
    return Response.json({ url: `${new URL(base).origin}/dang-ky#invite=${encodeURIComponent(token)}` }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Chỉ người quản trị có thể tạo lời mời." }, { status: 403 });
  }
}
