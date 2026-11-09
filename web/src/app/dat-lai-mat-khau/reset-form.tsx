"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import styles from "../dang-nhap/dang-nhap.module.css";

export function ResetForm() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (value) {
      // Only the browser can read the fragment; remove it after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(value);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 10 || password !== confirmation) { setMessage("Mật khẩu phải có ít nhất 10 ký tự và hai lần nhập phải khớp."); return; }
    setBusy(true);
    setMessage("");
    try {
      const result = await authClient.resetPassword({ token, newPassword: password });
      if (result.error) setMessage("Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới.");
      else { setDone(true); setToken(""); setPassword(""); setConfirmation(""); }
    } catch { setMessage("Chưa thể kết nối. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  return <main className={styles.pageContainer}><div className={styles.authCard}>
    <header className={styles.brandHeader}><div className={styles.brandBadge}><Compass size={24} aria-hidden="true" /></div>
      <h1 className={styles.brandTitle}>Đặt lại mật khẩu</h1><p className={styles.brandSubtitle}>Liên kết dùng một lần và có hiệu lực trong một giờ.</p></header>
    {done ? <p role="status" className={styles.successBox}>Mật khẩu đã được đổi. Các phiên cũ đã được đăng xuất.</p> : <form className={styles.form} onSubmit={submit}>
      {!token && <p className={styles.alertBox}>Không tìm thấy mã đặt lại. Hãy mở liên kết trong email hoặc yêu cầu liên kết mới.</p>}
      <div className={styles.fieldGroup}><label className={styles.label} htmlFor="new-password">Mật khẩu mới</label>
        <input className={styles.input} id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} required /></div>
      <div className={styles.fieldGroup}><label className={styles.label} htmlFor="confirm-password">Xác nhận mật khẩu</label>
        <input className={styles.input} id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={10} required /></div>
      <button className={styles.submitBtn} disabled={!token || busy} type="submit">{busy ? "Đang xử lý..." : "Đổi mật khẩu"}</button>
    </form>}
    {message && <p role="alert" className={styles.alertBox}>{message}</p>}
    <footer className={styles.footerNotes}><Link className={styles.registerLink} href={done ? "/dang-nhap" : "/quen-mat-khau"}>{done ? "Đăng nhập" : "Yêu cầu liên kết mới"}</Link></footer>
  </div></main>;
}
