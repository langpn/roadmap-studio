"use client";

import React from "react";
import { AlertCircle, RefreshCw, X } from "lucide-react";
import styles from "./error-banner.module.css";

export interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
  onDismiss: () => void;
  retrying?: boolean;
}

export function ErrorBanner({ message, onRetry, onDismiss, retrying }: ErrorBannerProps) {
  return (
    <aside aria-label="Thông báo lỗi lưu tiến độ" className={styles.banner} role="alert">
      <div className={styles.content}>
        <AlertCircle aria-hidden="true" className={styles.icon} size={20} />
        <div className={styles.textWrap}>
          <p className={styles.message}>{message}</p>
          <span className={styles.subtext}>Trạng thái chưa được lưu. Hãy làm theo hướng dẫn ở trên trước khi tiếp tục.</span>
        </div>
      </div>
      <div className={styles.actions}>
        {onRetry && (
          <button
            type="button"
            className={styles.retryButton}
            onClick={onRetry}
            disabled={retrying}
            aria-label="Thử lại thao tác vừa thất bại"
          >
            <RefreshCw className={retrying ? styles.spin : ""} size={15} aria-hidden="true" />
            <span>{retrying ? "Đang thử lại..." : "Thử lại"}</span>
          </button>
        )}
        <button
          type="button"
          className={styles.dismissButton}
          onClick={onDismiss}
          aria-label="Đóng thông báo lỗi"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
