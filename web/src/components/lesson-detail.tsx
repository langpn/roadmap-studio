"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  X,
  ExternalLink,
  CheckCircle2,
  Clock,
  Circle,
  ShieldAlert,
  FileText,
  BookmarkCheck,
  Lock,
  FileCheck2,
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
import { RelatedPractices } from "./related-practices";

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
  sourceUrl,
  onStateChange,
  onClose,
  saving = false,
  errorBanner,
  nextLessonTitle,
  onNextLesson,
  shortcutNote,
  relatedLessons = [],
  showRelatedLessons = false,
  onSelectRelatedLesson,
  previousLessonTitle,
  onPreviousLesson,
  relatedPractices = [],
  onOpenPractice,
}: LessonDetailProps) {
  const panelRef = useDialogFocus();
  const [windowError, setWindowError] = useState("");
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
  function openSourceWindow() {
    if (!sourceUrl) return;
    setWindowError("");
    const width = Math.min(1280, Math.max(760, window.screen.availWidth - 420));
    const height = Math.min(860, Math.max(540, window.screen.availHeight - 96));
    const opened = window.open(sourceUrl, "_blank", `popup=yes,noopener,noreferrer,width=${width},height=${height}`);
    if (!opened) setWindowError("Trình duyệt đã chặn cửa sổ mới. Hãy dùng nút Mở trong thẻ mới bên cạnh.");
  }
  const groups = [
    { label: "Nền tảng", items: relatedLessons.filter((item) => item.direction === "outgoing" && item.kind === "foundation") },
    { label: "Bổ trợ", items: relatedLessons.filter((item) => item.direction === "outgoing" && item.kind === "support") },
    { label: "Tìm hiểu sâu", items: relatedLessons.filter((item) => item.direction === "outgoing" && item.kind === "advanced") },
    { label: "Bài liên kết đến đây", items: relatedLessons.filter((item) => item.direction === "incoming") },
  ].filter((group) => group.items.length > 0);

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
            <h3 id="lesson-study-title" className={styles.sectionHeading}>Học bài</h3>
            <div className={styles.studyCard}>
              <p className={styles.studyHint}>Video nằm trong trang học riêng. Mô tả bên dưới dùng chung dữ liệu với trang đó.</p>
              <Link className={styles.studyLink} href={`/bai-hoc/${lesson.id}${mode === "demo" ? "?demo=1" : ""}`}>
                <PlayCircle size={18} aria-hidden="true" />
                <span>Mở trang học</span>
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </section>

          {/* Phần lớn bài không có thực hành; ẩn hẳn để bảng chi tiết gọn. */}
          {relatedPractices.length > 0 && (
            <RelatedPractices flat headingLevel={3} items={relatedPractices} onOpen={onOpenPractice} />
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

          <section className={styles.descriptionSection} aria-labelledby="lesson-summary-title">
            <h3 id="lesson-summary-title" className={styles.sectionHeading}>Mô tả bài</h3>
            {hasSummary ? (
              <div className={styles.descriptionCard}>
                <p className={styles.descriptionText}>{lessonWithSummary.summary}</p>
                <p className={styles.descriptionSource}>
                  <FileCheck2 size={14} aria-hidden="true" />
                  <span>Đã đối chiếu phần chữ trên trang</span>
                  {lessonWithSummary.summaryEvidence && (
                    <span>Tài liệu nguồn đối chiếu: {lessonWithSummary.summaryEvidence}</span>
                  )}
                </p>
              </div>
            ) : (
              <p className={styles.descriptionEmpty}>
                {mode === "demo" ? "Đây là bài mẫu, chưa có mô tả đối chiếu." : "Chưa có mô tả đã đối chiếu chữ; bạn vẫn có thể mở trang bài gốc để xem tài liệu."}
              </p>
            )}
          </section>

          <section className={styles.infoSection} aria-labelledby="lesson-info-title">
            <h3 id="lesson-info-title" className={styles.sectionHeading}>Thông tin bài</h3>
            <ul className={styles.infoList}>
              {chapter && (
                <li>Bài {chapter.lessons.findIndex((entry) => entry.id === lesson.id) + 1} trong chương</li>
              )}
              {lesson.duration && <li>Thời lượng: {lesson.duration}</li>}
              <li>
                {lesson.typeEvidence === "catalog_list" ? (
                  "Loại bài theo danh mục, chưa mở trang để xác minh"
                ) : lesson.kind === "reading" ? (
                  <>
                    <FileText size={13} aria-hidden="true" />
                    Bài đọc
                  </>
                ) : lesson.kind === "video" ? "Bài video (đã mở trang)" : "Chưa xác minh định dạng"}
              </li>
            </ul>
          </section>

          {showRelatedLessons && (
            <section className={styles.relatedSection} aria-labelledby="related-lessons-title">
              <h3 id="related-lessons-title" className={styles.sectionHeading}>Bài học liên kết</h3>
              <p className={styles.relatedIntro}>
                Gợi ý theo tiêu đề và chủ đề; nội dung video chưa được xác minh. Bạn có thể chọn học khi cần.
              </p>
              {groups.length === 0 ? (
                <p className={styles.relatedEmpty}>Chưa có bài liên kết gợi ý cho bài này.</p>
              ) : groups.map((group) => (
                <details className={styles.relatedGroup} key={group.label} open={group.items.length <= 5}>
                  <summary>{group.label} <span>({group.items.length})</span></summary>
                  <ul className={styles.relatedList}>
                    {group.items.map((item) => (
                      <li className={styles.relatedItem} key={`${item.lesson.courseSlug}:${item.lesson.id}`}>
                        <span className={styles.relatedCourse}>{item.courseTitle}</span>
                        <button
                          type="button"
                          className={styles.relatedLink}
                          onClick={() => onSelectRelatedLesson?.(item.lesson.id)}
                          disabled={saving || !onSelectRelatedLesson}
                        >
                          <span>{item.lesson.title}</span>
                          <ArrowRight size={15} aria-hidden="true" />
                        </button>
                        <p className={styles.relatedReason}>{item.reason}</p>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </section>
          )}

          {nextLessonTitle && onNextLesson && (
            <section className={styles.nextSection} aria-labelledby="lesson-next-title">
              <h3 id="lesson-next-title" className={styles.sectionHeading}>Tiếp theo trong giáo trình</h3>
              <button className={styles.nextLessonButton} type="button" disabled={saving} onClick={onNextLesson}>
                Bài tiếp theo: {nextLessonTitle}
              </button>
            </section>
          )}

          <section className={styles.sourceSection} aria-labelledby="lesson-source-title">
            <h3 id="lesson-source-title" className={styles.sectionHeading}>Website gốc</h3>
            {mode === "demo" ? (
              <div className={styles.sourceCardDemo}>
                <div className={styles.demoNotice}>
                  <Lock size={16} aria-hidden="true" />
                  <span>Liên kết nguồn chỉ mở trong phiên học cá nhân (Private)</span>
                </div>
                <p className={styles.sourceDescription}>
                  Trong chế độ thử nghiệm (demo), các liên kết ra website khóa học bên ngoài bị khóa để đảm bảo an toàn phiên và bảo mật tài liệu.
                </p>
              </div>
            ) : sourceUrl ? (
              <>
                <p className={styles.sourceDescription}>
                  Mở trong cửa sổ riêng bên cạnh bảng lộ trình; cửa sổ dùng phiên đăng nhập và trình phát của website gốc (website gốc bị lỗi khi nhúng trong khung).
                </p>
                <div className={styles.sourceActions}>
                  <button type="button" className={styles.sourceButton} onClick={openSourceWindow}>
                    Xem bài học trên website gốc
                  </button>
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.sourceFallback}>
                    <ExternalLink size={16} aria-hidden="true" /> Mở trong thẻ mới
                  </a>
                </div>
                {windowError && <p className={styles.sourceError} role="alert">{windowError}</p>}
              </>
            ) : (
              <p className={styles.sourceDescription}>Không có liên kết bài học hợp lệ trong danh mục.</p>
            )}
          </section>
        </main>
        {errorBanner}
      </div>
    </div>
  );
}
