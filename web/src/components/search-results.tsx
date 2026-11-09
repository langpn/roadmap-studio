"use client";

import React from "react";
import { ArrowRight, CheckCircle2, Circle, Clock } from "lucide-react";
import type { LessonMatch } from "@/lib/catalog/search";
import type { ProgressState } from "@/lib/progress/store";
import styles from "./search-results.module.css";

export type SearchStatus = "all" | ProgressState;

const statusLabels: { value: SearchStatus; label: string }[] = [
  { value: "all", label: "Mọi trạng thái" },
  { value: "not_updated", label: "Chưa học" },
  { value: "in_progress", label: "Đang học" },
  { value: "completed", label: "Đã hoàn thành" },
];

export interface SearchResultsProps {
  query: string;
  status: SearchStatus;
  matches: LessonMatch[];
  total: number;
  progress: Readonly<Record<string, ProgressState>>;
  onStatusChange: (status: SearchStatus) => void;
  onSelect: (match: LessonMatch) => void;
  onClear: () => void;
}

/** Kết quả tìm kiếm giữ thứ tự nguồn và nêu rõ khi bộ lọc không khớp bài nào. */
export function SearchResults({ query, status, matches, total, progress, onStatusChange, onSelect, onClear }: SearchResultsProps) {
  return (
    <section className={styles.area} aria-label="Kết quả tìm kiếm bài học">
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Kết quả tìm kiếm ({total} bài phù hợp)</h2>
        <div className={styles.actions}>
          <label className={styles.statusLabel}>
            <span>Trạng thái</span>
            <select
              value={status}
              onChange={(e) => onStatusChange(e.target.value as SearchStatus)}
              className={styles.statusSelect}
            >
              {statusLabels.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={onClear} className={styles.clearButton}>Xóa tìm kiếm</button>
        </div>
      </div>

      {matches.length === 0 ? (
        <p className={styles.empty}>
          Không tìm thấy bài học nào phù hợp với từ khóa &ldquo;{query}&rdquo;
          {status !== "all" ? ` và trạng thái “${statusLabels.find((option) => option.value === status)!.label}”` : ""}.
          Hãy xóa bộ lọc để quay lại danh sách đầy đủ.
        </p>
      ) : (
        <>
          <div className={styles.list}>
            {matches.map(({ lesson, course, chapter }) => {
              const state = progress[lesson.id] ?? "not_updated";
              return (
                <button key={`${course.slug}:${lesson.id}`} type="button" className={styles.item} onClick={() => onSelect({ lesson, course, chapter })}>
                  <span className={styles.itemLeft}>
                    <span className={styles.itemTitle}>{lesson.title}</span>
                    <span className={styles.itemPath}>{course.title} &gt; {chapter.title} (Bài #{lesson.id})</span>
                  </span>
                  <span className={styles.itemRight}>
                    <span className={styles.itemState}>
                      {state === "completed" ? "Đã hoàn thành" : state === "in_progress" ? "Đang học" : "Chưa học"}
                    </span>
                    {state === "completed" ? <CheckCircle2 size={16} color="#059669" aria-hidden="true" />
                      : state === "in_progress" ? <Clock size={16} color="#d97706" aria-hidden="true" />
                        : <Circle size={16} color="#94a3b8" aria-hidden="true" />}
                    <ArrowRight size={14} color="#64748b" aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
          {total > matches.length && (
            <p className={styles.hint}>Đang hiển thị {matches.length} trên {total} kết quả. Hãy gõ thêm để thu hẹp.</p>
          )}
        </>
      )}
    </section>
  );
}
