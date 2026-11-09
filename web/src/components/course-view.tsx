"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Circle,
  FileText,
  Play,
  ShieldAlert,
  Search,
  Filter,
} from "lucide-react";
import type { Course, Chapter, Lesson } from "@/lib/catalog/normalize";
import type { Progress, ProgressState } from "@/lib/progress/store";
import type { RoadmapConfig } from "./roadmap-data";
import styles from "./course-view.module.css";

export interface CourseViewProps {
  course: Course;
  courseRoles: RoadmapConfig["courseRoles"];
  progress: Progress;
  onSelectLesson: (lesson: Lesson, chapter: Chapter) => void;
  onUpdateLessonState: (lessonId: string, state: ProgressState) => void;
  mode: "private" | "demo";
  saving?: boolean;
}

export function CourseView({
  course,
  courseRoles,
  progress,
  onSelectLesson,
  onUpdateLessonState,
  mode,
  saving = false,
}: CourseViewProps) {
  const [filterState, setFilterState] = useState<"all" | "completed" | "in_progress" | "not_updated">("all");
  const [localQuery, setLocalQuery] = useState("");
  // Track expanded state of chapters
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>(() => {
    // Default open first 3 chapters or chapters with < 50 lessons
    const init: Record<string, boolean> = {};
    course.chapters.forEach((ch, idx) => {
      init[ch.id] = idx < 3 || course.chapters.length <= 4;
    });
    return init;
  });

  // Track lesson pagination/slice per chapter: default 30 items per chapter
  const [visibleCountPerChapter, setVisibleCountPerChapter] = useState<Record<string, number>>({});

  const roleMeta = courseRoles[course.slug] ?? {
    role: `Khóa học trong hệ thống lộ trình (${course.lessonCount} bài, ${course.chapters.length} chương).`,
    verificationNote: mode === "demo" ? "Dữ liệu mẫu trong môi trường thử nghiệm." : "Nội dung học tập được sắp xếp theo thứ tự nguyên bản của chương trình.",
  };

  const stats = useMemo(() => {
    let completed = 0;
    let inProgress = 0;
    course.chapters.forEach((ch) => {
      ch.lessons.forEach((l) => {
        const s = progress.lessons[l.id];
        if (s === "completed") completed += 1;
        else if (s === "in_progress") inProgress += 1;
      });
    });
    const percent = course.lessonCount > 0 ? Math.round((completed / course.lessonCount) * 100) : 0;
    return { completed, inProgress, percent };
  }, [course, progress.lessons]);

  function toggleChapter(chId: string) {
    setExpandedChapters((prev) => ({
      ...prev,
      [chId]: !prev[chId],
    }));
  }

  function loadMoreLessons(chId: string) {
    setVisibleCountPerChapter((prev) => ({
      ...prev,
      [chId]: (prev[chId] ?? 30) + 30,
    }));
  }

  function showAllLessons(chId: string, currentTotal: number) {
    setVisibleCountPerChapter((prev) => ({
      ...prev,
      [chId]: currentTotal,
    }));
  }

  // Filter lessons in chapter
  function filterChapterLessons(lessons: Lesson[]) {
    let result = lessons;
    if (filterState !== "all") {
      result = result.filter((l) => {
        const s = progress.lessons[l.id] ?? "not_updated";
        return s === filterState;
      });
    }
    if (localQuery.trim()) {
      const q = localQuery
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .toLowerCase();
      result = result.filter((l) => {
        const titleNorm = l.title
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d")
          .toLowerCase();
        return titleNorm.includes(q);
      });
    }
    return result;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleArea}>
            <span className={styles.courseIndex}>Khóa số {course.position + 1}</span>
            <h1 className={styles.courseTitle}>{course.title}</h1>
          </div>
          <div className={styles.progressPill}>
            <span className={styles.progressPercent}>{stats.percent}%</span>
            <span className={styles.progressCount}>
              {stats.completed}/{course.lessonCount} bài
            </span>
          </div>
        </div>

        <p className={styles.roleText}>{roleMeta.role}</p>
        <p className={styles.verificationText}>
          <strong>Lưu ý:</strong> {roleMeta.verificationNote}
        </p>

        <div className={styles.progressBarBg}>
          <div className={styles.progressBarFill} style={{ width: `${stats.percent}%` }} />
        </div>

        <div className={styles.controlsBar}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              placeholder="Lọc bài trong khóa này (không dấu)..."
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              className={styles.searchInput}
              aria-label="Lọc bài trong khóa học hiện tại"
            />
            {localQuery && (
              <button
                type="button"
                onClick={() => setLocalQuery("")}
                className={styles.clearSearch}
                aria-label="Xóa bộ lọc"
              >
                ✕
              </button>
            )}
          </div>

          <div className={styles.filterGroup}>
            <Filter size={15} className={styles.filterIcon} aria-hidden="true" />
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value as "all" | "completed" | "in_progress" | "not_updated")}
              className={styles.filterSelect}
              aria-label="Lọc theo trạng thái hoàn thành"
            >
              <option value="all">Tất cả bài ({course.lessonCount})</option>
              <option value="completed">Đã hoàn thành ({stats.completed})</option>
              <option value="in_progress">Đang học ({stats.inProgress})</option>
              <option value="not_updated">Chưa học ({course.lessonCount - stats.completed - stats.inProgress})</option>
            </select>
          </div>
        </div>
      </header>

      <main className={styles.chaptersList}>
        {course.chapters.map((chapter) => {
          const isExpanded = !!expandedChapters[chapter.id];
          const filteredLessons = filterChapterLessons(chapter.lessons);
          const visibleLimit = visibleCountPerChapter[chapter.id] ?? 30;
          const visibleLessons = filteredLessons.slice(0, visibleLimit);
          const hasMore = filteredLessons.length > visibleLimit;

          const chapterCompleted = chapter.lessons.filter(
            (l) => progress.lessons[l.id] === "completed"
          ).length;

          return (
            <section key={chapter.id} className={styles.chapterCard}>
              <button
                type="button"
                className={styles.chapterHeader}
                onClick={() => toggleChapter(chapter.id)}
                aria-expanded={isExpanded}
              >
                <div className={styles.chapterTitleWrap}>
                  {isExpanded ? (
                    <ChevronDown size={18} className={styles.chapterChevron} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={18} className={styles.chapterChevron} aria-hidden="true" />
                  )}
                  <h2 className={styles.chapterTitle}>{chapter.title}</h2>
                </div>
                <div className={styles.chapterMeta}>
                  <span className={styles.chapterCount}>
                    {chapterCompleted}/{chapter.lessons.length} bài
                  </span>
                </div>
              </button>

              {isExpanded && (
                <div className={styles.lessonsContainer}>
                  {filteredLessons.length === 0 ? (
                    <div className={styles.emptyFiltered}>
                      <span>{chapter.lessons.length === 0 ? "Chương này chưa có bài học." : "Không có bài nào phù hợp với bộ lọc hiện tại."}</span>
                    </div>
                  ) : (
                    <>
                      <div className={styles.lessonsTable} role="list">
                        {visibleLessons.map((lesson) => {
                          const state = progress.lessons[lesson.id] ?? "not_updated";
                          const isLastOpened = progress.lastOpenedLessonId === lesson.id;

                          return (
                            <div
                              key={lesson.id}
                              role="listitem"
                              className={`${styles.lessonRow} ${isLastOpened ? styles.lessonRowLastOpened : ""}`}
                            >
                              <div className={styles.lessonStatusArea}>
                                <button
                                  type="button"
                                   className={styles.statusToggleBtn}
                                   disabled={saving}
                                  title="Chuyển trạng thái: Chưa học -> Đang học -> Đã hoàn thành"
                                  aria-label={`Trạng thái: ${state === "completed" ? "Đã xong" : state === "in_progress" ? "Đang học" : "Chưa học"}. Bấm để đổi.`}
                                  onClick={() => {
                                    const nextState: ProgressState =
                                      state === "not_updated"
                                        ? "in_progress"
                                        : state === "in_progress"
                                        ? "completed"
                                        : "not_updated";
                                    onUpdateLessonState(lesson.id, nextState);
                                  }}
                                >
                                  {state === "completed" ? (
                                    <CheckCircle2 size={18} className={styles.iconCompleted} aria-hidden="true" />
                                  ) : state === "in_progress" ? (
                                    <Clock size={18} className={styles.iconInProgress} aria-hidden="true" />
                                  ) : (
                                    <Circle size={18} className={styles.iconNotUpdated} aria-hidden="true" />
                                  )}
                                </button>
                              </div>

                              <button type="button" className={styles.lessonOpenButton} onClick={() => onSelectLesson(lesson, chapter)}>
                              <span className={styles.lessonInfo}>
                                <div className={styles.lessonTitleRow}>
                                  <span className={styles.lessonName}>{lesson.title}</span>
                                  {lesson.titleWithheld && (
                                    <span
                                      className={styles.privacyBadge}
                                      title="Danh mục đã lưu chưa có tiêu đề gốc"
                                    >
                                      <ShieldAlert size={12} aria-hidden="true" />
                                      Thiếu tiêu đề
                                    </span>
                                  )}
                                  {isLastOpened && (
                                    <span className={styles.lastOpenedBadge}>Vừa mở</span>
                                  )}
                                </div>
                              </span>

                              <span className={styles.lessonRightMeta}>
                                {lesson.typeEvidence === "catalog_list" ? (
                                  <span className={styles.kindLabelUnknown}>Loại theo danh mục</span>
                                ) : lesson.kind === "reading" ? (
                                  <span className={styles.kindLabel}>
                                    <FileText size={12} aria-hidden="true" />
                                    Bài đọc
                                  </span>
                                ) : lesson.kind === "video" ? (
                                  <span className={styles.kindLabel}>
                                    <Play size={12} aria-hidden="true" />
                                    Video
                                  </span>
                                ) : (
                                  <span className={styles.kindLabelUnknown}>
                                    Nội dung gốc
                                  </span>
                                )}
                                {lesson.duration && (
                                  <span className={styles.durationLabel}>{lesson.duration}</span>
                                )}
                              </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {hasMore && (
                        <div className={styles.paginationArea}>
                          <span className={styles.paginationInfo}>
                            Đang hiển thị {visibleLimit} trên tổng số {filteredLessons.length} bài
                          </span>
                          <div className={styles.paginationButtons}>
                            <button
                              type="button"
                              className={styles.loadMoreButton}
                              onClick={() => loadMoreLessons(chapter.id)}
                            >
                              Tải thêm 30 bài tiếp theo ({filteredLessons.length - visibleLimit} bài còn lại)
                            </button>
                            <button
                              type="button"
                              className={styles.showAllButton}
                              onClick={() => showAllLessons(chapter.id, filteredLessons.length)}
                            >
                              Xem toàn bộ {filteredLessons.length} bài
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
