import type { ReactElement } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const redirect = vi.fn((path: string) => {
    const error = new Error("NEXT_REDIRECT") as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;replace;${path};307;`;
    throw error;
  });
  const push = vi.fn();
  const refresh = vi.fn();
  let rows: { id: string }[] = [];
  const limit = vi.fn(async () => rows);
  const from = vi.fn(() => ({ limit }));
  const select = vi.fn(() => ({ from }));
  return {
    redirect,
    push,
    refresh,
    select,
    from,
    limit,
    setRows: (next: { id: string }[]) => { rows = next; },
  };
});

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock("@/lib/db", () => ({
  getDatabase: async () => ({ select: mocks.select }),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: { signIn: { email: vi.fn() } },
}));

import ThietLapPage from "@/app/thiet-lap/page";
import {
  submitSetup,
  validateSetup,
  ThietLapForm,
  type SetupValues,
} from "@/app/thiet-lap/thiet-lap-form";

const password = "fixture-pass-123";
const values: SetupValues = {
  name: "  Nguyễn Quản Trị  ",
  email: "  owner@example.invalid  ",
  password: password,
  confirmPassword: password,
};

function createDeps(overrides: Partial<Parameters<typeof submitSetup>[1]> = {}) {
  const calls = {
    fetch: [] as { input: string; init?: RequestInit }[],
    signIn: [] as { email: string; password: string }[],
    signedIn: 0,
  };
  const base = {
    fetchImpl: async (input: string, init?: RequestInit) => {
      calls.fetch.push({ input, init });
      return new Response(JSON.stringify({ ok: true }), { status: 201 });
    },
    signIn: async (credentials: { email: string; password: string }) => {
      calls.signIn.push(credentials);
      return { error: null };
    },
    onSignedIn: () => { calls.signedIn += 1; },
  };
  return { calls, deps: { ...base, ...overrides } };
}

beforeEach(() => {
  mocks.redirect.mockClear();
  mocks.push.mockClear();
  mocks.refresh.mockClear();
  mocks.select.mockClear();
  mocks.limit.mockClear();
  mocks.setRows([]);
  delete process.env.APP_MODE;
});

afterEach(() => {
  delete process.env.APP_MODE;
});

describe("kiểm tra thông tin thiết lập", () => {
  it("chấp nhận tên, email và mật khẩu hợp lệ", () => {
    expect(validateSetup(values)).toBeNull();
  });

  it.each([
    ["thiếu tên", { ...values, name: "   " }, "name"],
    ["email sai định dạng", { ...values, email: "owner@" }, "email"],
    ["mật khẩu dưới 10 ký tự", { ...values, password: "ngan1234", confirmPassword: "ngan1234" }, "password"],
    ["xác nhận không khớp", { ...values, confirmPassword: "khac-mat-khau" }, "confirmPassword"],
  ] as const)("báo lỗi tại đúng trường khi %s", (_label, input, field) => {
    const result = validateSetup(input);
    expect(result?.field).toBe(field);
    expect(result?.message.length).toBeGreaterThan(0);
  });
});

describe("gửi yêu cầu thiết lập", () => {
  it("gửi JSON đúng hợp đồng rồi đăng nhập và chuyển vào trang chủ", async () => {
    const { calls, deps } = createDeps();
    const outcome = await submitSetup(values, deps);

    expect(outcome).toEqual({ kind: "signed-in" });
    expect(calls.fetch).toHaveLength(1);
    expect(calls.fetch[0].input).toBe("/api/setup");
    expect(calls.fetch[0].init?.method).toBe("POST");
    expect(new Headers(calls.fetch[0].init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(calls.fetch[0].init?.body))).toEqual({
      name: "Nguyễn Quản Trị",
      email: "owner@example.invalid",
      password: password,
    });
    expect(calls.signIn).toEqual([{ email: "owner@example.invalid", password: password }]);
    expect(calls.signedIn).toBe(1);
  });

  it("không gọi máy chủ khi dữ liệu chưa hợp lệ", async () => {
    const { calls, deps } = createDeps();
    const outcome = await submitSetup({ ...values, confirmPassword: "khac-mat-khau" }, deps);

    expect(outcome.kind).toBe("error");
    expect(outcome.kind === "error" && outcome.field).toBe("confirmPassword");
    expect(calls.fetch).toHaveLength(0);
    expect(calls.signedIn).toBe(0);
  });

  it("khi tạo xong nhưng đăng nhập thất bại thì hướng sang trang đăng nhập và không gửi lại", async () => {
    const { calls, deps } = createDeps({
      signIn: async () => ({ error: { status: 401 } }),
    });
    const outcome = await submitSetup(values, deps);

    expect(outcome.kind).toBe("created");
    expect(calls.fetch).toHaveLength(1);
    expect(calls.signedIn).toBe(0);
    if (outcome.kind === "created") expect(outcome.message).toContain("đã được tạo");
  });

  it("khi đăng nhập ném lỗi sau khi tạo vẫn báo đã tạo tài khoản", async () => {
    const { calls, deps } = createDeps({
      signIn: async () => { throw new Error("mất mạng"); },
    });
    const outcome = await submitSetup(values, deps);

    expect(outcome.kind).toBe("created");
    expect(calls.fetch).toHaveLength(1);
  });

  it("mất kết nối khi gửi thì không thử lại và hướng người dùng kiểm tra đăng nhập", async () => {
    let attempts = 0;
    const { calls, deps } = createDeps({
      fetchImpl: async () => {
        attempts += 1;
        throw new TypeError("Failed to fetch");
      },
    });
    const outcome = await submitSetup(values, deps);

    expect(outcome.kind).toBe("unconfirmed");
    expect(attempts).toBe(1);
    expect(calls.signIn).toHaveLength(0);
  });

  it("409 báo tài khoản đã có hoặc đang thiết lập và cho lối đăng nhập", async () => {
    const { calls, deps } = createDeps({
      fetchImpl: async () => new Response(JSON.stringify({ error: "đã có" }), { status: 409 }),
    });
    const outcome = await submitSetup(values, deps);

    expect(outcome.kind).toBe("conflict");
    if (outcome.kind === "conflict") {
      expect(outcome.message).toContain("đang được thiết lập");
      expect(outcome.message).toContain("đăng nhập");
    }
    expect(calls.signIn).toHaveLength(0);
  });

  it("400 trả lỗi chung, không đọc lại nội dung phản hồi và không lộ mật khẩu", async () => {
    const { deps } = createDeps({
      fetchImpl: async () => new Response(JSON.stringify({ error: password }), { status: 400 }),
    });
    const outcome = await submitSetup(values, deps);

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") {
      expect(outcome.field).toBeUndefined();
      expect(outcome.message).not.toContain(password);
      expect(outcome.message).toContain("Không tạo được tài khoản");
    }
  });

  it("mã lỗi bất ngờ cũng không lộ nội dung phản hồi", async () => {
    const { deps } = createDeps({
      fetchImpl: async () => new Response(password, { status: 500 }),
    });
    const outcome = await submitSetup(values, deps);

    expect(outcome.kind).toBe("error");
    if (outcome.kind === "error") expect(outcome.message).not.toContain(password);
  });
});

describe("trang thiết lập phía máy chủ", () => {
  it("chuyển sang chế độ xem trước khi đang chạy demo", async () => {
    process.env.APP_MODE = "demo";
    await expect(ThietLapPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/demo");
    expect(mocks.select).not.toHaveBeenCalled();
  });

  it("hiển thị biểu mẫu khi cơ sở dữ liệu chưa có tài khoản", async () => {
    mocks.setRows([]);
    const page = await ThietLapPage();
    expect(mocks.redirect).not.toHaveBeenCalled();
    const html = renderToStaticMarkup(page as ReactElement);
    expect(html).toContain("Tạo tài khoản quản trị");
    expect(html).toContain("Tên hiển thị");
    expect(html).toContain("Địa chỉ email");
    expect(html).toContain("Xác nhận mật khẩu");
  });

  it("chỉ chuyển sang đăng nhập sau khi truy vấn thấy tài khoản đã tồn tại", async () => {
    mocks.setRows([{ id: "owner" }]);
    await expect(ThietLapPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.select).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith("/dang-nhap");
    expect(mocks.redirect).not.toHaveBeenCalledWith("/thiet-lap");
  });
});

describe("giao diện biểu mẫu thiết lập", () => {
  it("có nhãn, autocomplete và nút gửi đúng để kiểm thử tự động chọn ổn định", () => {
    const html = renderToStaticMarkup(createElement(ThietLapForm));
    expect(html).toContain("<h1");
    expect(html).toContain("Tạo tài khoản quản trị");
    expect(html).toContain('for="setup-name"');
    expect(html).toContain("Tên hiển thị");
    expect(html).toContain('autoComplete="name"');
    expect(html).toContain('for="setup-email"');
    expect(html).toContain("Địa chỉ email");
    expect(html).toContain('autoComplete="email"');
    expect(html).toContain('for="setup-password"');
    expect(html).toContain('autoComplete="new-password"');
    expect(html).toContain('minLength="10"');
    expect(html).toContain('for="setup-confirm-password"');
    expect(html).toContain("Xác nhận mật khẩu");
    expect(html).toContain("Tạo tài khoản quản trị</span>");
    expect(html).toContain("/dang-nhap");
  });
});
