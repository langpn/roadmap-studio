"use client";

import { ArrowRight, Flag } from "lucide-react";
import type { LessonPractice } from "@/lib/catalog/lesson-practices";
import styles from "./related-practices.module.css";

export type RelatedPracticesProps = {
  items: readonly LessonPractice[];
  /** Lối vào dạng liên kết (trang học); bỏ trống thì dùng nút. */
  hrefFor?: (practiceId: string) => string;
  onOpen?: (practiceId: string) => void;
  headingLevel?: 2 | 3;
  /** Bảng chi tiết dùng các mục phẳng, trang học dùng thẻ nội dung. */
  flat?: boolean;
};

const roleLabel = { main: "Bài chính", support: "Bài hỗ trợ" } as const;

export function RelatedPractices({ items, hrefFor, onOpen, headingLevel = 2, flat = false }: RelatedPracticesProps) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const headingClass = flat ? styles.flatHeading : styles.heading;

  return (
    <section className={flat ? styles.flatSection : styles.section} aria-labelledby="related-practices-title">
      <Heading id="related-practices-title" className={headingClass}>Bài thực hành dùng bài này</Heading>
      {items.length ? (
        <>
          <p className={styles.intro}>
            Bài tự luyện của lộ trình, tách khỏi nội dung giảng viên. Mở để xem bước, đầu ra và tự đánh dấu tiến độ.
          </p>
          <ul className={styles.list}>
            {items.map(({ practice, link }) => {
              const content = <>
                <span className={styles.title}>{practice.title}</span>
                <ArrowRight size={15} aria-hidden="true" />
              </>;
              return (
                <li key={practice.id} className={styles.item}>
                  <span className={styles.meta}>
                    <span>{practice.kind === "milestone" ? "Cột mốc" : "Bài tự luyện"}</span>
                    {link.role && <span className={styles.role}>{roleLabel[link.role]}</span>}
                    {practice.kind === "milestone" && <Flag size={13} aria-hidden="true" />}
                  </span>
                  {hrefFor ? (
                    <a className={styles.action} href={hrefFor(practice.id)}>{content}</a>
                  ) : (
                    <button type="button" className={styles.action} onClick={() => onOpen?.(practice.id)}>{content}</button>
                  )}
                  <p className={styles.purpose}>{link.purpose ?? "Chưa có giải thích cho liên kết này."}</p>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className={styles.empty}>Chưa có bài thực hành nào tham chiếu bài học này.</p>
      )}
    </section>
  );
}
