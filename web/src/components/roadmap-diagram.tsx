"use client";

import React, { useState } from "react";
import { ArrowRight, CheckCircle2, ChevronDown, Circle, Clock, LayoutGrid, List } from "lucide-react";
import type { Catalog } from "@/lib/catalog/normalize";
import type { Progress, ProgressState } from "@/lib/progress/store";
import type { PracticeBriefData, RoadmapConfig } from "./roadmap-data";
import styles from "./roadmap-diagram.module.css";
import { EliteRoadmap } from "./elite-roadmap";

export interface RoadmapDiagramProps {
  catalog: Catalog;
  roadmap: RoadmapConfig;
  progress: Progress;
  onSelectCourse: (courseSlug: string) => void;
  onOpenPractice: (practiceId: string) => void;
  onSelectLessonById: (lessonId: string) => void;
  mode: "private" | "demo";
  recommendedPracticeId?: string | null;
}

function PracticeStatus({ state }: { state: ProgressState }) {
  if (state === "completed") {
    return <span className={styles.statusCompleted}><CheckCircle2 size={14} aria-hidden="true" /> Đã hoàn thành</span>;
  }
  if (state === "in_progress") {
    return <span className={styles.statusInProgress}><Clock size={14} aria-hidden="true" /> Đang thực hiện</span>;
  }
  return <span className={styles.statusNotUpdated}><Circle size={14} aria-hidden="true" /> Chưa thực hiện</span>;
}

export function RoadmapDiagram(props: RoadmapDiagramProps) {
  if (props.mode === "private") return <EliteRoadmap {...props} />;
  return <PracticeRoadmap {...props} />;
}

function PracticeRoadmap({
  roadmap,
  progress,
  onOpenPractice,
  mode,
  recommendedPracticeId,
}: RoadmapDiagramProps) {
  const [viewMode, setViewMode] = useState<"diagram" | "list">("diagram");
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(() => new Set());
  const practicesById = new Map(roadmap.practices.map((practice) => [practice.id, practice]));
  const stages = roadmap.stages.map((stage) => {
    const practices = (stage.practiceIds ?? [])
      .map((id) => practicesById.get(id))
      .filter((practice): practice is PracticeBriefData => practice !== undefined);
    const completed = practices.filter((practice) => progress.practices[practice.id] === "completed").length;
    return { stage, practices, completed };
  });

  return (
    <div className={styles.roadmapWrapper}>
      <div className={styles.topControlRow}>
        <div className={styles.headingArea}>
          <div className={styles.headingTitleRow}>
            <h2 className={styles.roadmapHeading}>Lộ trình học theo từng chặng</h2>
            {mode === "demo" && <span className={styles.demoBadgeSmall}>Bản thử nghiệm</span>}
          </div>
          <p className={styles.roadmapSubheading}>Chọn một bước để xem hướng dẫn và theo dõi tiến độ thực hành.</p>
        </div>

        <div className={styles.viewToggleGroup} role="group" aria-label="Kiểu hiển thị lộ trình">
          <button
            type="button"
            className={`${styles.viewToggleButton} ${viewMode === "diagram" ? styles.viewToggleActive : ""}`}
            onClick={() => setViewMode("diagram")}
            aria-pressed={viewMode === "diagram"}
          >
            <LayoutGrid size={15} aria-hidden="true" /> Sơ đồ trực quan
          </button>
          <button
            type="button"
            className={`${styles.viewToggleButton} ${viewMode === "list" ? styles.viewToggleActive : ""}`}
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
          >
            <List size={15} aria-hidden="true" /> Danh sách bước
          </button>
        </div>
      </div>

      <div className={`${styles.stageSequence} ${viewMode === "diagram" ? styles.diagramView : styles.listView}`}>
        {stages.map(({ stage, practices, completed }, stageIndex) => {
          const collapsed = collapsedStages.has(stage.id);
          const contentId = `roadmap-stage-${stage.id}`;
          const firstStepNumber = 1 + stages.slice(0, stageIndex).reduce((count, previous) => count + previous.practices.length, 0);
          const stagePrefix = `Chặng ${stage.stageNumber}:`;
          const stageTitle = stage.title.startsWith(stagePrefix)
            ? stage.title.slice(stagePrefix.length).trim() || stage.title
            : stage.title;
          return (
            <section key={stage.id} className={styles.stageSection} aria-label={`Chặng ${stage.stageNumber}: ${stageTitle}`}>
              <div className={styles.stageHeader}>
                <div className={styles.stageNumberBadge}>Chặng {stage.stageNumber}</div>
                <div className={styles.stageHeaderInfo}>
                  <div className={styles.stageTitleRow}>
                    <h3 className={styles.stageTitle}>{stageTitle}</h3>
                    <span className={styles.stageTimeframe}>{stage.timeframe}</span>
                    <button
                      type="button"
                      className={styles.stageToggle}
                      aria-label={`${collapsed ? "Mở rộng" : "Thu gọn"} chặng ${stage.stageNumber}: ${stageTitle}`}
                      aria-expanded={!collapsed}
                      aria-controls={contentId}
                      onClick={() => setCollapsedStages((previous) => {
                        const next = new Set(previous);
                        if (next.has(stage.id)) next.delete(stage.id);
                        else next.add(stage.id);
                        return next;
                      })}
                    >
                      {collapsed ? "Mở rộng" : "Thu gọn"}
                      <ChevronDown size={16} className={collapsed ? "" : styles.stageChevronOpen} aria-hidden="true" />
                    </button>
                  </div>
                  <p className={styles.stageDescription}>{stage.description}</p>
                  <span className={styles.stageProgress}>{`${completed}/${practices.length} bước hoàn thành`}</span>
                </div>
              </div>

              <div id={contentId} hidden={collapsed}>
                {practices.length > 0 ? (
                  <ol className={styles.stepList} start={firstStepNumber} role="list" aria-label={`Các bước chặng ${stage.stageNumber}`}>
                    {practices.map((practice, index) => {
                      const stepNumber = firstStepNumber + index;
                      const isRecommended = practice.id === recommendedPracticeId;
                      const isMilestone = practice.kind === "milestone" || (!practice.kind && practice.id === stage.milestonePracticeId);
                      const target = practice.target.trim() || practice.outputs[0];
                      return (
                        <li key={practice.id} className={styles.stepItem}>
                          <button
                            type="button"
                            className={`${styles.stepButton} ${isMilestone ? styles.milestoneStep : ""} ${isRecommended ? styles.recommendedStep : ""}`}
                            onClick={() => onOpenPractice(practice.id)}
                          >
                            <span className={styles.stepHeading}>
                              <span className={styles.stepSequence}>Bước {stepNumber}</span>
                              <span className={styles.stepKind}>{isMilestone ? "Cột mốc" : "Bài thực hành"}</span>
                              {stepNumber === 1 && <span className={styles.firstStep}>Bài tập đầu tiên</span>}
                              {isRecommended && <span className={styles.recommendedLabel}>Gợi ý tiếp theo</span>}
                              <PracticeStatus state={progress.practices[practice.id] ?? "not_updated"} />
                            </span>
                            <strong className={styles.stepTitle}>{practice.title || practice.shortTitle}</strong>
                            {target && <span className={styles.stepTarget}>{target}</span>}
                            <span className={styles.stepFooter}>
                              {practice.targetDuration && <span className={styles.stepDuration}>Mục tiêu: {practice.targetDuration}</span>}
                              <span className={styles.openStep}>Mở hướng dẫn <ArrowRight size={14} aria-hidden="true" /></span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className={styles.emptyStage}>Chưa có bài thực hành cho chặng này.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
