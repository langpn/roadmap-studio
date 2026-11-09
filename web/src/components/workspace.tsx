"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import type { Catalog, Course, Chapter, Lesson } from "@/lib/catalog/normalize";
import { getRelatedLessons } from "@/lib/catalog/lesson-links";
import { getPracticesForLesson } from "@/lib/catalog/lesson-practices";
import { searchLessonMatches } from "@/lib/catalog/search";
import type { Progress, ProgressState } from "@/lib/progress/store";
import { hasUnfinishedPractices, recommendNextPractice } from "@/lib/progress/roadmap";
import { applyDemoChange, readDemoProgress, writeDemoProgress, type DemoChange } from "@/lib/progress/demo";
import {
  Compass,
  BookOpen,
  Award,
  Settings,
  Download,
  Search,
  Menu,
  PlayCircle,
  ArrowRight,
  Info,
  X,
} from "lucide-react";
import type { RoadmapConfig } from "./roadmap-data";
import { RoadmapDiagram } from "./roadmap-diagram";
import { CourseView } from "./course-view";
import { LessonDetail } from "./lesson-detail";
import { PracticeBrief } from "./practice-brief";
import { ErrorBanner } from "./error-banner";
import { SearchResults } from "./search-results";
import styles from "./workspace.module.css";

export interface WorkspaceProps {
  catalog: Catalog;
  roadmap: RoadmapConfig;
  initialProgress: Progress;
  userName: string;
  accountId?: string;
  mode: "private" | "demo";
  loginAvailable?: boolean;
  lessonSourceUrls?: Record<string, string>;
  /** Lối vào từ trang học: mở sẵn thực hành và nhớ bài để quay lại. */
  entryPracticeId?: string;
  entryLessonId?: string;
}

interface SelectedLessonContext {
  lesson: Lesson;
  course: Course;
  chapter: Chapter;
}

interface ErrorState {
  message: string;
  retry?: () => Promise<void>;
}

const accountChangedMessage = "Tài khoản đăng nhập đã thay đổi. Hãy tải lại trang trước khi tiếp tục.";
const outdatedPageMessage = "Trang này đã cũ. Hãy tải lại trang trước khi cập nhật tiến độ.";

function updateVersionedProgress(
  progress: Progress, kind: "lesson" | "practice", id: string,
  entry: { state: ProgressState; version: string } | null,
): Progress {
  const key = kind === "lesson" ? "lessons" : "practices";
  const states = { ...progress[key] };
  const versions = { lessons: { ...progress.versions?.lessons }, practices: { ...progress.versions?.practices } };
  if (entry) {
    states[id] = entry.state;
    versions[key][id] = entry.version;
  } else {
    delete states[id];
    delete versions[key][id];
  }
  return { ...progress, [key]: states, versions };
}

export function Workspace({ catalog, roadmap, initialProgress, userName, accountId, mode, loginAvailable = true, lessonSourceUrls, entryPracticeId, entryLessonId }: WorkspaceProps) {
  const { courseOrder, practices } = roadmap;
  // Mobile sidebar drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMenuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sidebarOpen) return;
    const menuButton = menuButtonRef.current;
    closeMenuRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      menuButton?.focus();
    };
  }, [sidebarOpen]);

  // Active view: "overview" | "course" | "practices"
  const [activeView, setActiveView] = useState<"overview" | "course" | "practices">("overview");
  const [selectedCourseSlug, setSelectedCourseSlug] = useState<string | null>(null);

  // Modal / Drawer states
  const [selectedLessonCtx, setSelectedLessonCtx] = useState<SelectedLessonContext | null>(null);
  const [lessonHistory, setLessonHistory] = useState<string[]>([]);
  const [activePracticeId, setActivePracticeId] = useState<string | null>(
    entryPracticeId && practices.some((practice) => practice.id === entryPracticeId) ? entryPracticeId : null,
  );
  const [returnToPracticeId, setReturnToPracticeId] = useState<string | null>(null);
  // Thực hành mở từ bảng chi tiết bài: đóng thực hành là mở lại đúng bảng đó.
  const [returnToLesson, setReturnToLesson] = useState<SelectedLessonContext | null>(null);
  // Global search input
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchStatus, setSearchStatus] = useState<"all" | ProgressState>("all");

  // Error state for API persistence
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openingCount, setOpeningCount] = useState(0);
  const savingRef = useRef(false);

  // Begin with identical server/client output; restore demo progress after hydration.
  const [progress, setProgress] = useState<Progress>(initialProgress);

  // Listen to storage events in demo mode across tabs
  useEffect(() => {
    if (mode !== "demo") return;
    function handleStorageChange(event?: StorageEvent) {
      if (event?.key && !event.key.startsWith("roadmap-demo-")) return;
      try {
        setProgress(readDemoProgress(localStorage, initialProgress));
      } catch {
        setErrorState({ message: "Không thể đọc tiến độ đã lưu trên trình duyệt. Hãy kiểm tra cài đặt lưu trữ và tải lại trang." });
      }
    }
    handleStorageChange();
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [mode, initialProgress]);

  // Order courses dynamically while favoring pedagogical roadmap order when known
  const orderedCourses = useMemo(() => {
    const courseMap = new Map<string, Course>();
    catalog.courses.forEach((c) => courseMap.set(c.slug, c));

    const ordered: Course[] = [];
    const remaining = new Set(catalog.courses);

    for (const slug of courseOrder) {
      const c = courseMap.get(slug);
      if (c) {
        ordered.push(c);
        remaining.delete(c);
      }
    }
    remaining.forEach((c) => ordered.push(c));
    return ordered.length > 0 ? ordered : catalog.courses;
  }, [catalog.courses, courseOrder]);

  // Currently selected course object
  const currentCourse = useMemo(() => {
    if (!selectedCourseSlug) return null;
    return catalog.courses.find((c) => c.slug === selectedCourseSlug) ?? null;
  }, [catalog.courses, selectedCourseSlug]);

  // Total progress statistics
  const overallStats = useMemo(() => {
    let completedLessons = 0;
    let inProgressLessons = 0;
    catalog.courses.forEach((c) => {
      c.chapters.forEach((ch) => {
        ch.lessons.forEach((l) => {
          const s = progress.lessons[l.id];
          if (s === "completed") completedLessons += 1;
          else if (s === "in_progress") inProgressLessons += 1;
        });
      });
    });

    const completedPractices = practices.filter((p) => progress.practices[p.id] === "completed").length;

    const percent = catalog.lessonCount > 0 ? Math.round((completedLessons / catalog.lessonCount) * 100) : 0;
    return { completedLessons, inProgressLessons, completedPractices, percent };
  }, [catalog, progress, practices]);

  // Helper to find lesson and its context by ID
  const findLessonContext = useCallback(
    (lessonId: string): SelectedLessonContext | null => {
      for (const course of catalog.courses) {
        for (const chapter of course.chapters) {
          const lesson = chapter.lessons.find((l) => l.id === lessonId);
          if (lesson) {
            return { course, chapter, lesson };
          }
        }
      }
      return null;
    },
    [catalog.courses]
  );

  // Last opened lesson context
  const lastOpenedContext = useMemo(() => {
    if (!progress.lastOpenedLessonId) return null;
    return findLessonContext(progress.lastOpenedLessonId);
  }, [progress.lastOpenedLessonId, findLessonContext]);

  const nextLessonInCourse = useCallback((context: SelectedLessonContext, unfinishedOnly = false) => {
    const lessons = context.course.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => ({
      course: context.course, chapter, lesson,
    })));
    const index = lessons.findIndex(({ lesson }) => lesson.id === context.lesson.id);
    return lessons.slice(index + 1).find(({ lesson }) => !unfinishedOnly || progress.lessons[lesson.id] !== "completed") ?? null;
  }, [progress.lessons]);

  const nextSelectedLesson = selectedLessonCtx ? nextLessonInCourse(selectedLessonCtx) : null;
  const nextUnfinishedLesson = lastOpenedContext ? nextLessonInCourse(lastOpenedContext, true) : null;
  const nextPracticeId = recommendNextPractice(roadmap.stages, practices, progress.practices);
  const nextPractice = practices.find((practice) => practice.id === nextPracticeId) ?? null;
  const hasUnfinishedPractice = hasUnfinishedPractices(roadmap.stages, practices, progress.practices);
  const networkCourse = catalog.courses.find((course) => course.slug === roadmap.lessonConnections?.[0]?.from.courseSlug);
  const eliteCourse = mode === "private" ? catalog.courses.find((course) => course.slug === "elite") : null;
  const eliteLessons = eliteCourse?.chapters.flatMap((chapter) => chapter.lessons) ?? [];
  const nextEliteLesson = eliteLessons.find((lesson) => progress.lessons[lesson.id] !== "completed");

  const saveDemoProgress = useCallback((change: DemoChange) => {
    const attempt = () => {
      try {
        writeDemoProgress(localStorage, change);
        setProgress((previous) => applyDemoChange(previous, change));
        setErrorState(null);
      } catch {
        setErrorState({
          message: "Không thể lưu tiến độ trên trình duyệt. Hãy kiểm tra cài đặt lưu trữ rồi thử lại.",
          retry: async () => { attempt(); },
        });
      }
    };
    attempt();
  }, []);

  // Each retry keeps the original version: a concurrent change must be shown, not overwritten.
  const saveProgressApi = useCallback(
    async (payload: { kind: "lesson" | "practice"; id: string; state: ProgressState; expectedVersion: string | null }) => {
      const attempt = async () => {
        if (savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        try {
          const res = await fetch("/api/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Roadmap-Account": accountId ?? "" },
            body: JSON.stringify(payload),
          });
          if (res.status === 409) {
            const body = await res.json();
            if (body.code === "PROGRESS_CONFLICT") {
              setProgress((prev) => updateVersionedProgress(prev, payload.kind, payload.id, body.current));
              setErrorState({ message: "Tiến độ đã thay đổi ở nơi khác. Đã hiển thị trạng thái đã lưu; hãy xem lại trước khi chọn tiếp." });
            } else {
              setErrorState({ message: body.code === "CLIENT_OUTDATED" ? outdatedPageMessage : accountChangedMessage });
            }
            return;
          }
          if (!res.ok) throw new Error(`Máy chủ trả về trạng thái ${res.status}`);
          const body = await res.json();
          if (typeof body.version !== "string") {
            setErrorState({ message: outdatedPageMessage });
            return;
          }
          setProgress((prev) => updateVersionedProgress(prev, payload.kind, payload.id, { state: payload.state, version: body.version }));
          setErrorState(null);
        } catch (err) {
          setErrorState({
            message: `Không xác nhận được việc lưu tiến độ (${(err as Error).message ?? "Lỗi kết nối"}). Nếu thao tác đã được lưu, ứng dụng sẽ yêu cầu bạn kiểm tra lại khi thử lại.`,
            retry: async () => {
              setRetrying(true);
              try { await attempt(); } finally { setRetrying(false); }
            },
          });
        } finally {
          savingRef.current = false;
          setSaving(false);
        }
      };
      await attempt();
    },
    [accountId]
  );

  // Update lesson progress state
  const handleUpdateLessonState = useCallback(
    (lessonId: string, newState: ProgressState) => {
      if (mode === "demo") {
        saveDemoProgress({ kind: "lesson", id: lessonId, state: newState });
        return;
      }
      const version = progress.versions?.lessons[lessonId];
      if (progress.lessons[lessonId] !== undefined && !version) {
        setErrorState({ message: outdatedPageMessage });
        return;
      }
      void saveProgressApi({ kind: "lesson", id: lessonId, state: newState, expectedVersion: version ?? null });
    },
    [progress, mode, saveProgressApi, saveDemoProgress]
  );

  // Update practice progress state
  const handleUpdatePracticeState = useCallback(
    (practiceId: string, newState: ProgressState) => {
      if (mode === "demo") {
        saveDemoProgress({ kind: "practice", id: practiceId, state: newState });
        return;
      }
      const version = progress.versions?.practices[practiceId];
      if (progress.practices[practiceId] !== undefined && !version) {
        setErrorState({ message: outdatedPageMessage });
        return;
      }
      void saveProgressApi({ kind: "practice", id: practiceId, state: newState, expectedVersion: version ?? null });
    },
    [progress, mode, saveProgressApi, saveDemoProgress]
  );

  // Select a lesson to view detail & record lastOpened
  const handleSelectLesson = useCallback(
    (lesson: Lesson, chapter: Chapter) => {
      const course = catalog.courses.find((c) => c.slug === lesson.courseSlug) ?? null;
      if (!course) return;

      setSelectedLessonCtx({ lesson, course, chapter });

      if (mode === "demo") {
        saveDemoProgress({ kind: "opened", id: lesson.id });
        return;
      }

      const versionAtOpen = progress.versions?.lessons[lesson.id] ?? null;
      setProgress((prev) => ({ ...prev, lastOpenedLessonId: lesson.id }));
      setOpeningCount((count) => count + 1);

      // Background record opened without blocking
      fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Roadmap-Account": accountId ?? "" },
        body: JSON.stringify({ kind: "opened", id: lesson.id }),
      }).then(async (response) => {
        if (response.status === 409) {
          setProgress((prev) => prev.lastOpenedLessonId === lesson.id ? { ...prev, lastOpenedLessonId: progress.lastOpenedLessonId } : prev);
          setErrorState({ message: accountChangedMessage });
        } else if (response.ok) {
          const body = await response.json();
          if (typeof body.lesson?.version !== "string") {
            setErrorState({ message: outdatedPageMessage });
            return;
          }
          setProgress((prev) => (prev.versions?.lessons[lesson.id] ?? null) === versionAtOpen
            ? updateVersionedProgress(prev, "lesson", lesson.id, body.lesson) : prev);
        }
      }).catch(() => {
        // Non-critical background call
      }).finally(() => {
        setOpeningCount((count) => count - 1);
      });
    },
    [catalog.courses, progress, mode, accountId, saveDemoProgress]
  );

  // Select lesson by ID (e.g. from practice shortcuts or lastOpened button)
  const handleSelectLessonById = useCallback(
    (lessonId: string) => {
      const ctx = findLessonContext(lessonId);
      if (ctx) {
        handleSelectLesson(ctx.lesson, ctx.chapter);
      }
    },
    [findLessonContext, handleSelectLesson]
  );

  const relatedLessons = useMemo(() => {
    if (!selectedLessonCtx) return [];
    return getRelatedLessons(catalog, roadmap.lessonConnections ?? [], selectedLessonCtx.course.slug, selectedLessonCtx.lesson.id);
  }, [catalog, roadmap.lessonConnections, selectedLessonCtx]);

  const relatedPractices = useMemo(() => {
    if (!selectedLessonCtx) return [];
    return getPracticesForLesson(practices, selectedLessonCtx.course.slug, selectedLessonCtx.lesson.id);
  }, [practices, selectedLessonCtx]);

  const previousLesson = lessonHistory.length ? findLessonContext(lessonHistory[lessonHistory.length - 1]) : null;

  const navigateFromLesson = useCallback((lessonId: string) => {
    if (!selectedLessonCtx || selectedLessonCtx.lesson.id === lessonId || !findLessonContext(lessonId)) return;
    setLessonHistory((history) => [...history.slice(-9), selectedLessonCtx.lesson.id]);
    handleSelectLessonById(lessonId);
  }, [findLessonContext, handleSelectLessonById, selectedLessonCtx]);

  const navigateBack = useCallback(() => {
    const previousId = lessonHistory[lessonHistory.length - 1];
    if (!previousId || !findLessonContext(previousId)) return;
    setLessonHistory((history) => history.slice(0, -1));
    handleSelectLessonById(previousId);
  }, [findLessonContext, handleSelectLessonById, lessonHistory]);

  // Search results keep source order and can be narrowed by state.
  const { matches: searchResults, total: searchTotal } = useMemo(
    () => searchLessonMatches(catalog, globalSearch, searchStatus, progress.lessons),
    [globalSearch, searchStatus, catalog, progress.lessons],
  );

  // Determine current active practice object for modal
  const activePractice = useMemo(() => {
    if (!activePracticeId) return null;
    return practices.find((p) => p.id === activePracticeId) ?? null;
  }, [activePracticeId, practices]);

  const errorBanner = errorState ? <ErrorBanner
    message={errorState.message}
    onRetry={errorState.retry}
    onDismiss={() => setErrorState(null)}
    retrying={retrying}
  /> : null;

  return (
    <div className={styles.appLayout}>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className={styles.mobileBackdrop}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        id="main-navigation"
        className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}
        aria-label="Thanh điều hướng chính"
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.brandWrap}>
            <Compass size={22} className={styles.brandIcon} aria-hidden="true" />
            <span className={styles.brandName}>Đường dựng</span>
          </div>
          {mode === "private" ? (
            <span className={styles.modeBadgePrivate} title="Phiên bản cá nhân lưu tiến độ riêng">
              Cá nhân
            </span>
          ) : (
            <span className={styles.modeBadgeDemo} title="Phiên bản thử nghiệm lưu trên trình duyệt">
              Demo
            </span>
          )}
          <button ref={closeMenuRef} className={styles.closeMobileMenu} type="button" aria-label="Đóng thanh điều hướng" onClick={() => setSidebarOpen(false)}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav className={styles.sidebarNav}>
          <div className={styles.navSection}>
            <h2 className={styles.navSectionHeading}>Lộ trình</h2>
            <button
              type="button"
              className={`${styles.navItem} ${activeView === "overview" ? styles.navItemActive : ""}`}
              onClick={() => {
                setActiveView("overview");
                setSelectedCourseSlug(null);
                setSidebarOpen(false);
              }}
              aria-current={activeView === "overview" ? "page" : undefined}
            >
              <div className={styles.navItemLeft}>
                <Compass size={16} aria-hidden="true" />
                <span>Tổng quan lộ trình</span>
              </div>
            </button>
            <button
              type="button"
              className={`${styles.navItem} ${activeView === "practices" ? styles.navItemActive : ""}`}
              onClick={() => {
                setActiveView("practices");
                setSelectedCourseSlug(null);
                setSidebarOpen(false);
              }}
              aria-current={activeView === "practices" ? "page" : undefined}
            >
              <div className={styles.navItemLeft}>
                <Award size={16} aria-hidden="true" />
                <span>Bài thực hành</span>
              </div>
              <span className={styles.navPill}>{overallStats.completedPractices}/{practices.length}</span>
            </button>
          </div>

          <div className={styles.navSection}>
            <h2 className={styles.navSectionHeading}>Giáo trình ({catalog.courses.length} khóa)</h2>
            {orderedCourses.map((course) => {
              const isSelected = activeView === "course" && selectedCourseSlug === course.slug;
              let courseCompleted = 0;
              course.chapters.forEach((ch) => {
                ch.lessons.forEach((l) => {
                  if (progress.lessons[l.id] === "completed") courseCompleted += 1;
                });
              });
              const isDone = course.lessonCount > 0 && courseCompleted === course.lessonCount;

              return (
                <button
                  key={course.slug}
                  type="button"
                  className={`${styles.navItem} ${isSelected ? styles.navItemActive : ""}`}
                  onClick={() => {
                    setSelectedCourseSlug(course.slug);
                    setActiveView("course");
                    setSidebarOpen(false);
                  }}
                  aria-current={isSelected ? "page" : undefined}
                >
                  <div className={styles.navItemLeft}>
                    <BookOpen size={15} aria-hidden="true" />
                    <span className={styles.courseNavTitle}>{course.title}</span>
                  </div>
                  <span className={`${styles.navPill} ${isDone ? styles.navPillDone : ""}`}>
                    {courseCompleted}/{course.lessonCount}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <footer className={styles.sidebarFooter}>
          {mode === "private" ? (
            <>
              <a href="/thu-thap" className={styles.settingsLink}>
                <Download size={16} aria-hidden="true" />
                <span>Thu thập liên kết phát</span>
              </a>
              <a href="/cai-dat" className={styles.settingsLink}>
                <Settings size={16} aria-hidden="true" />
                <span>Cài đặt tài khoản</span>
              </a>
            </>
          ) : (
            <div className={styles.demoAccountNotice}>
              <span>Chế độ thử nghiệm không yêu cầu đăng nhập. </span>
              {loginAvailable && <a href="/dang-nhap" className={styles.loginLink}>
                Đăng nhập
              </a>}
            </div>
          )}
        </footer>
      </aside>

      {/* Main Container */}
      <div className={styles.mainArea}>
        {/* Top Header */}
        <header className={styles.topHeader}>
          <div className={styles.headerLeft}>
            <button
              type="button"
              ref={menuButtonRef}
              className={styles.mobileMenuBtn}
              onClick={() => setSidebarOpen(true)}
              aria-label="Mở thanh điều hướng"
              aria-expanded={sidebarOpen}
              aria-controls="main-navigation"
            >
              <Menu size={20} aria-hidden="true" />
            </button>

            <div className={styles.globalSearchWrap}>
              <Search size={16} className={styles.globalSearchIcon} aria-hidden="true" />
              <input
                type="text"
                placeholder={`Tìm kiếm bài học trên ${catalog.courses.length} khóa (không dấu)...`}
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className={styles.globalSearchInput}
                aria-label="Tìm kiếm bài học toàn hệ thống"
              />
            </div>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.userGreetingWrap}>
              <span className={styles.userGreeting}>Xin chào, {userName}</span>
              <span className={styles.statsText}>
                {overallStats.completedLessons}/{catalog.lessonCount} bài ({overallStats.percent}%)
              </span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className={styles.contentArea}>
          {/* Global Search Results Overlay/View */}
          {globalSearch.trim() ? (
            <SearchResults
              query={globalSearch}
              status={searchStatus}
              matches={searchResults}
              total={searchTotal}
              progress={progress.lessons}
              onStatusChange={setSearchStatus}
              onSelect={({ lesson, chapter }) => handleSelectLesson(lesson, chapter)}
              onClear={() => { setGlobalSearch(""); setSearchStatus("all"); }}
            />
          ) : activeView === "overview" ? (
            <>
              {/* First Viewport: Welcome, Goal, Next Step & Practice Quick Cards */}
              <section className={styles.heroSection}>
                <div className={styles.heroHeader}>
                  <div>
                    <h1 className={styles.heroGreeting}>Không gian học dựng video của {userName}</h1>
                    <p className={styles.heroGoal}>
                      Làm từng bước, xem lại và cải thiện sản phẩm. Mở bài học liên quan đúng lúc bạn cần.
                    </p>
                  </div>
                </div>

                {mode === "demo" && (
                  <div className={styles.demoBanner} role="note">
                    <Info size={16} className={styles.demoBannerIcon} aria-hidden="true" />
                    <span>
                      <strong>Chế độ thử nghiệm:</strong> Tên khóa và bài đều là dữ liệu giả; tiến độ được lưu trên trình duyệt này.
                    </span>
                  </div>
                )}
                {mode === "private" && catalog.courses.length === 0 && (
                  <div className={styles.demoBanner} role="note">
                    <Info size={16} className={styles.demoBannerIcon} aria-hidden="true" />
                    <span>Chưa có danh mục bài học trên máy này. Bạn có thể thử dữ liệu mẫu hoặc nhập danh mục riêng theo hướng dẫn trong README.</span>
                  </div>
                )}

                {/* Next Step Action Card */}
                <div className={styles.nextStepCard}>
                  <div className={styles.nextStepLeft}>
                    <div className={styles.nextStepIconWrap}>
                      <PlayCircle size={22} aria-hidden="true" />
                    </div>
                    <div className={styles.nextStepContent}>
                      <span className={styles.nextStepTag}>Bước tiếp theo theo lộ trình</span>
                      <strong className={styles.nextStepTitle}>
                        {eliteCourse ? nextEliteLesson
                          ? `${progress.lessons[nextEliteLesson.id] === "in_progress" ? "Tiếp tục" : "Bắt đầu"}: ${nextEliteLesson.title}`
                          : eliteLessons.length ? "Bạn đã hoàn thành các bài Elite" : "Chưa có bài học trong giáo trình Elite"
                          : nextPractice
                          ? `${progress.practices[nextPractice.id] === "in_progress" ? "Tiếp tục" : "Bắt đầu"}: ${nextPractice.title}`
                          : !practices.length ? "Chưa có nhiệm vụ trong lộ trình"
                            : hasUnfinishedPractice ? "Các bước còn lại cần bạn chủ động chọn"
                              : "Bạn đã hoàn thành các bước trong lộ trình"}
                      </strong>
                      {eliteCourse && nextEliteLesson && <span className={styles.nextStepDescription}>Bài tiếp theo theo thứ tự giáo trình Elite.</span>}
                      {!eliteCourse && nextPractice && <span className={styles.nextStepDescription}>{nextPractice.target}</span>}
                      {!eliteCourse && !nextPractice && hasUnfinishedPractice && (
                        <span className={styles.nextStepDescription}>Xem các bước còn lại và chọn khi phù hợp với công việc thực tế của bạn.</span>
                      )}
                    </div>
                  </div>

                  {nextEliteLesson ? (
                    <button type="button" className={styles.nextStepActionBtn} onClick={() => handleSelectLessonById(nextEliteLesson.id)}>
                      Mở bài học <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  ) : !eliteCourse && nextPractice ? (
                    <button
                      type="button"
                      className={styles.nextStepActionBtn}
                      onClick={() => setActivePracticeId(nextPractice.id)}
                    >
                      <span>Mở việc cần làm</span>
                      <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  ) : practices.length ? (
                    <button type="button" className={styles.nextStepActionBtn} onClick={() => setActiveView("practices")}>
                      Xem lại các nhiệm vụ <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                {networkCourse && <button
                  type="button"
                  className={styles.lastLessonLink}
                  onClick={() => {
                    setSelectedCourseSlug(networkCourse.slug);
                    setActiveView("course");
                  }}
                >
                  <BookOpen size={15} aria-hidden="true" />
                  Khám phá bài học liên kết: {networkCourse.title}
                </button>}
                {lastOpenedContext && <button
                  type="button"
                  className={styles.lastLessonLink}
                  onClick={() => handleSelectLesson(lastOpenedContext.lesson, lastOpenedContext.chapter)}
                >
                  <BookOpen size={15} aria-hidden="true" />
                  Mở lại bài vừa xem: {lastOpenedContext.lesson.title}
                </button>}
                {nextUnfinishedLesson && <button
                  type="button"
                  className={styles.lastLessonLink}
                  onClick={() => handleSelectLesson(nextUnfinishedLesson.lesson, nextUnfinishedLesson.chapter)}
                >
                  <ArrowRight size={15} aria-hidden="true" />
                  Bài kế tiếp chưa hoàn thành: {nextUnfinishedLesson.lesson.title}
                </button>}
              </section>

              {/* Visual Interactive Roadmap.sh Style Diagram */}
              <RoadmapDiagram
                catalog={catalog}
                roadmap={roadmap}
                progress={progress}
                recommendedPracticeId={nextPracticeId}
                onSelectCourse={(slug) => {
                  setSelectedCourseSlug(slug);
                  setActiveView("course");
                }}
                onOpenPractice={(id) => setActivePracticeId(id)}
                onSelectLessonById={handleSelectLessonById}
                mode={mode}
              />
            </>
          ) : activeView === "course" && currentCourse ? (
            <CourseView
              key={currentCourse.slug}
              course={currentCourse}
              courseRoles={roadmap.courseRoles}
              progress={progress}
              onSelectLesson={(lesson, chapter) => handleSelectLesson(lesson, chapter)}
              onUpdateLessonState={handleUpdateLessonState}
              mode={mode}
              saving={saving || retrying || openingCount > 0 || !!errorState}
            />
          ) : activeView === "practices" ? (
            <section className={styles.practicesView}>
              <div className={styles.practicesHeadingArea}>
                <h1 className={styles.practicesHeading}>Các bài thực hành</h1>
                <p className={styles.practicesSubheading}>
                  Mỗi bước có hướng dẫn, đầu ra và học liệu liên quan. Bạn có thể làm trước hoặc quay lại bất kỳ bước nào.
                </p>
              </div>

              {roadmap.stages.map((stage) => {
                const stagePractices = stage.practiceIds
                  .map((id) => practices.find((practice) => practice.id === id))
                  .filter((practice): practice is (typeof practices)[number] => Boolean(practice));
                const completed = stagePractices.filter((practice) => progress.practices[practice.id] === "completed").length;
                return <section key={stage.id} className={styles.practiceStage} aria-labelledby={`practice-stage-${stage.id}`}>
                  <div className={styles.practiceStageHeader}>
                    <h2 id={`practice-stage-${stage.id}`} className={styles.practiceStageTitle}>
                      Chặng {stage.stageNumber}: {stage.title.replace(/^Chặng\s+\d+:\s*/i, "")}
                    </h2>
                    <span className={styles.practiceStageProgress}>{completed}/{stagePractices.length} hoàn thành</span>
                  </div>
                  <p className={styles.practicesSubheading}>{stage.description}</p>
                  <div className={styles.practiceQuickGrid}>
                {stagePractices.map((practice) => {
                  const currentState = progress.practices[practice.id] ?? "not_updated";

                  return (
                    <div key={practice.id} className={styles.practiceQuickCard}>
                      <div>
                        <div className={styles.practiceQuickTop}>
                          <span className={styles.practiceQuickBadge}>{practice.shortTitle}</span>
                          <span className={styles.practiceQuickDuration}>Mục tiêu: {practice.targetDuration}</span>
                        </div>
                        <h3 className={styles.practiceQuickTitle}>{practice.title}</h3>
                        <p className={styles.practiceQuickTarget}>{practice.target}</p>
                      </div>

                      <div className={styles.practiceQuickFooter}>
                        <button
                          type="button"
                          className={styles.openPracticeBtn}
                          onClick={() => setActivePracticeId(practice.id)}
                          aria-label={`Mở hướng dẫn: ${practice.title}`}
                        >
                          Mở hướng dẫn và tiêu chí
                          <ArrowRight size={14} aria-hidden="true" />
                        </button>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {currentState === "completed"
                            ? "Đã hoàn thành"
                            : currentState === "in_progress"
                            ? "Đang làm"
                            : "Chưa làm"}
                        </span>
                      </div>
                    </div>
                  );
                })}
                  </div>
                </section>;
              })}
            </section>
          ) : null}
        </div>
      </div>

      {/* Slide-over Lesson Detail */}
      {selectedLessonCtx && (
        <LessonDetail
          key={selectedLessonCtx.lesson.id}
          lesson={selectedLessonCtx.lesson}
          course={selectedLessonCtx.course}
          chapter={selectedLessonCtx.chapter}
          currentState={progress.lessons[selectedLessonCtx.lesson.id] ?? "not_updated"}
          mode={mode}
          sourceUrl={mode === "private" ? lessonSourceUrls?.[selectedLessonCtx.lesson.id] : undefined}
          saving={saving || retrying || openingCount > 0 || !!errorState}
          errorBanner={errorBanner}
          nextLessonTitle={nextSelectedLesson?.lesson.title}
          onNextLesson={nextSelectedLesson ? () => navigateFromLesson(nextSelectedLesson.lesson.id) : undefined}
          relatedLessons={relatedLessons}
          showRelatedLessons={relatedLessons.length > 0 || Boolean(roadmap.lessonConnections?.some((link) => link.from.courseSlug === selectedLessonCtx.course.slug))}
          onSelectRelatedLesson={navigateFromLesson}
          previousLessonTitle={previousLesson?.lesson.title}
          onPreviousLesson={previousLesson ? navigateBack : undefined}
          relatedPractices={relatedPractices}
          onOpenPractice={(practiceId) => {
            setReturnToLesson(selectedLessonCtx);
            setReturnToPracticeId(null);
            setSelectedLessonCtx(null);
            setLessonHistory([]);
            setActivePracticeId(practiceId);
          }}
          onStateChange={(state) => handleUpdateLessonState(selectedLessonCtx.lesson.id, state)}
          onClose={() => {
            setSelectedLessonCtx(null);
            setLessonHistory([]);
            if (returnToPracticeId) {
              setActivePracticeId(returnToPracticeId);
              setReturnToPracticeId(null);
            }
          }}
        />
      )}

      {/* Modal Practice Brief */}
      {activePractice && (
        <PracticeBrief
          practice={activePractice}
          catalog={catalog}
          currentState={progress.practices[activePractice.id] ?? "not_updated"}
          mode={mode}
          saving={saving || retrying || openingCount > 0 || !!errorState}
          errorBanner={errorBanner}
          backLink={entryLessonId && !returnToLesson && findLessonContext(entryLessonId)
            ? { href: `/bai-hoc/${entryLessonId}${mode === "demo" ? "?demo=1" : ""}`, label: "Quay lại bài học" }
            : undefined}
          onBack={returnToLesson ? () => {
            setActivePracticeId(null);
            setSelectedLessonCtx(returnToLesson);
            setReturnToLesson(null);
          } : undefined}
          onStateChange={(state) => handleUpdatePracticeState(activePractice.id, state)}
          onSelectLesson={(lessonId) => {
            setReturnToPracticeId(activePractice.id);
            setReturnToLesson(null);
            setActivePracticeId(null);
            handleSelectLessonById(lessonId);
          }}
          onClose={() => {
            setActivePracticeId(null);
            if (returnToLesson) {
              setSelectedLessonCtx(returnToLesson);
              setReturnToLesson(null);
            }
          }}
        />
      )}

      {/* Error Retry Banner */}
      {!selectedLessonCtx && !activePractice && errorBanner}
    </div>
  );
}
