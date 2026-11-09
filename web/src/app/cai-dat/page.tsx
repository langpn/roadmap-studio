import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { getMailer } from "@/lib/mail";
import { CaiDatView } from "./cai-dat-view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Cài đặt & Tài khoản | Đường dựng",
  description: "Quản lý tài khoản cá nhân, phân quyền và thiết lập bảo mật trên Đường dựng.",
};

export default async function CaiDatPage() {
  if (process.env.APP_MODE === "demo") redirect("/demo");
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/dang-nhap");
  }

  const db = await getDatabase();
  const [dbUser] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  const role = dbUser?.role || (session.user as { role?: string }).role || "user";
  const isAdmin = role === "admin";

  return (
    <CaiDatView
      user={{
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
        role,
        isAdmin,
      }}
      mailAvailable={getMailer().configured}
    />
  );
}
