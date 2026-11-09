import type { LessonConnection } from "./lesson-links";

function link(
  from: string,
  courseSlug: string,
  to: string,
  kind: LessonConnection["kind"],
  reason: string,
): LessonConnection {
  return {
    from: { courseSlug: "elite", lessonId: from },
    to: { courseSlug, lessonId: to },
    kind,
    reason,
    basis: "title",
  };
}

export const eliteManualLinks: LessonConnection[] = [
  link("5860", "baby-resolve", "2207", "foundation", "Tham khảo các công cụ thường dùng trong Edit Page để hỗ trợ bước cắt RAW."),
  link("5860", "elite", "2132", "support", "Đối chiếu phần cắt RAW với một bài chọn RAW và cắt thô theo dự án."),
  link("5861", "elite", "2139", "support", "Nối phần cân bằng âm thanh với phần thêm SFX và nhạc nền."),
  link("5862", "elite", "5863", "advanced", "Liên hệ căn chỉnh phụ đề với phần thiết kế kiểu chữ và hiệu ứng chữ."),
  link("2132", "elite", "2753", "advanced", "Đối chiếu hai bài cắt thô; bài liên kết còn nhắc việc ghi chú ý tưởng."),
  link("2139", "elite", "2767", "advanced", "Đối chiếu chủ đề SFX và nhạc nền với phần chau chuốt âm thanh."),
  link("2753", "elite", "2767", "support", "Nối bước cắt thô, ghi chú ý tưởng với bước âm thanh và hoàn thiện trong cùng dự án."),
];
