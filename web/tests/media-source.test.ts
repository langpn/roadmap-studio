import { describe, expect, it } from "vitest";
import { validatedLessonPageUrl } from "@/lib/media/source";

describe("nguồn trang bài học", () => {
  it("chỉ cho nhúng trang bài học thuộc website nguồn và đúng mã bài", () => {
    const source = "https://seankangmvp.com/courses/example/chapters/123/lessons/456";
    expect(validatedLessonPageUrl(source, "456")).toBe(source);
    for (const value of [
      "http://seankangmvp.com/courses/example/chapters/123/lessons/456",
      "https://seankangmvp.com.evil.invalid/courses/example/chapters/123/lessons/456",
      "https://user:secret@seankangmvp.com/courses/example/chapters/123/lessons/456",
      "https://seankangmvp.com/courses/example/chapters/123/lessons/456?token=temporary",
      "javascript:alert(1)",
      "https://seankangmvp.com/courses/example/chapters/123/lessons/789",
    ]) expect(validatedLessonPageUrl(value, "456"), value).toBeNull();
  });
});
