"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import {
  X,
  CheckCircle2,
  Clock,
  Circle,
  ShieldAlert,
  BookmarkCheck,
  ArrowLeft,
  ArrowRight,
  PlayCircle,
} from "lucide-react";
import type { Lesson, Course, Chapter } from "@/lib/catalog/normalize";
import type { RelatedLesson } from "@/lib/catalog/lesson-links";
import type { LessonPractice } from "@/lib/catalog/lesson-practices";
import type { ProgressState } from "@/lib/progress/store";
import styles from "./lesson-detail.module.css";
import { useDialogFocus } from "./use-dialog-focus";

export type LessonWithSummary = Lesson & {
  summary?: string | null;
  summaryEvidence?: string | null;
};

export interface LessonDetailProps {
  lesson: Lesson | null;
  course: Course | null;
  chapter: Chapter | null;
  currentState: ProgressState;
  mode: "private" | "demo";
  sourceUrl?: string;
  onStateChange: (newState: ProgressState) => void;
  onClose: () => void;
  saving?: boolean;
  errorBanner?: React.ReactNode;
  nextLessonTitle?: string;
  onNextLesson?: () => void;
  shortcutNote?: string | null;
  relatedLessons?: RelatedLesson[];
  showRelatedLessons?: boolean;
  onSelectRelatedLesson?: (lessonId: string) => void;
  previousLessonTitle?: string;
  onPreviousLesson?: () => void;
  relatedPractices?: LessonPractice[];
  onOpenPractice?: (practiceId: string) => void;
}

export function LessonDetail({
  lesson,
  course,
  chapter,
  currentState,
  mode,
  onStateChange,
  onClose,
  saving = false,
  errorBanner,
  shortcutNote,
  relatedLessons = [],
  showRelatedLessons = false,
  previousLessonTitle,
  onPreviousLesson,
}: LessonDetailProps) {
  const panelRef = useDialogFocus();
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !document.fullscreenElement) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!lesson) return null;

  const lessonWithSummary = lesson as LessonWithSummary;
  const hasSummary = Boolean(lessonWithSummary.summary);

  return (
    <div className={styles.overlay} onClick={onClose} aria-modal="true" role="dialog" aria-labelledby="lesson-detail-title">
      <div ref={panelRef} className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerMeta}>
            <span className={styles.courseBadge}>{course?.title ?? "Khóa học"}</span>
            <span className={styles.metaDivider}>/</span>
            <span className={styles.chapterBadge}>{chapter?.title ?? "Chương"}</span>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Đóng bảng chi tiết bài học"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <main className={styles.body}>
          <div className={styles.titleSection}>
            {previousLessonTitle && onPreviousLesson && (
              <button type="button" className={styles.backLesson} onClick={onPreviousLesson} disabled={saving}>
                <ArrowLeft size={15} aria-hidden="true" />
                <span>Quay lại: {previousLessonTitle}</span>
              </button>
            )}
            <h2 id="lesson-detail-title" className={styles.title}>
              {lesson.title}
            </h2>
            {lesson.titleWithheld && (
              <div className={styles.privacyNote} role="note">
                <ShieldAlert size={16} className={styles.privacyIcon} aria-hidden="true" />
                <span>Danh mục đã lưu chưa có tiêu đề gốc. Hãy cập nhật danh mục khi có tệp nguồn.</span>
              </div>
            )}
            {shortcutNote && (
              <div className={styles.shortcutCallout} role="note">
                <BookmarkCheck size={16} className={styles.shortcutIcon} aria-hidden="true" />
                <span>{shortcutNote}</span>
              </div>
            )}
          </div>

          <section className={styles.studySection} aria-labelledby="lesson-study-title">
            <h3 id="lesson-study-title" className={styles.sectionHeading}>Mô tả bài</h3>
            <div className={styles.studyCard}>
              <p className={styles.studyHint}>{hasSummary ? lessonWithSummary.summary : "Chưa có mô tả đã đối chiếu phần chữ trên trang."}</p>
              {hasSummary && <p className={styles.studyHint}>Từ phần chữ trên trang; chưa xác minh nội dung video.</p>}
              <Link className={styles.studyLink} href={`/bai-hoc/${lesson.id}${mode === "demo" ? "?demo=1" : ""}`} target="_blank" rel="noopener noreferrer">
                <PlayCircle size={18} aria-hidden="true" />
                <span>Mở trang học</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </section>

          {showRelatedLessons && (
            <section className={styles.relatedSection} aria-labelledby="related-lessons-title">
              <h3 id="related-lessons-title" className={styles.sectionHeading}>Bài học liên kết</h3>
              <p className={styles.relatedIntro}>Gợi ý tham khảo; mức bằng chứng ghi ở từng mục, chưa mục nào xác minh nội dung video.</p>
              {relatedLessons.length === 0 ? <p className={styles.relatedEmpty}>Chưa có bài liên kết gợi ý.</p> : (
                <ul className={styles.relatedList}>
                  {relatedLessons.map((item) => (
                    <li className={styles.relatedItem} key={`${item.lesson.courseSlug}:${item.lesson.id}`}>
                      <div className={styles.relatedMeta}>
                        <span className={styles.relatedKind}>{item.direction === "incoming" ? "Bài liên kết đến đây" : item.kind === "foundation" ? "Nền tảng" : item.kind === "advanced" ? "Tìm hiểu sâu" : "Bổ trợ"}</span>
                        <span className={styles.relatedCourse}>{item.courseTitle}</span>
                      </div>
                      <Link className={styles.relatedLink} href={`/bai-hoc/${item.lesson.id}${mode === "demo" ? "?demo=1" : ""}`} target="_blank" rel="noopener noreferrer">
                        <span>{item.lesson.title}</span> <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                      <p className={styles.relatedReason}>{item.reason}</p>
                      <p className={styles.relatedReason}>{item.basisLabel}{item.evidence ? ` — ${item.evidence}` : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className={styles.stateSection} aria-labelledby="lesson-state-title">
            <h3 id="lesson-state-title" className={styles.sectionHeading}>Tiến độ của bạn</h3>
            <div className={styles.stateButtonGroup} role="group" aria-label="Chọn trạng thái bài học">
              <button
                type="button"
                className={`${styles.stateButton} ${currentState === "not_updated" ? styles.stateActiveNotUpdated : ""}`}
                onClick={() => onStateChange("not_updated")}
                disabled={saving}
                aria-pressed={currentState === "not_updated"}
              >
                <Circle size={16} aria-hidden="true" />
                <span>Chưa học</span>
              </button>
              <button
                type="button"
                className={`${styles.stateButton} ${currentState === "in_progress" ? styles.stateActiveInProgress : ""}`}
                onClick={() => onStateChange("in_progress")}
                disabled={saving}
                aria-pressed={currentState === "in_progress"}
              >
                <Clock size={16} aria-hidden="true" />
                <span>Đang học</span>
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

        </main>
        {errorBanner}
      </div>
    </div>
  );
}
