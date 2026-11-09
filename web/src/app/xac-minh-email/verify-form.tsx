"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import styles from "../dang-nhap/dang-nhap.module.css";

export function VerifyForm() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (value) {
      // Read and remove the fragment only after the client has hydrated.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToken(value);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  async function verify() {
    setBusy(true);
    try {
      const response = await fetch("/api/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      if (!response.ok) setMessage("Liên kết không hợp lệ hoặc đã hết hạn.");
      else { setDone(true); setToken(""); }
    } catch { setMessage("Chưa thể kết nối. Vui lòng thử lại."); }
    finally { setBusy(false); }
  }
  return <main className={styles.pageContainer}><div className={styles.authCard}>
    <header className={styles.brandHeader}><div className={styles.brandBadge}><Compass size={24} aria-hidden="true" /></div>
      <h1 className={styles.brandTitle}>Xác minh email</h1><p className={styles.brandSubtitle}>Xác nhận địa chỉ email cho tài khoản Đường dựng.</p></header>
    {done ? <p role="status" className={styles.successBox}>Email đã được xác minh.</p> : <>
      {!token && <p className={styles.alertBox}>Không tìm thấy mã xác minh. Hãy mở liên kết trong email.</p>}
      <button className={styles.submitBtn} type="button" disabled={!token || busy} onClick={verify}>{busy ? "Đang xác minh..." : "Xác minh địa chỉ email"}</button>
    </>}
    {message && <p role="alert" className={styles.alertBox}>{message}</p>}
    <footer className={styles.footerNotes}><Link className={styles.registerLink} href="/cai-dat">Quay lại tài khoản</Link></footer>
  </div></main>;
}
