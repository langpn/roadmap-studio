import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuth } from "@/lib/auth/server";
import { DangKyForm } from "./dang-ky-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Đăng ký thành viên | Đường dựng",
  description: "Đăng ký tài khoản học tập với mã mời từ quản trị viên.",
};

export default async function DangKyPage() {
  if (process.env.APP_MODE === "demo") redirect("/demo");
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/");
  }

  return <DangKyForm />;
}
