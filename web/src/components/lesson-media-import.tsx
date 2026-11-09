"use client";

import Link from "next/link";
import React, { useId, useRef, useState } from "react";
import { parseLessonMediaMap } from "@/lib/media/lesson-media-map";
import styles from "./lesson-media-import.module.css";

type ImportStatus = "idle" | "reading" | "validating" | "sending" | "done" | "error";

interface LessonMediaImportProps {
  onImported?: () => void;
}

const MAX_FILE_BYTES = 512 * 1024;

const BUSY_LABEL: Partial<Record<ImportStatus, string>> = {
  reading: "Đang đọc tệp…",
  validating: "Đang kiểm tra dữ liệu…",
  sending: "Đang gửi liên kết…",
};

function isBusy(status: ImportStatus): boolean {
  return status === "reading" || status === "validating" || status === "sending";
}

function readErrorDetail(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export default function LessonMediaImport({ onImported }: LessonMediaImportProps) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const [unauthorized, setUnauthorized] = useState(false);
  const [result, setResult] = useState<{ imported: number; replaced: number; skipped: number; rejected: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaId = useId();
  const helpId = useId();

  const busy = isBusy(status);

  const fail = (message: string, nextUnauthorized = false) => {
    setErrors([message]);
    setUnauthorized(nextUnauthorized);
    setResult(null);
    setStatus("error");
  };

  const send = async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      fail("Chưa có nội dung để nhập. Hãy dán nội dung tệp JSON hoặc chọn tệp JSON.");
      return;
    }

    setStatus("validating");
    setErrors([]);
    setUnauthorized(false);
    setResult(null);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(trimmed);
    } catch {
      fail("Nội dung dán vào không phải JSON hợp lệ. Hãy mở lại tệp vừa tải và dán toàn bộ nội dung của tệp.");
      return;
    }

    const parsed = parseLessonMediaMap(parsedJson);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setStatus("error");
      return;
    }

    setStatus("sending");

    let response: Response;
    try {
      response = await fetch("/api/lesson-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.map),
      });
    } catch {
      fail("Không kết nối được tới ứng dụng. Hãy kiểm tra mạng rồi thử lại.");
      return;
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const record = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : null;

    if (!response.ok) {
      const detail = record ? readErrorDetail(record.error) : null;
      if (response.status === 401) {
        fail("Phiên đăng nhập đã hết hạn (mã 401). Hãy đăng nhập lại rồi nhập lại tệp.", true);
        return;
      }
      const parts = [`Chưa nhập được liên kết (mã ${response.status}).`];
      if (detail) parts.push(detail);
      if (response.status === 403) parts.push("Yêu cầu bị từ chối. Hãy tải lại trang rồi thử lại.");
      else if (response.status === 413) parts.push("Hãy chọn tệp nhỏ hơn hoặc dán nội dung rút gọn.");
      else if (response.status === 400 || response.status === 422) parts.push("Hãy kiểm tra lại tệp đã chọn rồi thử lại.");
      else parts.push("Hãy thử lại sau ít phút.");
      fail(parts.join(" "), false);
      return;
    }

    const imported = record && typeof record.imported === "number" && Number.isFinite(record.imported) ? record.imported : null;
    if (imported === null) {
      fail("Máy chủ trả về dữ liệu không như mong đợi. Hãy tải lại trang rồi thử lại.");
      return;
    }
    const replaced = record && typeof record.replaced === "number" && Number.isFinite(record.replaced) ? record.replaced : 0;
    const serverSkipped = record && typeof record.skipped === "number" && Number.isFinite(record.skipped) ? record.skipped : 0;
    const rejected = record && typeof record.rejected === "number" && Number.isFinite(record.rejected) ? record.rejected : 0;

    // Parser cục bộ đã bỏ các mục sai định dạng trước khi gửi, nên phải cộng cả hai nguồn.
    setResult({ imported, replaced, skipped: parsed.skipped + serverSkipped, rejected });
    setErrors([]);
    setUnauthorized(false);
    setContent("");
    setStatus("done");
    onImported?.();
  };

  const readFile = async (file: File) => {
    setStatus("reading");
    setErrors([]);
    setUnauthorized(false);
    setResult(null);

    // Tệp do nút thu thập tải về luôn có đuôi .json; chỉ chặn khi đuôi rõ ràng khác.
    const hasOtherExtension = /\.[a-z0-9]{1,8}$/i.test(file.name) && !/\.json$/i.test(file.name);
    if (hasOtherExtension) {
      fail("Tệp đã chọn không phải tệp JSON. Hãy chọn đúng tệp vừa tải về.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      fail("Tệp lớn hơn 512 KB. Hãy kiểm tra lại xem bạn có chọn đúng tệp JSON vừa thu thập không.");
      return;
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      fail("Không đọc được tệp. Hãy thử chọn lại tệp JSON.");
      return;
    }

    setContent(text);
    await send(text);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    void send(content);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    void readFile(file);
  };

  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value);
    if (status === "done" || status === "error") {
      setStatus("idle");
      setErrors([]);
      setUnauthorized(false);
      setResult(null);
    }
  };

  const statusMessage = BUSY_LABEL[status] ?? "";

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <div
        className={`${styles.field} ${dragging ? styles.fieldDragging : ""}`}
        onDragEnter={(event) => {
          if (!event.dataTransfer.types.includes("Files") || busy) return;
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("Files") || busy) return;
          event.preventDefault();
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(event) => {
          // Chỉ chặn thao tác kéo-thả khi thực sự có tệp; văn bản vẫn được thả vào ô như bình thường.
          if (!event.dataTransfer.files || event.dataTransfer.files.length === 0) return;
          event.preventDefault();
          setDragging(false);
          if (busy) return;
          const file = event.dataTransfer.files[0];
          if (file) void readFile(file);
        }}
      >
        <label className={styles.label} htmlFor={textareaId}>
          Dán nội dung tệp JSON
        </label>
        <textarea
          aria-describedby={helpId}
          className={styles.textarea}
          disabled={busy}
          id={textareaId}
          onChange={handleContentChange}
          placeholder={'{"version":1,"collectedAt":"…","entries":[…]}'}
          spellCheck={false}
          value={content}
        />
        <p className={styles.help} id={helpId}>
          Kéo tệp JSON vừa tải vào ô này, hoặc bấm &ldquo;Chọn tệp JSON&rdquo;. Dữ liệu được kiểm tra
          trên trình duyệt trước khi gửi.
        </p>
      </div>

      <input
        accept="application/json,.json"
        aria-hidden="true"
        className={styles.fileInput}
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <div className={styles.actions}>
        <button
          className={styles.secondaryButton}
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          Chọn tệp JSON
        </button>
        <button className={styles.primaryButton} disabled={busy} type="submit">
          {busy ? "Đang xử lý…" : "Nhập liệu"}
        </button>
      </div>

      <div aria-live="polite" className={styles.statusRegion} role="status">
        {statusMessage ? <p className={styles.statusText}>{statusMessage}</p> : null}
        {status === "done" && result ? (
          <div className={styles.successBox}>
            <p className={styles.successTitle}>Đã nhập {result.imported} liên kết.</p>
            {result.replaced > 0 ? (
              <p className={styles.successDetail}>Cập nhật lại {result.replaced} liên kết đã có.</p>
            ) : null}
            {result.skipped > 0 ? (
              <p className={styles.successDetail}>
                Bỏ qua {result.skipped} mục không đọc được trong tệp.
              </p>
            ) : null}
            {result.rejected > 0 ? (
              <p className={styles.successDetail}>
                Bỏ qua {result.rejected} liên kết vì không khớp bài có trong danh mục hiện tại.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {errors.length > 0 ? (
        <div className={styles.errorBox} role="alert">
          <p className={styles.errorTitle}>Chưa thể nhập dữ liệu</p>
          {errors.length === 1 ? (
            <p className={styles.errorDetail}>{errors[0]}</p>
          ) : (
            <ul className={styles.errorList}>
              {errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
          {unauthorized ? (
            <p className={styles.errorDetail}>
              <Link className={styles.errorLink} href="/dang-nhap">
                Đăng nhập lại
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
