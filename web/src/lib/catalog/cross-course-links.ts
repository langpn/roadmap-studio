import type { LessonConnection } from "./lesson-links";

/**
 * Quan hệ giữa hai khóa không lấy Elite làm gốc. Chỉ thêm khi cả hai phía có phần chữ
 * đã lưu để đối chiếu; mức `page_text` không có nghĩa là đã xem video.
 * Nguồn: `review/khoa-khac-20261106/chi-tiet-trang/upwork-mvp-tieng-free/<id>.json`,
 * `courses/freelance-mvp/danh-muc.json` và `review/kiem-chung-bai-ung-vien-freelance.md`.
 */
export const crossCourseLinks: LessonConnection[] = [
  {
    from: { courseSlug: "upwork-mvp", lessonId: "2113" },
    to: { courseSlug: "freelance-mvp", lessonId: "2300" },
    kind: "support",
    reason: "Đối chiếu cách lọc và đánh giá job giữa hai khóa khi tìm việc; cùng chủ đề, khác nền tảng.",
    basis: "page_text",
    evidence:
      "Chữ trang 2113 (bộ lọc, từ khóa, đánh giá job và khách trước khi gửi proposal) và 2300 (bộ lọc, nhận biết job rác, dấu hiệu khách tiềm năng; SHA-256 tại review/kiem-chung-bai-ung-vien-freelance.md); chưa xem video.",
  },
  {
    from: { courseSlug: "upwork-mvp", lessonId: "2117" },
    to: { courseSlug: "freelance-mvp", lessonId: "2319" },
    kind: "support",
    reason: "Đối chiếu cách giao tiếp và xác nhận yêu cầu với khách giữa hai khóa.",
    basis: "page_text",
    evidence:
      "Chữ trang 2117 (trò chuyện rõ ràng, xử lý tình huống khó, đặt câu hỏi đúng) và 2319 (ngôn ngữ dễ hiểu, xác nhận lại yêu cầu; SHA-256 tại review/kiem-chung-bai-ung-vien-freelance.md); chưa xem video.",
  },
];
