import { redirect } from "next/navigation";
import { getMailer } from "@/lib/mail";
import { ResetRequest } from "./reset-request";

export const dynamic = "force-dynamic";

export default function QuenMatKhauPage() {
  if (process.env.APP_MODE === "demo") redirect("/demo");
  return <ResetRequest available={getMailer().configured} />;
}
