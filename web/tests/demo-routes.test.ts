import { afterEach, expect, it, vi } from "vitest";
import Home from "@/app/page";
import DemoPage from "@/app/demo/page";
import { GET as getProgress, POST as setProgress } from "@/app/api/progress/route";
import { POST as register } from "@/app/api/register/route";
import { POST as createInvitation } from "@/app/api/invitations/route";
import { POST as verifyEmail } from "@/app/api/verify-email/route";
import { POST as setup } from "@/app/api/setup/route";
import { GET as getMedia, POST as postMedia } from "@/app/api/lesson-media/route";
import { GET as getStream } from "@/app/api/lesson-media/[lessonId]/stream/route";
import { GET as authGet, POST as authPost } from "@/app/api/auth/[...all]/route";

/** Trang chủ đọc tham số lối vào thực hành; test không truyền tham số. */
const EMPTY = { searchParams: Promise.resolve({}) };

afterEach(() => vi.unstubAllEnvs());

const request = () => new Request("http://localhost/api/test", { method: "POST" });

it("chế độ trình diễn chỉ trả dữ liệu giả và không mở API tài khoản", async () => {
  vi.stubEnv("APP_MODE", "demo");
  const page = await Home(EMPTY);
  const content = JSON.stringify(page.props);
  expect(content).not.toMatch(/Baby Resolve|Elite Pro|baby-resolve|elite-pro|freelance-mvp|seankangmvp\.com/i);
  expect(page.props.mode).toBe("demo");
  expect(page.props.loginAvailable).toBe(false);
  const responses = await Promise.all([
    getProgress(request()), setProgress(request()), register(request()), createInvitation(request()),
    verifyEmail(request()), authGet(request()), authPost(request()),
  ]);
  expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404, 404, 404, 404]);
});

it("mọi API đọc/ghi dữ liệu thật đều đóng ở chế độ trình diễn", async () => {
  vi.stubEnv("APP_MODE", "demo");
  const stream = getStream(new Request("http://localhost/api/lesson-media/90000/stream"), {
    params: Promise.resolve({ lessonId: "90000" }),
  });
  const responses = await Promise.all([setup(request()), getMedia(request()), postMedia(request()), stream]);
  expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404]);
});

it("trang demo không mở liên kết đăng nhập và chỉ dùng mã bài mẫu", async () => {
  vi.stubEnv("APP_MODE", "demo");
  const page = await DemoPage(EMPTY);
  expect(page.props.loginAvailable).toBe(false);
  const ids = page.props.catalog.courses.flatMap((course: { chapters: { lessons: { id: string }[] }[] }) =>
    course.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id)));
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(Number(id)).toBeGreaterThanOrEqual(90000);
});
