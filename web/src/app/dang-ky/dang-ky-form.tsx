"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Compass,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  User,
  UserPlus,
} from "lucide-react";
import { authClient } from "@/lib/auth/client";
import styles from "./dang-ky.module.css";

interface DangKyFormProps {
  initialInvite?: string;
}

export function DangKyForm({ initialInvite = "" }: DangKyFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [invitation, setInvitation] = useState(initialInvite);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [hasInviteFromUrl, setHasInviteFromUrl] = useState(Boolean(initialInvite.trim()));
  const isInviteMissing = !invitation.trim();

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("invite");
    if (token) {
      // Fragment chỉ có trên trình duyệt; đồng bộ một lần sau hydration rồi xóa khỏi thanh địa chỉ.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInvitation(token);
      setHasInviteFromUrl(true);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

    setError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedInvite = invitation.trim();

    if (!trimmedName) {
      setError("Vui lòng nhập họ và tên của bạn.");
      return;
    }

    if (!trimmedEmail) {
      setError("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }

    if (!trimmedInvite) {
      setError("Cần có mã lời mời từ quản trị viên để tạo tài khoản.");
      return;
    }

    if (password.length < 10) {
      setError("Mật khẩu phải có độ dài tối thiểu 10 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password,
          invitation: trimmedInvite,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error || "Không thể tạo tài khoản. Vui lòng kiểm tra lại mã mời và thông tin.");
        setLoading(false);
        return;
      }

      // Đăng ký thành công, tự động đăng nhập với Better Auth
      const signInResult = await authClient.signIn.email({
        email: trimmedEmail,
        password,
      });

      if (signInResult.error) {
        // Nếu tự động đăng nhập gặp sự cố, điều hướng về màn đăng nhập kèm thông báo
        router.push("/dang-nhap?registered=true");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau giây lát.");
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
          <h1 className={styles.brandTitle}>Tạo tài khoản học tập</h1>
          <p className={styles.brandSubtitle}>Đường dựng · Lộ trình học dựng video cá nhân hóa</p>
        </header>

        {isInviteMissing && (
          <aside aria-label="Cảnh báo thiếu mã mời" className={styles.warningBox} role="alert">
            <AlertTriangle aria-hidden="true" className={styles.warningIcon} size={20} />
            <div className={styles.warningText}>
              <strong>Yêu cầu mã mời thành viên</strong>
              Hệ thống hoạt động theo chế độ riêng tư và chỉ tiếp nhận người học qua lời mời từ quản trị viên. Nếu bạn đã có mã riêng, hãy nhập vào ô bên dưới.
            </div>
          </aside>
        )}

        {error && (
          <aside aria-label="Thông báo lỗi đăng ký" className={styles.alertBox} role="alert">
            <AlertCircle aria-hidden="true" className={styles.alertIcon} size={18} />
            <div>{error}</div>
          </aside>
        )}

        <form className={styles.form} noValidate onSubmit={handleSubmit}>
          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="register-name">
              Họ và tên
            </label>
            <div className={styles.inputWrap}>
              <User aria-hidden="true" className={styles.inputIcon} size={16} />
              <input
                autoComplete="name"
                className={styles.input}
                disabled={loading}
                id="register-name"
                maxLength={100}
                name="name"
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn A"
                required
                type="text"
                value={name}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="register-email">
              Địa chỉ email
            </label>
            <div className={styles.inputWrap}>
              <Mail aria-hidden="true" className={styles.inputIcon} size={16} />
              <input
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                className={styles.input}
                disabled={loading}
                id="register-email"
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
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="register-password">
                Mật khẩu
              </label>
              <span className={styles.fieldHint}>Tối thiểu 10 ký tự</span>
            </div>
            <div className={styles.inputWrap}>
              <Lock aria-hidden="true" className={styles.inputIcon} size={16} />
              <input
                autoComplete="new-password"
                className={styles.input}
                disabled={loading}
                id="register-password"
                minLength={10}
                name="password"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập ít nhất 10 ký tự"
                required
                type="password"
                value={password}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label} htmlFor="register-confirm-password">
              Xác nhận mật khẩu
            </label>
            <div className={styles.inputWrap}>
              <Lock aria-hidden="true" className={styles.inputIcon} size={16} />
              <input
                autoComplete="new-password"
                className={styles.input}
                disabled={loading}
                id="register-confirm-password"
                minLength={10}
                name="confirmPassword"
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu để xác nhận"
                required
                type="password"
                value={confirmPassword}
              />
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="register-invitation">
                Mã lời mời
              </label>
              {hasInviteFromUrl && (
                <span className={styles.validBadge}>
                  <Check aria-hidden="true" size={12} />
                  <span>Đã nhận từ liên kết</span>
                </span>
              )}
            </div>
            <div className={styles.inputWrap}>
              <KeyRound aria-hidden="true" className={styles.inputIcon} size={16} />
              <input
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect="off"
                className={`${styles.input} ${styles.tokenInput}`}
                disabled={loading}
                id="register-invitation"
                name="invitation"
                onChange={(e) => setInvitation(e.target.value)}
                placeholder="Dán mã mời từ quản trị viên"
                required
                spellCheck={false}
                type="text"
                value={invitation}
              />
            </div>
          </div>

          <button
            aria-busy={loading}
            className={styles.submitBtn}
            disabled={loading || isInviteMissing}
            type="submit"
          >
            {loading ? (
              <>
                <Loader2 aria-hidden="true" className={styles.spinIcon} size={18} />
                <span>Đang xử lý đăng ký...</span>
              </>
            ) : (
              <>
                <UserPlus aria-hidden="true" size={18} />
                <span>Hoàn tất đăng ký & Bắt đầu</span>
              </>
            )}
          </button>
        </form>

        <footer className={styles.footerNotes}>
          <p>
            Đã có tài khoản?{" "}
            <Link className={styles.link} href="/dang-nhap">
              Đăng nhập ngay
            </Link>
          </p>
          <p>
            Hoặc xem trước trải nghiệm tại{" "}
            <Link className={styles.link} href="/demo">
              Chế độ xem trước (dữ liệu mẫu)
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}
