import { redirect } from "next/navigation";
import { VerifyForm } from "./verify-form";

export const dynamic = "force-dynamic";

export default function XacMinhEmailPage() {
  if (process.env.APP_MODE === "demo") redirect("/demo");
  return <VerifyForm />;
}
