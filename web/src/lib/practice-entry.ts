/**
 * Lối vào thực hành từ trang học: trang chủ mở sẵn thực hành và nhớ bài đã xem.
 * Trả `{}` khi thiếu tham số để trang chủ giữ nguyên hành vi cũ.
 */
export function practiceEntry(searchParams: Record<string, string | string[] | undefined>) {
  const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const practiceId = single(searchParams.practice);
  if (!practiceId) return {};
  return { entryPracticeId: practiceId, entryLessonId: single(searchParams.lesson) };
}
