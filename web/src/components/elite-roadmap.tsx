"use client";

import { useId, useMemo, useState } from "react";
import { ArrowRight, BookOpen, Check, ChevronDown, Flag, LayoutGrid, List } from "lucide-react";
import type { Lesson } from "@/lib/catalog/normalize";
import type { ProgressState } from "@/lib/progress/store";
import type { PracticeBriefData } from "./roadmap-data";
import type { RoadmapDiagramProps } from "./roadmap-diagram";
import styles from "./elite-roadmap.module.css";

type Node = { kind: "lesson"; lesson: Lesson } | { kind: "practice"; practice: PracticeBriefData; milestone: boolean };

function stateLabel(state: ProgressState | undefined, practice = false) {
  if (state === "completed") return "Đã hoàn thành";
  if (state === "in_progress") return practice ? "Đang thực hiện" : "Đang học";
  return practice ? "Chưa thực hiện" : "Chưa học";
}

export function EliteRoadmap({ catalog, roadmap, progress, onSelectCourse, onOpenPractice, onSelectLessonById }: RoadmapDiagramProps) {
  const id = useId();
  const course = catalog.courses.find((item) => item.slug === "elite");
  const lessons = useMemo(() => course?.chapters.flatMap((chapter) => chapter.lessons) ?? [], [course]);
  const nextLesson = lessons.find((lesson) => progress.lessons[lesson.id] !== "completed");
  const initialChapter = course?.chapters.find((chapter) => chapter.lessons.some((lesson) => lesson.id === nextLesson?.id))?.id
    ?? course?.chapters[0]?.id;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initialChapter ? [initialChapter] : []));
  const [view, setView] = useState<"path" | "list">("path");

  const nodesByChapter = useMemo(() => {
    const indexById = new Map(lessons.map((lesson, index) => [lesson.id, index]));
    const checkpoints = new Map<string, PracticeBriefData[]>();
    const stageMilestones = new Set(roadmap.stages.map((stage) => stage.milestonePracticeId).filter(Boolean));
    for (const practice of roadmap.practices) {
      const related = practice.shortcutLessonIds
        .filter((link) => link.courseSlug === "elite" && indexById.has(link.id))
        .sort((a, b) => indexById.get(b.id)! - indexById.get(a.id)!);
      const anchor = related[0]?.id;
      if (anchor) checkpoints.set(anchor, [...(checkpoints.get(anchor) ?? []), practice]);
    }
    return (course?.chapters ?? []).map((chapter) => ({
      chapter,
      nodes: chapter.lessons.flatMap<Node>((lesson) => [
        { kind: "lesson", lesson },
        ...(checkpoints.get(lesson.id) ?? []).map((practice): Node => ({
          kind: "practice", practice, milestone: practice.kind === "milestone" || stageMilestones.has(practice.id),
        })),
      ]),
    }));
  }, [course, lessons, roadmap.practices, roadmap.stages]);

  const relatedCounts = useMemo(() => {
    const valid = new Set(catalog.courses.flatMap((item) => item.chapters.flatMap((chapter) =>
      chapter.lessons.map((lesson) => `${item.slug}\0${lesson.id}`))));
    const related = new Map<string, Set<string>>();
    for (const link of roadmap.lessonConnections ?? []) {
      const from = `${link.from.courseSlug}\0${link.from.lessonId}`;
      const to = `${link.to.courseSlug}\0${link.to.lessonId}`;
      if (from === to || !valid.has(from) || !valid.has(to)) continue;
      if (link.from.courseSlug === "elite") related.set(link.from.lessonId, new Set([...(related.get(link.from.lessonId) ?? []), to]));
      if (link.to.courseSlug === "elite") related.set(link.to.lessonId, new Set([...(related.get(link.to.lessonId) ?? []), from]));
    }
    return related;
  }, [catalog.courses, roadmap.lessonConnections]);

  if (!course) return <section className={styles.empty} aria-label="Lộ trình Elite">
    <h2>Chưa có giáo trình Elite</h2>
    <p>Hãy nhập danh mục có khóa Elite để xem lộ trình theo từng bài học.</p>
  </section>;

  const completed = lessons.filter((lesson) => progress.lessons[lesson.id] === "completed").length;
  return (
    <section className={styles.journey} data-view={view} aria-labelledby={`${id}-heading`}>
      <svg className={styles.definitions} aria-hidden="true"><defs>
        <linearGradient id={`${id}-ribbon`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#eff6ff" /><stop offset=".45" stopColor="#8b9bff" /><stop offset="1" stopColor="#5146bd" />
        </linearGradient>
      </defs></svg>
      <div className={styles.intro}>
        <div className={styles.introCopy}>
          <h2 id={`${id}-heading`}>Lộ trình Elite</h2>
          <p>{course.title}</p>
          <div className={styles.introMeta}>
            <span><BookOpen size={16} aria-hidden="true" /> {lessons.length} bài học · {course.chapters.length} chương</span>
            <span><Check size={16} aria-hidden="true" /> {completed}/{lessons.length} đã hoàn thành</span>
          </div>
        </div>
        <div className={styles.orbit} aria-hidden="true"><span /><span /></div>
        <button type="button" className={styles.courseLink} onClick={() => onSelectCourse(course.slug)}>
          Xem giáo trình <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.toolbar}>
        <p>Bài học theo thứ tự giáo trình · Bài tự luyện là gợi ý tham khảo</p>
        <div className={styles.viewToggle} role="group" aria-label="Kiểu hiển thị lộ trình">
          <button type="button" aria-pressed={view === "path"} onClick={() => setView("path")}><LayoutGrid size={16} aria-hidden="true" /> Lộ trình</button>
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={16} aria-hidden="true" /> Danh sách</button>
        </div>
      </div>

      <div className={styles.chapters}>
        {nodesByChapter.map(({ chapter, nodes }, chapterIndex) => {
          const isOpen = expanded.has(chapter.id);
          const done = chapter.lessons.filter((lesson) => progress.lessons[lesson.id] === "completed").length;
          const contentId = `${id}-chapter-${chapterIndex}`;
          return <section className={styles.chapter} key={chapter.id}>
            <h3 className={styles.chapterHeading}>
              <button type="button" className={styles.chapterToggle} aria-expanded={isOpen} aria-controls={contentId}
                onClick={() => setExpanded((previous) => {
                  const next = new Set(previous);
                  if (next.has(chapter.id)) next.delete(chapter.id); else next.add(chapter.id);
                  return next;
                })}>
                <span className={styles.chapterIndex}>{String(chapterIndex + 1).padStart(2, "0")}</span>
                <span className={styles.chapterName}>{chapter.title}<span>{done}/{chapter.lessons.length} bài hoàn thành</span></span>
                <ChevronDown className={isOpen ? styles.chevronOpen : ""} size={20} aria-hidden="true" />
              </button>
            </h3>
            <div id={contentId} hidden={!isOpen}>
              {nodes.length ? <ol className={styles.nodes}>
                {nodes.map((node) => {
                  const isLesson = node.kind === "lesson";
                  const nodeId = isLesson ? node.lesson.id : node.practice.id;
                  const state = isLesson ? progress.lessons[nodeId] : progress.practices[nodeId];
                  const isNext = isLesson && nodeId === nextLesson?.id;
                  const related = isLesson ? relatedCounts.get(nodeId)?.size ?? 0 : 0;
                  return <li className={styles.node} key={`${node.kind}-${nodeId}`}>
                    <span className={styles.thread} aria-hidden="true">
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                        <path d="M50 0 C23 16 23 34 50 50 C77 66 77 84 50 100" className={styles.threadShadow} />
                        <path d="M50 0 C23 16 23 34 50 50 C77 66 77 84 50 100" stroke={`url(#${id}-ribbon)`} className={styles.threadColor} />
                        <path d="M50 0 C23 16 23 34 50 50 C77 66 77 84 50 100" className={styles.threadLight} />
                      </svg>
                      <span className={`${styles.nodeDot} ${state === "completed" ? styles.nodeDotDone : ""}`} />
                    </span>
                    <button type="button" className={`${styles.nodeCard} ${!isLesson ? styles.checkpoint : ""} ${isNext ? styles.nextNode : ""}`}
                      onClick={() => isLesson ? onSelectLessonById(node.lesson.id) : onOpenPractice(node.practice.id)}>
                      <span className={styles.nodeMeta}>
                        <span>{isLesson ? node.lesson.kind === "reading" ? "Bài đọc" : node.lesson.kind === "video" ? "Bài học" : "Chưa rõ loại" : node.milestone ? "Mốc tự luyện" : "Bài tự luyện"}</span>
                        <span className={state === "completed" ? styles.done : ""}>{stateLabel(state, !isLesson)}</span>
                      </span>
                      <strong>{isLesson ? node.lesson.title : node.practice.title}</strong>
                      <span className={styles.nodeFoot}>
                        <span>{isLesson ? [node.lesson.duration, related ? `${related} bài liên quan` : ""].filter(Boolean).join(" · ") : "Gợi ý thực hành"}</span>
                        <span>{isLesson ? "Xem bài" : "Xem hướng dẫn"} <ArrowRight size={15} aria-hidden="true" /></span>
                      </span>
                      {isNext && <span className={styles.nextPill}>Bước tiếp theo</span>}
                      {!isLesson && <Flag className={styles.flag} size={17} aria-hidden="true" />}
                    </button>
                  </li>;
                })}
              </ol> : <p className={styles.noLessons}>Chưa có bài học trong chương này.</p>}
            </div>
          </section>;
        })}
      </div>
    </section>
  );
}
