"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Compass,
  Copy,
  KeyRound,
  Loader2,
  LogOut,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { authClient } from "@/lib/auth/client";
import styles from "./cai-dat.module.css";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: string;
  isAdmin: boolean;
}

interface CaiDatViewProps {
  user: UserInfo;
  mailAvailable: boolean;
}

export function CaiDatView({ user, mailAvailable }: CaiDatViewProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [sendingVerification, setSendingVerification] = useState(false);

  const handleVerification = async () => {
    setSendingVerification(true);
    setVerificationMessage(null);
    try {
      const result = await authClient.sendVerificationEmail({ email: user.email, callbackURL: "/cai-dat" });
      setVerificationMessage(result.error ? "Chưa thể xử lý yêu cầu. Hãy thử lại." : "Nếu email cần xác minh, hãy kiểm tra hộp thư để nhận hướng dẫn.");
    } catch { setVerificationMessage("Chưa thể kết nối. Hãy thử lại."); }
    finally { setSendingVerification(false); }
  };

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError(null);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Đăng xuất chưa thành công");
      router.push("/dang-nhap");
      router.refresh();
    } catch {
      setSignOutError("Chưa thể đăng xuất. Hãy kiểm tra kết nối và thử lại.");
    } finally {
      setSigningOut(false);
    }
  };

  const handleCreateInvitation = async () => {
    if (creatingInvite) return;
    setCreatingInvite(true);
    setInviteError(null);
    setInvitationUrl(null);
    setCopied(false);

    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setInviteError(data?.error || "Không thể tạo liên kết mời. Vui lòng thử lại sau.");
        return;
      }

      if (data?.url) {
        // Chỉ gán vào state để hiển thị trên màn hình của chủ máy; không ghi log
        setInvitationUrl(data.url);
      } else {
        setInviteError("Máy chủ không trả về liên kết hợp lệ.");
      }
    } catch {
      setInviteError("Lỗi kết nối khi gửi yêu cầu tạo lời mời.");
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopy = async () => {
    if (!invitationUrl) return;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard fallback nếu bị trình duyệt chặn
    }
  };

  // Ký tự đầu của tên để làm avatar chữ
  const avatarInitial = user.name ? user.name.trim().charAt(0).toUpperCase() : "U";

  return (
    <div className={styles.pageContainer}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <Link className={styles.backLink} href="/">
            <ArrowLeft aria-hidden="true" size={16} />
            <span>Quay lại lộ trình</span>
          </Link>
          <div className={styles.brandWrap}>
            <Compass aria-hidden="true" className={styles.brandIcon} size={18} />
            <span>Đường dựng</span>
          </div>
        </div>
      </header>

      <main className={styles.contentWrapper}>
        <div className={styles.pageHeader}>
          <h1 className={styles.pageTitle}>Cài đặt & Tài khoản</h1>
          <p className={styles.pageSubtitle}>Quản lý thông tin tài khoản, phân quyền và phiên học tập cá nhân.</p>
        </div>

        {/* Thông tin tài khoản */}
        <section aria-labelledby="account-info-heading" className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitleWrap}>
              <User aria-hidden="true" className={styles.cardTitleIcon} size={18} />
              <h2 className={styles.cardTitle} id="account-info-heading">
                Thông tin người dùng
              </h2>
            </div>
            {user.isAdmin ? (
              <span className={styles.roleBadgeAdmin}>
                <ShieldCheck aria-hidden="true" size={13} />
                Quản trị viên
              </span>
            ) : (
              <span className={styles.roleBadgeUser}>
                <User aria-hidden="true" size={13} />
                Học viên
              </span>
            )}
          </div>

          <div className={styles.profileRow}>
            <div aria-hidden="true" className={styles.avatar}>
              {avatarInitial}
            </div>
            <div className={styles.profileInfo}>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userEmail}>{user.email}</div>
            </div>
          </div>

          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Xác minh email</span>
              <span className={styles.infoValue}>{user.emailVerified ? "Đã xác minh" : "Chưa xác minh"}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Mã định danh tài khoản</span>
              <span className={styles.infoValue}>{user.id}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Bảo vệ tiến độ học tập</span>
              <span className={styles.infoValue}>
                Tiến độ khóa học và bài thực hành được lưu riêng biệt theo tài khoản của bạn, không chia sẻ với nguồn ngoài hay bên thứ ba.
              </span>
            </div>
          </div>

          <div className={styles.cardActions}>
            {!user.emailVerified && mailAvailable && <button className={styles.createInviteBtn} type="button" disabled={sendingVerification} onClick={handleVerification}>
              {sendingVerification ? "Đang xử lý..." : "Gửi yêu cầu xác minh email"}
            </button>}
            <button
              aria-busy={signingOut}
              className={styles.signOutBtn}
              disabled={signingOut}
              onClick={handleSignOut}
              type="button"
            >
              <LogOut aria-hidden="true" size={16} />
              <span>{signingOut ? "Đang đăng xuất..." : "Đăng xuất tài khoản"}</span>
            </button>
          </div>
          {signOutError && <p role="alert" className={styles.alertBox}>{signOutError}</p>}
          {!user.emailVerified && !mailAvailable && <p role="status">Dịch vụ email chưa được cấu hình; chưa thể gửi thư xác minh.</p>}
          {verificationMessage && <p role="status">{verificationMessage}</p>}
        </section>

        {/* Khu vực quản trị viên */}
        {user.isAdmin && (
          <section aria-labelledby="admin-actions-heading" className={`${styles.card} ${styles.adminCard}`}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitleWrap}>
                <ShieldCheck aria-hidden="true" className={styles.cardTitleIcon} size={18} />
                <h2 className={styles.cardTitle} id="admin-actions-heading">
                  Quản trị viên · Tạo lời mời thành viên
                </h2>
              </div>
            </div>

            <p className={styles.adminDesc}>
              Đường dựng vận hành theo cơ chế mời nội bộ. Bạn có thể tạo liên kết mời dùng một lần cho thành viên mới để họ thiết lập tài khoản và theo dõi tiến độ riêng.
            </p>

            <button
              aria-busy={creatingInvite}
              className={styles.createInviteBtn}
              disabled={creatingInvite}
              onClick={handleCreateInvitation}
              type="button"
            >
              {creatingInvite ? (
                <>
                  <Loader2 aria-hidden="true" className={styles.spinIcon} size={16} />
                  <span>Đang khởi tạo liên kết...</span>
                </>
              ) : (
                <>
                  <UserPlus aria-hidden="true" size={16} />
                  <span>Tạo liên kết mời mới</span>
                </>
              )}
            </button>

            {inviteError && (
              <aside aria-label="Lỗi tạo liên kết mời" className={styles.alertBox} role="alert">
                <AlertCircle aria-hidden="true" className={styles.alertIcon} size={18} />
                <div>{inviteError}</div>
              </aside>
            )}

            {invitationUrl && (
              <div aria-label="Chi tiết liên kết mời vừa tạo" className={styles.inviteResultBox} role="region">
                <div className={styles.inviteResultHeader}>
                  <div className={styles.inviteResultTitle}>
                    <KeyRound aria-hidden="true" size={16} />
                    <span>Liên kết mời đăng ký mới</span>
                  </div>
                  <button
                    aria-label="Ẩn liên kết mời"
                    className={styles.closeResultBtn}
                    onClick={() => setInvitationUrl(null)}
                    type="button"
                  >
                    <X aria-hidden="true" size={16} />
                  </button>
                </div>

                <div className={styles.urlBox}>
                  <input
                    aria-label="Địa chỉ liên kết mời"
                    className={styles.urlInput}
                    readOnly
                    type="text"
                    value={invitationUrl}
                  />
                  <button
                    className={`${styles.copyBtn} ${copied ? styles.copyBtnSuccess : ""}`}
                    onClick={handleCopy}
                    type="button"
                  >
                    {copied ? (
                      <>
                        <Check aria-hidden="true" size={16} />
                        <span>Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy aria-hidden="true" size={16} />
                        <span>Sao chép liên kết</span>
                      </>
                    )}
                  </button>
                </div>

                <ul className={styles.inviteNoticeList}>
                  <li>
                    <strong>Thời hạn:</strong> Hết hạn sau 24 giờ kể từ thời điểm tạo.
                  </li>
                  <li>
                    <strong>Giới hạn:</strong> Dùng được đúng 01 lần duy nhất cho một tài khoản mới.
                  </li>
                  <li>
                    <strong>Bảo mật:</strong> Gửi trực tiếp cho người nhận qua kênh tin nhắn riêng, không chia sẻ công khai.
                  </li>
                </ul>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
