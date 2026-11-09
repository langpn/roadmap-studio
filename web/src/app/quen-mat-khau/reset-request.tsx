"use client";

import { useState } from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import styles from "../dang-nhap/dang-nhap.module.css";

export function ResetRequest({ available }: { available: boolean }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/dat-lai-mat-khau" });
      setMessage(result.error ? "Chưa thể xử lý yêu cầu. Vui lòng thử lại." : "Nếu địa chỉ có trong hệ thống, hãy kiểm tra email để nhận hướng dẫn.");
    } catch { setMessage("Chưa thể kết nối. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  return <main className={styles.pageContainer}><div className={styles.authCard}>
    <header className={styles.brandHeader}><div className={styles.brandBadge}><Compass size={24} aria-hidden="true" /></div>
      <h1 className={styles.brandTitle}>Quên mật khẩu</h1><p className={styles.brandSubtitle}>Nhận liên kết đặt lại mật khẩu qua email.</p></header>
    {!available ? <p role="status" className={styles.alertBox}>Email chưa được cấu hình. Hãy liên hệ người quản trị để được hỗ trợ.</p> :
      <form className={styles.form} onSubmit={submit}><div className={styles.fieldGroup}>
        <label className={styles.label} htmlFor="reset-email">Địa chỉ email</label>
        <input className={styles.input} id="reset-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </div><button className={styles.submitBtn} type="submit" disabled={busy}>{busy ? "Đang xử lý..." : "Yêu cầu liên kết đặt lại"}</button></form>}
    {message && <p role="status" className={styles.successBox}>{message}</p>}
    <footer className={styles.footerNotes}><Link className={styles.registerLink} href="/dang-nhap">Quay lại đăng nhập</Link></footer>
  </div></main>;
}
