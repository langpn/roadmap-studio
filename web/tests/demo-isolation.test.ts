import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mọi lần chạm database hoặc auth trong chế độ demo đều là lỗi: test dưới đây
// cố ý làm các hàm đó ném lỗi để phát hiện route nào quên chặn.
const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(() => { throw new Error("demo không được mở database cá nhân"); }),
  getAuth: vi.fn(() => { throw new Error("demo không được mở auth"); }),
  getAuthSecret: vi.fn(() => { throw new Error("demo không được đọc bí mật"); }),
}));

vi.mock("@/lib/db", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("@/lib/auth/server", () => ({ getAuth: mocks.getAuth, getAuthSecret: mocks.getAuthSecret }));

import Home from "@/app/page";
import DemoPage from "@/app/demo/page";
import LessonStudyPage, { generateMetadata } from "@/app/bai-hoc/[lessonId]/page";
import { GET as getProgress, POST as setProgress } from "@/app/api/progress/route";
import { POST as register } from "@/app/api/register/route";
import { POST as createInvitation } from "@/app/api/invitations/route";
import { POST as verifyEmail } from "@/app/api/verify-email/route";
import { POST as setup } from "@/app/api/setup/route";
import { GET as getMedia, POST as postMedia } from "@/app/api/lesson-media/route";
import { GET as getStream } from "@/app/api/lesson-media/[lessonId]/stream/route";
import { GET as authGet, POST as authPost } from "@/app/api/auth/[...all]/route";
import DangNhapPage from "@/app/dang-nhap/page";
import DangKyPage from "@/app/dang-ky/page";
import CaiDatPage from "@/app/cai-dat/page";
import ThietLapPage from "@/app/thiet-lap/page";
import ThuThapPage from "@/app/thu-thap/page";
import QuenMatKhauPage from "@/app/quen-mat-khau/page";
import DatLaiMatKhauPage from "@/app/dat-lai-mat-khau/page";
import XacMinhEmailPage from "@/app/xac-minh-email/page";

/** Trang chủ đọc tham số lối vào thực hành; test không truyền tham số. */
const EMPTY = { searchParams: Promise.resolve({}) };

beforeEach(() => {
  vi.stubEnv("APP_MODE", "demo");
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

const request = () => new Request("http://localhost/api/test", { method: "POST" });

/** Trang tài khoản dùng redirect() của Next: lỗi có digest chứa đích chuyển. */
async function expectRedirectToDemo(render: () => Promise<unknown>) {
  try {
    await render();
  } catch (error) {
    expect((error as { digest?: string }).digest).toContain("/demo");
    return;
  }
  throw new Error("Trang phải chuyển về /demo trong chế độ trình diễn.");
}

function expectNoPrivateAccess() {
  expect(mocks.getDatabase).not.toHaveBeenCalled();
  expect(mocks.getAuth).not.toHaveBeenCalled();
  expect(mocks.getAuthSecret).not.toHaveBeenCalled();
}

describe("demo tách khỏi dữ liệu cá nhân", () => {
  it("API tài khoản, tiến độ và media đóng trước khi mở database hay auth", async () => {
    const responses = await Promise.all([
      getProgress(request()), setProgress(request()), register(request()), createInvitation(request()),
      verifyEmail(request()), setup(request()), getMedia(request()), postMedia(request()),
      authGet(request()), authPost(request()),
      getStream(new Request("http://localhost/api/lesson-media/90000/stream"), {
        params: Promise.resolve({ lessonId: "90000" }),
      }),
    ]);
    expect(responses.map((response) => response.status)).toEqual(Array(11).fill(404));
    expectNoPrivateAccess();
  });

  it("các trang tài khoản chuyển về demo mà không đọc database", async () => {
    for (const render of [DangNhapPage, DangKyPage, CaiDatPage, ThietLapPage, ThuThapPage, QuenMatKhauPage, DatLaiMatKhauPage, XacMinhEmailPage] as (() => unknown)[]) {
      await expectRedirectToDemo(async () => render());
    }
    expectNoPrivateAccess();
  });

  it("trang chủ, trang demo và trang học mẫu không chạm database", async () => {
    const home = await Home(EMPTY) as unknown as { props: Record<string, unknown> };
    expect(home.props.mode).toBe("demo");
    const demo = await DemoPage(EMPTY) as unknown as { props: Record<string, unknown> };
    expect(demo.props.mode).toBe("demo");

    const page = await LessonStudyPage({
      params: Promise.resolve({ lessonId: "90000" }),
      searchParams: Promise.resolve({}),
    }) as unknown as { props: Record<string, unknown> };
    expect(page.props.mode).toBe("demo");

    const metadata = await generateMetadata({
      params: Promise.resolve({ lessonId: "90000" }),
      searchParams: Promise.resolve({}),
    });
    expect(metadata.title).toContain("Sắp xếp tư liệu | Đường dựng");
    expectNoPrivateAccess();
  });

  it("không mở bài thật trong demo và không đọc database", async () => {
    await expect(LessonStudyPage({
      params: Promise.resolve({ lessonId: "5860" }),
      searchParams: Promise.resolve({}),
    })).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
    expectNoPrivateAccess();
  });

  it("máy chủ cá nhân vẫn mở demo bằng ?demo=1 mà không đọc database", async () => {
    vi.stubEnv("APP_MODE", "private");
    const page = await LessonStudyPage({
      params: Promise.resolve({ lessonId: "90000" }),
      searchParams: Promise.resolve({ demo: "1" }),
    }) as unknown as { props: Record<string, unknown> };
    expect(page.props.mode).toBe("demo");
    const demo = await DemoPage(EMPTY) as unknown as { props: Record<string, unknown> };
    expect(demo.props.mode).toBe("demo");
    expectNoPrivateAccess();
  });
});
