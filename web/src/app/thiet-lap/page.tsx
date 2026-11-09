import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getDatabase } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { ThietLapForm } from "./thiet-lap-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Tạo tài khoản quản trị | Đường dựng",
  description: "Thiết lập tài khoản quản trị đầu tiên cho website Đường dựng.",
};

export default async function ThietLapPage() {
  if (process.env.APP_MODE === "demo") redirect("/demo");

  // Chỉ chuyển hướng sau khi biết chắc đã có tài khoản, tránh vòng lặp với /dang-nhap.
  const existing = await (await getDatabase()).select({ id: user.id }).from(user).limit(1);
  if (existing.length > 0) redirect("/dang-nhap");

  return <ThietLapForm />;
}
