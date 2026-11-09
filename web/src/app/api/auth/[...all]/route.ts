import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth/server";
import { getMailer } from "@/lib/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (process.env.APP_MODE === "demo") return new Response("Không khả dụng trong bản trình diễn.", { status: 404 });
  return toNextJsHandler(await getAuth()).GET(request);
}

export async function POST(request: Request) {
  if (process.env.APP_MODE === "demo") return new Response("Không khả dụng trong bản trình diễn.", { status: 404 });
  const pathname = new URL(request.url).pathname;
  if (["/api/auth/request-password-reset", "/api/auth/send-verification-email"].includes(pathname) && !getMailer().configured) {
    return Response.json({ error: "Dịch vụ email chưa được cấu hình." }, { status: 503 });
  }
  return toNextJsHandler(await getAuth()).POST(request);
}
