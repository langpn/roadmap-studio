"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  FileCheck2,
  FileText,
  Home,
  Info,
  ShieldAlert,
} from "lucide-react";
import type { Chapter, Course, Lesson } from "@/lib/catalog/normalize";
import type { RelatedLesson } from "@/lib/catalog/lesson-links";
import type { LessonPractice } from "@/lib/catalog/lesson-practices";
import type { LessonMediaKind } from "@/lib/media/lesson-media-map";
import type { ProgressState } from "@/lib/progress/store";
import { readDemoProgress, writeDemoProgress } from "@/lib/progress/demo";
import { RelatedPractices } from "@/components/related-practices";
import { formatLearningContext } from "@/lib/learning-context";
import styles from "./lesson-study.module.css";

const LessonMediaPlayer = dynamic(() => import("@/components/lesson-media-player"), {
  ssr: false,
  loading: () => <p className={styles.playerLoading}>Đang mở video bài học…</p>,
});

const DemoPlayer = dynamic(() => import("@/components/lesson-player"), {
  ssr: false,
  loading: () => <p className={styles.playerLoading}>Đang mở trình phát mẫu…</p>,
});

export type LessonStudyViewProps = {
  mode: "private" | "demo";
  accountId?: string;
  homeHref: string;
  /** Giữ ?demo=1 trên mọi liên kết bài học của bản thử nghiệm. */
  studySuffix?: string;
  lesson: Lesson;
  course: Course;
  chapter: Chapter;
  position: number;
  total: number;
  previousLesson: Lesson | null;
  nextLesson: Lesson | null;
  initialState: ProgressState;
  initialVersion: string | null;
  /** Thông báo khi dữ liệu phụ (tiến độ, media) không đọc được nhưng bài vẫn mở. */
  loadNotice?: string;
  media: { kind: LessonMediaKind; embedUrl: string } | null;
  sourceUrl?: string;
  relatedLessons: RelatedLesson[];
  relatedPractices?: LessonPractice[];
  /** Nơi mở bảng lộ trình kèm thực hành; bản cá nhân dùng "/", demo dùng "/demo". */
  roadmapHref?: string;
};

type Notice = { message: string; retry?: () => void };

const accountChangedMessage = "Tài khoản đăng nhập đã thay đổi. Hãy tải lại trang trước khi tiếp tục.";
const outdatedPageMessage = "Trang này đã cũ. Hãy tải lại trang trước khi cập nhật tiến độ.";
const saveFailedMessage = "Không xác nhận được việc lưu tiến độ. Kiểm tra kết nối rồi thử lại.";

const relatedGroups: { label: string; pick: (item: RelatedLesson) => boolean }[] = [
  { label: "Nền tảng", pick: (item) => item.direction === "outgoing" && item.kind === "foundation" },
  { label: "Bổ trợ", pick: (item) => item.direction === "outgoing" && item.kind === "support" },
  { label: "Tìm hiểu sâu", pick: (item) => item.direction === "outgoing" && item.kind === "advanced" },
  { label: "Bài liên kết đến đây", pick: (item) => item.direction === "incoming" },
];

function kindLabel(lesson: Lesson): string {
  if (lesson.typeEvidence === "catalog_list") return "Loại theo danh mục, chưa mở trang";
  return lesson.kind === "reading" ? "Bài đọc" : "Chưa xác minh định dạng";
}

export function LessonStudyView({
  mode,
  accountId,
  homeHref,
  studySuffix = "",
  lesson,
  course,
  chapter,
  position,
  total,
  previousLesson,
  nextLesson,
  initialState,
  initialVersion,
  loadNotice,
  media,
  sourceUrl,
  relatedLessons,
  relatedPractices = [],
  roadmapHref = "/",
}: LessonStudyViewProps) {
  const [state, setState] = useState<ProgressState>(initialState);
  const [saving, setSaving] = useState(false);
  // Bản cá nhân đang ghi nhận lượt mở bài; khóa nút cho tới khi có phiên bản mới.
  const [opening, setOpening] = useState(mode === "private");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [copyResult, setCopyResult] = useState<{ id: string; status: "copied" | "manual"; text: string } | null>(null);
  const copyStatus = copyResult?.id === lesson.id ? copyResult.status : "idle";
  const versionRef = useRef<string | null>(initialVersion);

  // Ghi nhận bài vừa mở để lộ trình gợi ý đúng; lỗi ở đây không chặn việc học.
  useEffect(() => {
    function readLocalProgress() {
      try {
        writeDemoProgress(localStorage, { kind: "opened", id: lesson.id });
        // Ảnh chụp tiến độ chỉ có ở trình duyệt, nên đọc sau khi tải để HTML đầu tiên không đổi.
        const lessonState = readDemoProgress(localStorage, { lessons: {}, practices: {}, lastOpenedLessonId: null }).lessons[lesson.id];
        queueMicrotask(() => setState(lessonState ?? "not_updated"));
      } catch { /* bộ nhớ trình duyệt bị chặn */ }
    }
    if (mode === "demo") {
      readLocalProgress();
      return;
    }
    let active = true;
    const versionAtOpen = initialVersion;
    void fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Roadmap-Account": accountId ?? "" },
      body: JSON.stringify({ kind: "opened", id: lesson.id }),
    }).then(async (response) => {
      if (!active) return;
      if (response.status === 409) { setNotice({ message: accountChangedMessage }); return; }
      if (!response.ok) return;
      const body = await response.json().catch(() => null) as { lesson?: { state?: ProgressState; version?: unknown } } | null;
      if (typeof body?.lesson?.version !== "string") { setNotice({ message: outdatedPageMessage }); return; }
      if (versionRef.current === versionAtOpen) {
        versionRef.current = body.lesson.version;
        if (body.lesson.state) setState(body.lesson.state);
      }
    }).catch(() => undefined).finally(() => { if (active) setOpening(false); });
    return () => { active = false; };
  }, [mode, accountId, lesson.id, initialState, initialVersion]);

  async function saveLessonState(next: ProgressState, expectedVersion: string | null): Promise<void> {
    setSaving(true);
    setNotice(null);
    try {
      if (mode === "demo") {
        try {
          writeDemoProgress(localStorage, { kind: "lesson", id: lesson.id, state: next });
        } catch {
          setNotice({ message: "Không thể lưu tiến độ trên trình duyệt. Hãy kiểm tra cài đặt lưu trữ rồi thử lại." });
          return;
        }
        setState(next);
        return;
      }

      const response = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Roadmap-Account": accountId ?? "" },
        body: JSON.stringify({ kind: "lesson", id: lesson.id, state: next, expectedVersion }),
      });
      if (response.status === 409) {
        const body = await response.json().catch(() => null) as {
          code?: string;
          current?: { state?: ProgressState; version?: string } | null;
        } | null;
        if (body?.code === "PROGRESS_CONFLICT") {
          versionRef.current = body.current?.version ?? null;
          setState(body.current?.state ?? "not_updated");
          setNotice({ message: "Tiến độ đã thay đổi ở nơi khác. Đã hiển thị trạng thái đã lưu; hãy xem lại trước khi chọn tiếp." });
        } else {
          setNotice({ message: body?.code === "ACCOUNT_CHANGED" ? accountChangedMessage : outdatedPageMessage });
        }
        return;
      }
      if (!response.ok) throw new Error(`Máy chủ trả về trạng thái ${response.status}`);
      const body = await response.json().catch(() => null) as { version?: unknown } | null;
      if (typeof body?.version !== "string") {
        setNotice({ message: outdatedPageMessage });
        return;
      }
      setState(next);
      versionRef.current = body.version;
    } catch {
      setNotice({ message: saveFailedMessage, retry: () => { void saveLessonState(next, expectedVersion); } });
    } finally {
      setSaving(false);
    }
  }

  function chooseState(next: ProgressState) {
    if (next === state || saving || opening) return;
    void saveLessonState(next, versionRef.current);
  }

  const safeTitle = lesson.title.trim() || "bài học";
  // Vị trí trong chương tính theo mảng nguồn, không dùng position đã lưu vì có thể lệch sau khi nhập lại.
  const chapterPosition = chapter.lessons.findIndex((entry) => entry.id === lesson.id) + 1;
  const groups = relatedGroups
    .map((group) => ({ label: group.label, items: relatedLessons.filter(group.pick) }))
    .filter((group) => group.items.length > 0);
  const stateClasses: Record<ProgressState, string> = {
    not_updated: styles.stateActiveNotUpdated,
    in_progress: styles.stateActiveInProgress,
    completed: styles.stateActiveCompleted,
  };
  const stateOptions: { value: ProgressState; label: string; icon: React.ReactNode }[] = [
    { value: "not_updated", label: "Chưa học", icon: <Circle size={16} aria-hidden="true" /> },
    { value: "in_progress", label: "Đang học", icon: <Clock size={16} aria-hidden="true" /> },
    { value: "completed", label: "Đã hoàn thành", icon: <CheckCircle2 size={16} aria-hidden="true" /> },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topBarInner}>
          <Link className={styles.backLink} href={homeHref}>
            <ArrowLeft size={16} aria-hidden="true" />
            Về lộ trình
          </Link>
          <span className={styles.modeBadge}>{mode === "demo" ? "Bản thử nghiệm" : "Bản cá nhân"}</span>
        </div>
      </header>

      <main className={styles.main}>
        <nav className={styles.breadcrumb} aria-label="Vị trí bài học">
          <span className={styles.breadcrumbCourse}>{course.title}</span>
          <span aria-hidden="true" className={styles.breadcrumbDivider}>/</span>
          <span>{chapter.title}</span>
        </nav>

        <div className={styles.titleBlock}>
          <h1 className={styles.title}>{lesson.title}</h1>
          <p className={styles.meta}>
            <span>{total > 0 ? `Bài ${position}/${total} trong khóa` : "Bài học"}</span>
            <span aria-hidden="true">·</span>
            <span>{kindLabel(lesson)}</span>
            {lesson.duration && <><span aria-hidden="true">·</span><span>{lesson.duration}</span></>}
          </p>
          {lesson.titleWithheld && (
            <p className={styles.withheld} role="note">
              <ShieldAlert size={16} aria-hidden="true" />
              Danh mục đã lưu chưa có tiêu đề gốc. Hãy cập nhật danh mục khi có tệp nguồn.
            </p>
          )}
        </div>

        {loadNotice && (
          <p className={styles.loadNotice} role="status">{loadNotice}</p>
        )}

        {mode === "demo" ? (
          <section className={styles.playerCard} aria-label="Video mẫu của bản thử nghiệm">
            <DemoPlayer />
            <p className={styles.playerNote}>
              Video mẫu chỉ để thử trình phát. Bài học, khóa học và tiến độ trong bản thử nghiệm đều là dữ liệu giả;
              liên kết ra website khóa học bị khóa.
            </p>
          </section>
        ) : media ? (
          <div className={styles.playerCard}>
            <LessonMediaPlayer
              lessonId={lesson.id}
              title={safeTitle}
              kind={media.kind}
              embedUrl={media.embedUrl}
              sourceUrl={sourceUrl}
            />
          </div>
        ) : (
          <section className={styles.emptyPlayer} aria-labelledby="lesson-video-title">
            <h2 id="lesson-video-title" className={styles.sectionHeading}>Video bài học</h2>
            <p className={styles.sectionText}>
              {lesson.kind === "reading"
                ? "Bài này là bài đọc trên website gốc nên không có video riêng."
                : "Chưa có liên kết phát cho bài này. Ứng dụng chưa nhúng được trình phát; bạn vẫn xem được bài trên website gốc nếu có liên kết bên dưới."}
            </p>
            {sourceUrl && (
              <a className={styles.sourceLink} href={sourceUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} aria-hidden="true" />
                Mở trang bài gốc
              </a>
            )}
            <a className={styles.textLink} href="/thu-thap">
              Cách thêm liên kết phát <ArrowRight size={15} aria-hidden="true" />
            </a>
          </section>
        )}

        <section className={styles.stateRow} aria-labelledby="lesson-state-title">
          <h2 id="lesson-state-title" className={styles.stateHeading}>Tiến độ của bạn</h2>
          <div className={styles.stateButtons} role="group" aria-label="Chọn trạng thái bài học">
            {stateOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.stateButton} ${state === option.value ? stateClasses[option.value] : ""}`}
                onClick={() => chooseState(option.value)}
                disabled={saving || opening}
                aria-pressed={state === option.value}
              >
                {option.icon}
                <span>{option.label}</span>
              </button>
            ))}
          </div>
          {mode === "demo" && <p className={styles.hint}>Tiến độ thử nghiệm chỉ lưu trên trình duyệt này.</p>}
        </section>

        {notice && (
          <div className={styles.notice} role="alert" aria-label="Thông báo lưu tiến độ">
            <span>{notice.message}</span>
            {notice.retry && (
              <button type="button" className={styles.retryButton} onClick={notice.retry} disabled={saving}>
                {saving ? "Đang thử lại…" : "Thử lại"}
              </button>
            )}
          </div>
        )}

        <div className={styles.columns}>
          <div className={styles.primaryColumn}>
            <section className={styles.section} aria-labelledby="lesson-summary-title">
              <h2 id="lesson-summary-title" className={styles.sectionHeading}>Mô tả bài</h2>
              {lesson.summary ? (
                <div className={styles.summaryCard}>
                  <p className={styles.summaryBadge}>
                    <FileCheck2 size={16} aria-hidden="true" />
                    Đã đối chiếu phần chữ trên trang
                  </p>
                  <p className={styles.sectionText}>{lesson.summary}</p>
                  {lesson.summaryEvidence && <p className={styles.evidence}>Tài liệu nguồn đối chiếu: {lesson.summaryEvidence}</p>}
                </div>
              ) : (
                <p className={styles.emptySummary}>
                  {mode === "demo"
                    ? "Đây là bài mẫu, chưa có mô tả đối chiếu."
                    : "Chưa có mô tả đã đối chiếu chữ; bạn vẫn có thể mở trang bài gốc để xem tài liệu."}
                </p>
              )}
              <p className={styles.hint}>Thông tin lấy từ phần chữ trên trang bài học, không phải nội dung video.</p>
              <button type="button" className={styles.copyContext} onClick={async () => {
                const learningContext = formatLearningContext(course, lesson, relatedPractices, mode === "demo", window.location.origin);
                try {
                  await navigator.clipboard.writeText(learningContext);
                  setCopyResult({ id: lesson.id, status: "copied", text: learningContext });
                } catch {
                  setCopyResult({ id: lesson.id, status: "manual", text: learningContext });
                }
              }}>Sao chép ngữ cảnh cho Obsidian / AI</button>
              <p className={styles.hint} role={copyStatus === "idle" ? undefined : "status"}>{copyStatus === "copied" ? "Đã sao chép. Hãy dán vào ghi chú của bạn." : copyStatus === "manual" ? "Không thể sao chép tự động. Chọn và sao chép nội dung bên dưới." : "Bạn tự bổ sung trải nghiệm; ứng dụng không tự gửi nội dung ra ngoài."}</p>
              {copyStatus === "manual" && <textarea className={styles.contextText} aria-label="Ngữ cảnh bài học để sao chép" readOnly value={copyResult?.text ?? ""} onFocus={(event) => event.currentTarget.select()} />}
            </section>

            {mode === "private" && (
              <section className={styles.section} aria-labelledby="lesson-source-title">
                <h2 id="lesson-source-title" className={styles.sectionHeading}>Tài liệu trên website gốc</h2>
                {sourceUrl ? (
                  <>
                    <p className={styles.sectionText}>
                      Trang gốc dùng phiên đăng nhập riêng của bạn và mở trong thẻ mới; ứng dụng không đọc cookie hay mật khẩu.
                    </p>
                    <a className={styles.sourceLink} href={sourceUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={16} aria-hidden="true" />
                      Mở bài học trên website gốc
                    </a>
                  </>
                ) : (
                  <p className={styles.emptySummary}>Không có liên kết bài học hợp lệ trong danh mục.</p>
                )}
              </section>
            )}

            {mode === "demo" && (
              <section className={styles.section} aria-labelledby="lesson-demo-source-title">
                <h2 id="lesson-demo-source-title" className={styles.sectionHeading}>Tài liệu trên website gốc</h2>
                <p className={styles.emptySummary}>
                  Bản thử nghiệm không mở liên kết ra website khóa học. Dùng bản cá nhân khi bạn cần xem bài gốc.
                </p>
              </section>
            )}
          </div>

          <aside className={styles.sideColumn} aria-label="Nội dung liên quan">
            {relatedPractices.length > 0 && (
              <RelatedPractices
                items={relatedPractices}
                headingLevel={2}
                hrefFor={(practiceId) => `${roadmapHref}?practice=${encodeURIComponent(practiceId)}&lesson=${encodeURIComponent(lesson.id)}`}
              />
            )}
            {groups.length > 0 ? (
              <section className={styles.section} aria-labelledby="lesson-related-title">
                <h2 id="lesson-related-title" className={styles.sectionHeading}>Bài học liên kết</h2>
                <p className={styles.hint}>Gợi ý tham khảo; mức bằng chứng ghi ở từng mục, chưa mục nào xác minh nội dung video.</p>
                {groups.map((group) => (
                  <div key={group.label} className={styles.relatedGroup}>
                    <h3 className={styles.relatedHeading}>{group.label} <span>({group.items.length})</span></h3>
                    <ul className={styles.relatedList}>
                      {group.items.map((item) => (
                        <li key={`${item.lesson.courseSlug}:${item.lesson.id}`} className={styles.relatedItem}>
                          <span className={styles.relatedCourse}>{item.courseTitle}</span>
                          <Link className={styles.relatedLink} href={`/bai-hoc/${item.lesson.id}${studySuffix}`} target="_blank" rel="noopener noreferrer">
                            <span>{item.lesson.title}</span>
                            <ArrowRight size={15} aria-hidden="true" />
                          </Link>
                          <p className={styles.relatedReason}>{item.reason}</p>
                          <p className={styles.relatedReason}>{item.basisLabel}{item.evidence ? ` — ${item.evidence}` : ""}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ) : (
              <section className={styles.section} aria-labelledby="lesson-related-empty-title">
                <h2 id="lesson-related-empty-title" className={styles.sectionHeading}>Bài học liên kết</h2>
                <p className={styles.emptySummary}>Chưa có bài liên kết gợi ý cho bài này.</p>
              </section>
            )}

            <section className={styles.section} aria-labelledby="lesson-info-title">
              <h2 id="lesson-info-title" className={styles.sectionHeading}>Thông tin bài</h2>              <dl className={styles.infoList}>
                <div className={styles.infoRow}><dt>Khóa học</dt><dd>{course.title}</dd></div>
                <div className={styles.infoRow}><dt>Chương</dt><dd>{chapter.title}</dd></div>
                <div className={styles.infoRow}><dt>Vị trí trong chương</dt><dd>Bài {chapterPosition}/{chapter.lessons.length}</dd></div>
                <div className={styles.infoRow}>
                  <dt>Định dạng ghi nhận</dt>
                  <dd><FileText size={14} aria-hidden="true" /> {kindLabel(lesson)}</dd>
                </div>
                {lesson.duration && <div className={styles.infoRow}><dt>Thời lượng hiển thị</dt><dd>{lesson.duration}</dd></div>}
              </dl>
              <p className={styles.hint}><Info size={14} aria-hidden="true" /> Định dạng và thời lượng lấy theo danh mục; chưa xem nội dung video.</p>
            </section>
          </aside>
        </div>

        <nav className={styles.lessonNav} aria-label="Chuyển bài học">
          {previousLesson ? (
            <Link className={`${styles.navLink} ${styles.navPrevious}`} href={`/bai-hoc/${previousLesson.id}${studySuffix}`}>
              <span className={styles.navLabel}><ArrowLeft size={15} aria-hidden="true" /> Bài trước</span>
              <span className={styles.navTitle}>{previousLesson.title}</span>
            </Link>
          ) : <span className={styles.navPlaceholder} />}
          <Link className={`${styles.navLink} ${styles.navHome}`} href={homeHref}>
            <Home size={15} aria-hidden="true" />
            Về lộ trình
          </Link>
          {nextLesson ? (
            <Link className={`${styles.navLink} ${styles.navNext}`} href={`/bai-hoc/${nextLesson.id}${studySuffix}`}>
              <span className={styles.navLabel}>Bài tiếp <ArrowRight size={15} aria-hidden="true" /></span>
              <span className={styles.navTitle}>{nextLesson.title}</span>
            </Link>
          ) : <span className={styles.navPlaceholder} />}
        </nav>
      </main>
    </div>
  );
}
