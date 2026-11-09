"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Compass, Loader2, Lock, LogIn, Mail } from "lucide-react";
import { authClient } from "@/lib/auth/client";
import styles from "./dang-nhap.module.css";

interface DangNhapFormProps {
  justRegistered?: boolean;
}

export function DangNhapForm({ justRegistered }: DangNhapFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setError(null);
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError("Vui lòng nhập địa chỉ email.");
      return;
    }

    if (!password) {
      setError("Vui lòng nhập mật khẩu.");
      return;
    }

    setLoading(true);
    try {
      const response = await authClient.signIn.email({
        email: trimmedEmail,
        password,
      });

      if (response.error) {
        // Better Auth trả về lỗi xác thực
        const msg = response.error.message || "";
        if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credential") || response.error.status === 401) {
          setError("Địa chỉ email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.");
        } else {
          setError(msg || "Đăng nhập không thành công. Vui lòng thử lại sau.");
        }
        setLoading(false);
        return;
      }

      // Đăng nhập thành công, chuyển hướng về trang chủ lộ trình
      router.push("/");
      router.refresh();
    } catch {
      setError("Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra lại kết nối mạng.");
      setLoading(false);
    }
  };

  return (
    <main className={styles.pageContainer}>
      <div className={styles.authCard}>
        <header className={styles.brandHeader}>
          <div className={styles.brandBadge} aria-hidden="true">
            <Compass size={24} />
          </div>
          <h1 className={styles.brandTitle}>Đường dựng</h1>
          <p className={styles.brandSubtitle}>Lộ trình học dựng video cá nhân hóa</p>
        </header>

        {justRegistered && !error && (
          <aside aria-label="Thông báo tạo tài khoản thành công" className={styles.successBox} role="status">
            <CheckCircle2 aria-hidden="true" className={styles.successIcon} size={18} />
            <div>
              <strong>Tài khoản đã sẵn sàng!</strong> Vui lòng đăng nhập bằng địa chỉ email và mật khẩu bạn vừa thiết lập.
            </div>
          </aside>
        )}

        {error && (
          <aside aria-label="Thông báo lỗi đăng nhập" className={styles.alertBox} role="alert">
            <AlertCircle aria-hidden="true" className={styles.alertIcon} size={18} />
            <div>{error}</div>
          </aside>
        )}

        <form className={styles.form} noValidate onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="login-email">
              Địa chỉ email
            </label>
            <div className={styles.inputWrap}>
              <Mail aria-hidden="true" className={styles.inputIcon} size={16} />
              <input
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                className={`${styles.input} ${error ? styles.inputError : ""}`}
                disabled={loading}
                id="login-email"
                name="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten@vidu.vn"
                required
                spellCheck={false}
                type="email"
                value={email}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="login-password">
              Mật khẩu
            </label>
            <div className={styles.inputWrap}>
              <Lock aria-hidden="true" className={styles.inputIcon} size={16} />
              <input
                autoComplete="current-password"
                className={`${styles.input} ${error ? styles.inputError : ""}`}
                disabled={loading}
                id="login-password"
                name="password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu của bạn"
                required
                type="password"
                value={password}
              />
            </div>
          </div>

          <button
            aria-busy={loading}
            className={styles.submitBtn}
            disabled={loading}
            type="submit"
          >
            {loading ? (
              <>
                <Loader2 aria-hidden="true" className={styles.spinIcon} size={18} />
                <span>Đang đăng nhập...</span>
              </>
            ) : (
              <>
                <LogIn aria-hidden="true" size={18} />
                <span>Đăng nhập</span>
              </>
            )}
          </button>
        </form>

        <p className={styles.footerNotes}><Link className={styles.registerLink} href="/quen-mat-khau">Quên mật khẩu?</Link></p>

        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span>hoặc trải nghiệm thử</span>
          <span className={styles.dividerLine} />
        </div>

        <section aria-label="Chế độ xem trước dữ liệu mẫu" className={styles.demoSection}>
          <p className={styles.demoText}>Khám phá cấu trúc lộ trình và giao diện học tập không cần tài khoản:</p>
          <Link className={styles.demoLink} href="/demo">
            <span>Mở chế độ xem trước (dữ liệu mẫu)</span>
            <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </section>

        <footer className={styles.footerNotes}>
          <p>
            Bạn có liên kết mời tham gia?{" "}
            <Link className={styles.registerLink} href="/dang-ky">
              Đăng ký bằng mã mời
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
