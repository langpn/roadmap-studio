import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getAuth } from "@/lib/auth/server";
import { getDatabase } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { DangNhapForm } from "./dang-nhap-form";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Đăng nhập | Đường dựng",
  description: "Đăng nhập vào lộ trình học dựng video cá nhân hóa Đường dựng.",
};

interface PageProps {
  searchParams?: Promise<{ registered?: string }>;
}

export default async function DangNhapPage(props: PageProps) {
  if (process.env.APP_MODE === "demo") redirect("/demo");
  const accounts = await (await getDatabase()).select({ id: user.id }).from(user).limit(1);
  if (accounts.length === 0) redirect("/thiet-lap");
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) {
    redirect("/");
  }

  const justRegistered = searchParams?.registered === "true";

  return <DangNhapForm justRegistered={justRegistered} />;
}
