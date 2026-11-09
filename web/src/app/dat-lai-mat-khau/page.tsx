import { redirect } from "next/navigation";
import { ResetForm } from "./reset-form";

export const dynamic = "force-dynamic";

export default function DatLaiMatKhauPage() {
  if (process.env.APP_MODE === "demo") redirect("/demo");
  return <ResetForm />;
}
