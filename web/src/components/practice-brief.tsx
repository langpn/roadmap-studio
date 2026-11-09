"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  CheckSquare,
  Square,
  CheckCircle2,
  Clock,
  Circle,
  FileCheck,
  Package,
  Layers,
  ListOrdered,
  MessageSquareText,
  ArrowLeft,
  ArrowRight,
  Info,
} from "lucide-react";
import type { PracticeBriefData } from "./roadmap-data";
import type { Catalog } from "@/lib/catalog/normalize";
import type { ProgressState } from "@/lib/progress/store";
import styles from "./practice-brief.module.css";
import { useDialogFocus } from "./use-dialog-focus";

export interface PracticeBriefProps {
  practice: PracticeBriefData;
  catalog: Catalog;
  currentState: ProgressState;
  mode: "private" | "demo";
  onStateChange: (newState: ProgressState) => void;
  onSelectLesson: (lessonId: string) => void;
  onClose: () => void;
  saving?: boolean;
  errorBanner?: React.ReactNode;
  /** Đường về bài học đã mở thực hành này, để không mất ngữ cảnh. */
  backLink?: { href: string; label: string };
  onBack?: () => void;
}

export function PracticeBrief({
  practice,
  catalog,
  currentState,
  mode,
  onStateChange,
  onSelectLesson,
  onClose,
  saving = false,
  errorBanner,
  backLink,
  onBack,
}: PracticeBriefProps) {
  const panelRef = useDialogFocus();
  const [checklist, setChecklist] = useState<{ practiceId: string; items: Record<number, boolean> }>({
    practiceId: practice.id,
    items: {},
  });
  const checkedItems = checklist.practiceId === practice.id ? checklist.items : {};

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function toggleCheck(index: number) {
    setChecklist((previous) => {
      const items = previous.practiceId === practice.id ? previous.items : {};
      return { practiceId: practice.id, items: { ...items, [index]: !items[index] } };
    });
  }

  return (
    <div className={styles.overlay} onClick={onClose} aria-modal="true" role="dialog" aria-labelledby="practice-brief-title">
      <div ref={panelRef} className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div>
            {backLink ? (
              <a className={styles.backLink} href={backLink.href}>
                <ArrowLeft size={15} aria-hidden="true" />
                {backLink.label}
              </a>
            ) : onBack ? (
              <button type="button" className={styles.backLink} onClick={onBack}>
                <ArrowLeft size={15} aria-hidden="true" />
                Quay lại bài học
              </button>
            ) : null}
            <h2 id="practice-brief-title" className={styles.title}>
              {practice.title}
            </h2>
            <div className={styles.headerMeta}>
              <span className={styles.badge}>{practice.kind === "milestone" ? "Cột mốc" : "Bài tự luyện"}</span>
              <span className={styles.duration}>{practice.targetDuration}</span>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Đóng bảng hướng dẫn bài thực hành hoặc cột mốc"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <main className={styles.body}>
          <div className={styles.cautionCallout} role="note">
            <Info size={18} className={styles.cautionIcon} aria-hidden="true" />
            <div className={styles.cautionContent}>
              <p className={styles.cautionText}><strong>Ghi chú của lộ trình:</strong> {practice.note}</p>
              <p className={styles.cautionText}>
                Các bước, tiêu chí và ví dụ là gợi ý tự luyện của lộ trình, không phải nội dung được xác nhận từ giảng viên.
              </p>
              {mode === "demo" && <p className={styles.cautionText}>Tiến độ trong phiên thử nghiệm được lưu cục bộ.</p>}
            </div>
          </div>

          <section className={styles.stateSection}>
            <h3 className={styles.sectionHeading}>Tiến độ của bạn</h3>
            <p className={styles.shortcutDesc}>Bạn tự xác nhận trạng thái; checklist bên dưới không tự thay đổi trạng thái này.</p>
            <div className={styles.stateButtonGroup} role="group" aria-label="Cập nhật trạng thái">
              <button
                type="button"
                className={`${styles.stateButton} ${currentState === "not_updated" ? styles.stateActiveNotUpdated : ""}`}
                onClick={() => onStateChange("not_updated")}
                disabled={saving}
                aria-pressed={currentState === "not_updated"}
              >
                <Circle size={16} aria-hidden="true" />
                <span>Chưa làm</span>
              </button>
              <button
                type="button"
                className={`${styles.stateButton} ${currentState === "in_progress" ? styles.stateActiveInProgress : ""}`}
                onClick={() => onStateChange("in_progress")}
                disabled={saving}
                aria-pressed={currentState === "in_progress"}
              >
                <Clock size={16} aria-hidden="true" />
                <span>Đang thực hiện</span>
              </button>
              <button
                type="button"
                className={`${styles.stateButton} ${currentState === "completed" ? styles.stateActiveCompleted : ""}`}
                onClick={() => onStateChange("completed")}
                disabled={saving}
                aria-pressed={currentState === "completed"}
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Đã hoàn thành</span>
              </button>
            </div>
          </section>

          <section className={styles.block}>
            <div className={styles.blockHeader}>
              <Layers size={18} className={styles.blockIcon} aria-hidden="true" />
              <h3 className={styles.blockTitle}>Mục tiêu và đầu ra</h3>
            </div>
            <p className={styles.bodyText}>{practice.target}</p>
            <ul className={styles.list}>
              {practice.outputs.map((item, idx) => (
                <li key={idx} className={styles.listItem}>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.block}>
            <div className={styles.blockHeader}>
              <Package size={18} className={styles.blockIcon} aria-hidden="true" />
              <h3 className={styles.blockTitle}>Chuẩn bị</h3>
            </div>
            <ul className={styles.list}>
              {practice.rawMaterials.map((item, idx) => (
                <li key={idx} className={styles.listItem}>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.block}>
            <div className={styles.blockHeader}>
              <ListOrdered size={18} className={styles.blockIcon} aria-hidden="true" />
              <h3 className={styles.blockTitle}>Các bước thực hiện</h3>
            </div>
            {practice.steps?.length ? (
              <ol className={styles.list}>
                {practice.steps.map((step, idx) => (
                  <li key={idx} className={styles.listItem}>{step}</li>
                ))}
              </ol>
            ) : (
              <p className={styles.shortcutDesc}>Chưa có hướng dẫn từng bước cho mục này.</p>
            )}
          </section>

          <section className={styles.block}>
            <div className={styles.blockHeader}>
              <FileCheck size={18} className={styles.blockIcon} aria-hidden="true" />
              <h3 className={styles.blockTitle}>Tiêu chí tự kiểm tra</h3>
            </div>
            <p className={styles.shortcutDesc}>Dấu tích chỉ được giữ khi bảng hướng dẫn đang mở.</p>
            <div className={styles.checklist}>
              {practice.checklist.map((item, idx) => {
                const isChecked = !!checkedItems[idx];
                return (
                  <button
                    key={idx}
                    type="button"
                    className={`${styles.checkItem} ${isChecked ? styles.checkItemDone : ""}`}
                    onClick={() => toggleCheck(idx)}
                    aria-pressed={isChecked}
                  >
                    {isChecked ? (
                      <CheckSquare size={18} className={styles.checkIconActive} aria-hidden="true" />
                    ) : (
                      <Square size={18} className={styles.checkIcon} aria-hidden="true" />
                    )}
                    <span className={styles.checkLabel}>{item}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {practice.example && (
            <section className={styles.block}>
              <div className={styles.blockHeader}>
                <MessageSquareText size={18} className={styles.blockIcon} aria-hidden="true" />
                <h3 className={styles.blockTitle}>{practice.example.label}</h3>
              </div>
              <p className={styles.exampleText}>{practice.example.text}</p>
            </section>
          )}

          <section className={styles.block}>
            <div className={styles.blockHeader}>
              <ArrowRight size={18} className={styles.blockIcon} aria-hidden="true" />
              <h3 className={styles.blockTitle}>Học liệu tham khảo</h3>
            </div>
            {practice.shortcutLessonIds.length ? (
              <ul className={styles.shortcutList}>
                {practice.shortcutLessonIds.map((item, index) => {
                  const course = catalog.courses.find((entry) => entry.slug === item.courseSlug);
                  const lesson = course?.chapters.flatMap((chapter) => chapter.lessons)
                    .find((entry) => entry.id === item.id && entry.courseSlug === item.courseSlug);
                  const role = item.role === "main" ? "Bài chính" : item.role === "support" ? "Bài hỗ trợ" : "Bài tham khảo";
                  return (
                    <li key={`${item.courseSlug}-${item.id}-${index}`} className={styles.shortcutItem}>
                      <div className={styles.shortcutMeta}>
                        <span className={styles.shortcutRole}>{role}</span>
                        <span>{mode === "demo" ? "Bài mẫu" : `Bài #${item.id}`}</span>
                      </div>
                      {lesson ? (
                        <button type="button" className={styles.shortcutButton} onClick={() => onSelectLesson(item.id)}>
                          <span className={styles.shortcutLabel}>{item.label}</span>
                          <ArrowRight size={16} className={styles.shortcutArrow} aria-hidden="true" />
                        </button>
                      ) : (
                        <div className={styles.shortcutUnavailable}>
                          <span className={styles.shortcutLabel}>{item.label}</span>
                          <span>Không khả dụng</span>
                        </div>
                      )}
                      {item.purpose && <p className={styles.shortcutDesc}>{item.purpose}</p>}
                      {lesson && mode === "private" && (
                        <div className={styles.evidence}>
                          {lesson.summaryEvidence && lesson.summary && <p>{lesson.summary}</p>}
                          <p>{lesson.summaryEvidence || "Chọn theo tên danh mục; chưa xác minh nội dung video."}</p>
                        </div>
                      )}
                      {lesson && mode === "demo" && <p className={styles.shortcutDesc}>Học liệu mô phỏng trong phiên thử nghiệm.</p>}
                      {!lesson && <p className={styles.shortcutDesc}>Không tìm thấy bài này trong khóa học tương ứng.</p>}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.shortcutDesc}>Chưa có học liệu tham khảo cho mục này.</p>
            )}
          </section>
        </main>
        {errorBanner}
      </div>
    </div>
  );
}
