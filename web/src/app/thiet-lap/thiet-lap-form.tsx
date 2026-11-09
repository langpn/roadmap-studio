"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Compass,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from "lucide-react";
import { authClient } from "@/lib/auth/client";
import styles from "./thiet-lap.module.css";

export type SetupField = "name" | "email" | "password" | "confirmPassword";

export interface SetupValues {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface SetupFieldError {
  field: SetupField;
  message: string;
}

export type SetupOutcome =
  | { kind: "signed-in" }
  | { kind: "created"; message: string }
  | { kind: "conflict"; message: string }
  | { kind: "unconfirmed"; message: string }
  | { kind: "error"; message: string; field?: SetupField };

export interface SetupDeps {
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response>;
  signIn: (credentials: { email: string; password: string }) => Promise<{ error?: unknown } | null | undefined>;
  onSignedIn: () => void;
}

const MESSAGES = {
  conflict: "Website đã có tài khoản hoặc đang được thiết lập. Hãy thử đăng nhập hoặc tải lại trang sau ít phút.",
  created: "Tài khoản quản trị đã được tạo. Hãy đăng nhập bằng địa chỉ email và mật khẩu bạn vừa thiết lập.",
  unconfirmed:
    "Có thể tài khoản quản trị đã được tạo nhưng chưa xác nhận được do kết nối bị gián đoạn. Hãy thử đăng nhập trước; nếu chưa có tài khoản, tải lại trang để thiết lập lại.",
  invalid: "Không tạo được tài khoản. Vui lòng kiểm tra lại thông tin và thử lại.",
  failed: "Chưa tạo được tài khoản. Vui lòng thử lại sau giây lát.",
} as const;

/** Kiểm tra phía trình duyệt trước khi gửi; máy chủ vẫn kiểm tra lại toàn bộ. */
export function validateSetup(values: SetupValues): SetupFieldError | null {
  const name = values.name.trim();
  const email = values.email.trim();

  if (!name) return { field: "name", message: "Vui lòng nhập tên hiển thị của bạn." };
  if (name.length > 100) return { field: "name", message: "Tên hiển thị tối đa 100 ký tự." };
  if (!email) return { field: "email", message: "Vui lòng nhập địa chỉ email." };
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { field: "email", message: "Địa chỉ email chưa đúng định dạng." };
  }
  if (values.password.length < 10) return { field: "password", message: "Mật khẩu phải có ít nhất 10 ký tự." };
  if (values.password.length > 128) return { field: "password", message: "Mật khẩu tối đa 128 ký tự." };
  if (values.confirmPassword !== values.password) {
    return { field: "confirmPassword", message: "Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại." };
  }
  return null;
}

/**
 * Gửi yêu cầu tạo quản trị viên đầu tiên rồi đăng nhập.
 * Không đọc nội dung phản hồi lỗi để tránh lặp lại mật khẩu ở giao diện.
 */
export async function submitSetup(values: SetupValues, deps: SetupDeps): Promise<SetupOutcome> {
  const invalid = validateSetup(values);
  if (invalid) return { kind: "error", message: invalid.message, field: invalid.field };

  const email = values.email.trim();
  let response: Response;
  try {
    response = await deps.fetchImpl("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name.trim(),
        email,
        password: values.password,
      }),
    });
  } catch {
    // Mất kết nối: không gửi lại để tránh tạo trùng.
    return { kind: "unconfirmed", message: MESSAGES.unconfirmed };
  }

  if (response.status === 409) return { kind: "conflict", message: MESSAGES.conflict };
  if (response.status === 400) return { kind: "error", message: MESSAGES.invalid };
  if (response.status !== 201) return { kind: "error", message: MESSAGES.failed };

  try {
    const signedIn = await deps.signIn({ email, password: values.password });
    if (!signedIn?.error) {
      deps.onSignedIn();
      return { kind: "signed-in" };
    }
  } catch {
    // Tài khoản đã tạo; chỉ cần hướng người dùng sang trang đăng nhập.
  }

  return { kind: "created", message: MESSAGES.created };
}

type LockedOutcome = Extract<SetupOutcome, { kind: "created" | "conflict" | "unconfirmed" }>;

function LockedNotice({ outcome }: { outcome: LockedOutcome }) {
  const isSuccess = outcome.kind === "created";
  const isConflict = outcome.kind === "conflict";
  const Icon = isSuccess ? CheckCircle2 : isConflict ? AlertCircle : AlertTriangle;
  return (
    <section
      aria-label={isSuccess ? "Thông báo đã tạo tài khoản" : "Thông báo không thể thiết lập"}
      className={`${styles.noticeBox} ${isSuccess ? styles.noticeSuccess : styles.noticeWarning}`}
      role={isConflict ? "alert" : "status"}
    >
      <Icon aria-hidden="true" className={styles.noticeIcon} size={20} />
      <div className={styles.noticeContent}>
        <p className={styles.noticeText}>{outcome.message}</p>
        <Link className={styles.noticeLink} href="/dang-nhap">
          Đi đến trang đăng nhập
        </Link>
      </div>
    </section>
  );
}

export function ThietLapForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SetupFieldError | { message: string } | null>(null);
  const [locked, setLocked] = useState<LockedOutcome | null>(null);

  const submitting = useRef(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const errorField = error && "field" in error ? error.field : undefined;

  const fieldRefs: Record<SetupField, React.RefObject<HTMLInputElement | null>> = {
    name: nameRef,
    email: emailRef,
    password: passwordRef,
    confirmPassword: confirmRef,
  };

  useEffect(() => {
    if (!error) return;
    if ("field" in error) fieldRefs[error.field].current?.focus();
    else alertRef.current?.focus();
    // fieldRefs chỉ chứa ref ổn định của các ô nhập.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || loading || locked) return;

    submitting.current = true;
    setError(null);
    setLoading(true);
    const outcome = await submitSetup(
      { name, email, password, confirmPassword },
      {
        fetchImpl: (input, init) => fetch(input, init),
        signIn: (credentials) => authClient.signIn.email(credentials),
        onSignedIn: () => {
          router.push("/");
          router.refresh();
        },
      },
    );

    if (outcome.kind === "signed-in") {
      // Đã tạo tài khoản: giữ nút khóa trong lúc điều hướng để không thể gửi lần hai.
      return;
    }

    submitting.current = false;
    setLoading(false);
    if (outcome.kind === "error") {
      setError(outcome.field ? { field: outcome.field, message: outcome.message } : { message: outcome.message });
      return;
    }

    setLocked(outcome);
  };

  const describedBy = (field: SetupField) => {
    if (field === "password") {
      return errorField === field ? "setup-error-password setup-password-hint" : "setup-password-hint";
    }
    return errorField === field ? `setup-error-${field}` : undefined;
  };

  return (
    <main className={styles.pageContainer}>
      <div className={styles.authCard}>
        <header className={styles.brandHeader}>
          <div aria-hidden="true" className={styles.brandBadge}>
            <Compass size={24} />
          </div>
          <h1 className={styles.brandTitle}>Tạo tài khoản quản trị</h1>
          <p className={styles.brandSubtitle}>
            Đường dựng · Thiết lập lần đầu cho website cá nhân của bạn
          </p>
        </header>

        <aside aria-label="Hướng dẫn thiết lập lần đầu" className={styles.introBox}>
          <ShieldCheck aria-hidden="true" className={styles.introIcon} size={18} />
          <p className={styles.introText}>
            Chỉ hiển thị khi website chưa có tài khoản. Tài khoản này có toàn quyền quản trị và
            được dùng để đăng nhập ở các lần sau.
          </p>
        </aside>

        {locked ? (
          <>
            <LockedNotice outcome={locked} />
            <footer className={styles.footerNotes}>
              <p>Không nhập lại thông tin để tránh tạo tài khoản thứ hai.</p>
            </footer>
          </>
        ) : (
          <>
            {error && !("field" in error) ? (
              <div
                aria-live="assertive"
                className={styles.alertBox}
                id="setup-error"
                ref={alertRef}
                role="alert"
                tabIndex={-1}
              >
                <AlertCircle aria-hidden="true" className={styles.alertIcon} size={18} />
                <div>{error.message}</div>
              </div>
            ) : null}

            <form className={styles.form} noValidate onSubmit={handleSubmit}>
              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="setup-name">
                  Tên hiển thị
                </label>
                <div className={styles.inputWrap}>
                  <User aria-hidden="true" className={styles.inputIcon} size={16} />
                  <input
                    aria-describedby={describedBy("name")}
                    aria-invalid={errorField === "name" ? true : undefined}
                    autoComplete="name"
                    autoFocus
                    className={`${styles.input} ${errorField === "name" ? styles.inputError : ""}`}
                    disabled={loading}
                    id="setup-name"
                    maxLength={100}
                    name="name"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ví dụ: Nguyễn Văn A"
                    ref={nameRef}
                    required
                    type="text"
                    value={name}
                  />
                </div>
                {errorField === "name" ? (
                  <p className={styles.fieldError} id="setup-error-name" role="alert">{error?.message}</p>
                ) : null}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="setup-email">
                  Địa chỉ email
                </label>
                <div className={styles.inputWrap}>
                  <Mail aria-hidden="true" className={styles.inputIcon} size={16} />
                  <input
                    aria-describedby={describedBy("email")}
                    aria-invalid={errorField === "email" ? true : undefined}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    className={`${styles.input} ${errorField === "email" ? styles.inputError : ""}`}
                    disabled={loading}
                    id="setup-email"
                    inputMode="email"
                    maxLength={254}
                    name="email"
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="ten@vidu.vn"
                    ref={emailRef}
                    required
                    spellCheck={false}
                    type="email"
                    value={email}
                  />
                </div>
                {errorField === "email" ? (
                  <p className={styles.fieldError} id="setup-error-email" role="alert">{error?.message}</p>
                ) : null}
              </div>

              <div className={styles.fieldGroup}>
                <div className={styles.labelRow}>
                  <label className={styles.label} htmlFor="setup-password">
                    Mật khẩu
                  </label>
                  <span className={styles.fieldHint}>Tối thiểu 10 ký tự</span>
                </div>
                <div className={styles.inputWrap}>
                  <Lock aria-hidden="true" className={styles.inputIcon} size={16} />
                  <input
                    aria-describedby={describedBy("password")}
                    aria-invalid={errorField === "password" ? true : undefined}
                    autoComplete="new-password"
                    className={`${styles.input} ${errorField === "password" ? styles.inputError : ""}`}
                    disabled={loading}
                    id="setup-password"
                    maxLength={128}
                    minLength={10}
                    name="password"
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Nhập ít nhất 10 ký tự"
                    ref={passwordRef}
                    required
                    type="password"
                    value={password}
                  />
                </div>
                <p className={styles.fieldHint} id="setup-password-hint">
                  Dùng mật khẩu riêng cho website này và lưu lại ở nơi an toàn.
                </p>
                {errorField === "password" ? (
                  <p className={styles.fieldError} id="setup-error-password" role="alert">{error?.message}</p>
                ) : null}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="setup-confirm-password">
                  Xác nhận mật khẩu
                </label>
                <div className={styles.inputWrap}>
                  <Lock aria-hidden="true" className={styles.inputIcon} size={16} />
                  <input
                    aria-describedby={describedBy("confirmPassword")}
                    aria-invalid={errorField === "confirmPassword" ? true : undefined}
                    autoComplete="new-password"
                    className={`${styles.input} ${errorField === "confirmPassword" ? styles.inputError : ""}`}
                    disabled={loading}
                    id="setup-confirm-password"
                    maxLength={128}
                    minLength={10}
                    name="confirmPassword"
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Nhập lại mật khẩu để xác nhận"
                    ref={confirmRef}
                    required
                    type="password"
                    value={confirmPassword}
                  />
                </div>
                {errorField === "confirmPassword" ? (
                  <p className={styles.fieldError} id="setup-error-confirmPassword" role="alert">{error?.message}</p>
                ) : null}
              </div>

              <button
                aria-busy={loading}
                aria-label="Tạo tài khoản quản trị"
                className={styles.submitBtn}
                disabled={loading}
                type="submit"
              >
                {loading ? (
                  <>
                    <Loader2 aria-hidden="true" className={styles.spinIcon} size={18} />
                    <span>Đang tạo tài khoản...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck aria-hidden="true" size={18} />
                    <span>Tạo tài khoản quản trị</span>
                  </>
                )}
              </button>
            </form>

            <footer className={styles.footerNotes}>
              <p>
                Đã có tài khoản?{" "}
                <Link className={styles.link} href="/dang-nhap">
                  Đăng nhập
                </Link>
              </p>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}
