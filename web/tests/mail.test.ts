import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTestMailbox, createMailer, readTestMailbox } from "@/lib/mail";

const smtpMock = vi.hoisted(() => {
  const sendMail = vi.fn();
  const createTransport = vi.fn(() => ({ sendMail }));
  return { sendMail, createTransport };
});

vi.mock("nodemailer", () => ({ default: { createTransport: smtpMock.createTransport }, createTransport: smtpMock.createTransport }));

const envWithout = (base: NodeJS.ProcessEnv, ...keys: string[]): NodeJS.ProcessEnv => {
  const copy: NodeJS.ProcessEnv = { ...base };
  for (const key of keys) delete copy[key];
  return copy;
};

const memoryEnv: NodeJS.ProcessEnv = { NODE_ENV: "test", MAIL_TRANSPORT: "memory" };
const smtpEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  SMTP_HOST: "smtp.example.invalid",
  SMTP_PORT: "587",
  SMTP_USER: "mailer@example.invalid",
  SMTP_PASSWORD: "not-a-real-password",
  SMTP_FROM: "Đường dựng <no-reply@example.invalid>",
  SMTP_SECURE: "false",
};

beforeEach(() => { clearTestMailbox(); });

describe("tạo mailer", () => {
  it("báo chưa cấu hình và từ chối gửi khi thiếu SMTP", async () => {
    const mailer = createMailer({ NODE_ENV: "test" });
    expect(mailer.configured).toBe(false);
    await expect(mailer.send({ to: "hoc-vien@example.invalid", subject: "Thử", text: "Nội dung" }))
      .rejects.toMatchObject({ name: "MailError", code: "MAIL_NOT_CONFIGURED" });
    expect(readTestMailbox()).toEqual([]);
  });

  it("chỉ báo đã cấu hình SMTP khi đủ thông tin bắt buộc", () => {
    expect(createMailer(smtpEnv).configured).toBe(true);
    expect(createMailer({ ...smtpEnv, SMTP_HOST: "" }).configured).toBe(false);
    expect(createMailer({ ...smtpEnv, SMTP_FROM: "" }).configured).toBe(false);
    expect(createMailer({ ...smtpEnv, SMTP_PORT: "không-phải-số" }).configured).toBe(false);
    expect(createMailer({ ...smtpEnv, SMTP_SECURE: "đôi-khi" }).configured).toBe(false);
  });

  it("không nhận cấu hình xác thực SMTP thiếu một nửa", async () => {
    const mailer = createMailer({ ...smtpEnv, SMTP_PASSWORD: "" });
    expect(mailer.configured).toBe(false);
    await expect(mailer.send({ to: "hoc-vien@example.invalid", subject: "Thử", text: "Nội dung" }))
      .rejects.toThrow(/chưa được cấu hình/i);
  });
});

describe("gửi qua SMTP", () => {
  it("chuyển thư đã kiểm tra cho nodemailer mà không gọi mạng thật", async () => {
    smtpMock.createTransport.mockClear();
    smtpMock.sendMail.mockReset();
    smtpMock.sendMail.mockResolvedValue({ messageId: "test" });

    const mailer = createMailer(smtpEnv);
    await mailer.send({ to: " hoc-vien@example.invalid ", subject: " Đặt lại mật khẩu ", text: "Nội dung thư" });

    expect(smtpMock.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.example.invalid",
      port: 587,
      secure: false,
      auth: { user: "mailer@example.invalid", pass: "not-a-real-password" },
    }));
    expect(smtpMock.sendMail).toHaveBeenCalledWith({
      from: "Đường dựng <no-reply@example.invalid>",
      to: "hoc-vien@example.invalid",
      subject: "Đặt lại mật khẩu",
      text: "Nội dung thư",
    });
    expect(readTestMailbox()).toEqual([]);
  });

  it("mặc định bật TLS khi dùng cổng 465", async () => {
    smtpMock.createTransport.mockClear();
    smtpMock.sendMail.mockReset();
    smtpMock.sendMail.mockResolvedValue({ messageId: "test" });
    const withoutSecure = { ...envWithout(smtpEnv, "SMTP_SECURE"), SMTP_PORT: "465" };
    expect(createMailer(withoutSecure).configured).toBe(true);
    await createMailer(withoutSecure).send({ to: "hoc-vien@example.invalid", subject: "Thử", text: "Nội dung" });
    expect(smtpMock.createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 465, secure: true }));
  });

  it("không gửi thông tin xác thực khi không có SMTP_USER và SMTP_PASSWORD", async () => {
    smtpMock.createTransport.mockClear();
    smtpMock.sendMail.mockReset();
    smtpMock.sendMail.mockResolvedValue({ messageId: "test" });
    const mailer = createMailer(envWithout(smtpEnv, "SMTP_USER", "SMTP_PASSWORD"));
    expect(mailer.configured).toBe(true);
    await mailer.send({ to: "hoc-vien@example.invalid", subject: "Thử", text: "Nội dung" });
    expect(smtpMock.createTransport).toHaveBeenCalledWith(expect.not.objectContaining({ auth: expect.anything() }));
  });

  it("không đưa mật khẩu, liên kết có chữ ký hay lỗi gốc vào thông báo lỗi", async () => {
    smtpMock.sendMail.mockReset();
    smtpMock.sendMail.mockRejectedValue(new Error("535 auth failed for not-a-real-password"));
    const mailer = createMailer(smtpEnv);

    const error = await mailer.send({
      to: "hoc-vien@example.invalid",
      subject: "Đặt lại mật khẩu",
      text: "Mở liên kết: https://example.invalid/reset?token=chu-ky-bi-mat",
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect(error).toMatchObject({ name: "MailError", code: "MAIL_DELIVERY_FAILED" });
    const serialized = `${(error as Error).message} ${(error as Error).stack ?? ""} ${JSON.stringify(error)}`;
    expect(serialized).not.toContain("not-a-real-password");
    expect(serialized).not.toContain("chu-ky-bi-mat");
  });

  it("không khởi tạo nodemailer khi thiếu cấu hình", async () => {
    smtpMock.createTransport.mockClear();
    const mailer = createMailer({ NODE_ENV: "test", SMTP_HOST: "smtp.example.invalid", SMTP_PORT: "587" });
    await expect(mailer.send({ to: "hoc-vien@example.invalid", subject: "Thử", text: "Nội dung" })).rejects.toThrow();
    expect(smtpMock.createTransport).not.toHaveBeenCalled();
  });

  it("từ chối dữ liệu sai trước khi mở kết nối SMTP", async () => {
    smtpMock.createTransport.mockClear();
    smtpMock.sendMail.mockReset();
    const mailer = createMailer(smtpEnv);
    await expect(mailer.send({ to: "sai", subject: "Thử", text: "Nội dung" }))
      .rejects.toMatchObject({ code: "MAIL_INVALID_MESSAGE" });
    expect(smtpMock.createTransport).not.toHaveBeenCalled();
    expect(smtpMock.sendMail).not.toHaveBeenCalled();
  });
});

describe("bộ gửi thư dùng chung", () => {
  it("trả lại cùng một mailer cho các lần gọi sau", async () => {
    const { getMailer } = await import("@/lib/mail");
    expect(getMailer()).toBe(getMailer());
  });
});

describe("hộp thư giả lập trong bộ nhớ", () => {
  it("lưu tin đã gửi khi NODE_ENV là test và MAIL_TRANSPORT là memory", async () => {
    const mailer = createMailer(memoryEnv);
    expect(mailer.configured).toBe(true);
    await mailer.send({ to: "hoc-vien@example.invalid", subject: "Đặt lại mật khẩu", text: "Nội dung thư" });

    const inbox = readTestMailbox();
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      to: "hoc-vien@example.invalid",
      subject: "Đặt lại mật khẩu",
      text: "Nội dung thư",
    });
    expect(inbox[0].sentAt).toBeInstanceOf(Date);

    clearTestMailbox();
    expect(readTestMailbox()).toEqual([]);
  });

  it("ưu tiên hộp thư giả lập khi chạy test dù có cấu hình SMTP", async () => {
    const mailer = createMailer({ ...smtpEnv, MAIL_TRANSPORT: "memory" });
    await mailer.send({ to: "hoc-vien@example.invalid", subject: "Thử", text: "Nội dung" });
    expect(readTestMailbox()).toHaveLength(1);
  });

  it("không bật hộp thư giả lập ngoài môi trường test dù có MAIL_TRANSPORT", async () => {
    const mailer = createMailer({ NODE_ENV: "production", MAIL_TRANSPORT: "memory" });
    expect(mailer.configured).toBe(false);
    await expect(mailer.send({ to: "hoc-vien@example.invalid", subject: "Thử", text: "Nội dung" }))
      .rejects.toThrow(/chưa được cấu hình/i);
    expect(readTestMailbox()).toEqual([]);
  });

  it("không bật hộp thư giả lập khi tiến trình đang chạy production dù env truyền vào ghi test", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const mailer = createMailer({ NODE_ENV: "test", MAIL_TRANSPORT: "memory" });
      expect(mailer.configured).toBe(false);
      await expect(mailer.send({ to: "hoc-vien@example.invalid", subject: "Thử", text: "Nội dung" }))
        .rejects.toThrow(/chưa được cấu hình/i);
      expect(readTestMailbox()).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("ở production có đủ SMTP thì gửi qua SMTP chứ không nuốt thư vào bộ nhớ", async () => {
    smtpMock.createTransport.mockClear();
    smtpMock.sendMail.mockReset();
    smtpMock.sendMail.mockResolvedValue({ messageId: "test" });
    const mailer = createMailer({ ...smtpEnv, NODE_ENV: "production", MAIL_TRANSPORT: "memory" });
    expect(mailer.configured).toBe(true);
    await mailer.send({ to: "hoc-vien@example.invalid", subject: "Thử", text: "Nội dung" });
    expect(smtpMock.sendMail).toHaveBeenCalledTimes(1);
    expect(readTestMailbox()).toEqual([]);
  });

  it("trả bản sao để mã kiểm thử không sửa được hộp thư gốc", async () => {
    const mailer = createMailer(memoryEnv);
    await mailer.send({ to: "hoc-vien@example.invalid", subject: "Thử", text: "Nội dung" });
    const inbox = readTestMailbox();
    inbox[0].subject = "Đã bị sửa";
    inbox.length = 0;
    expect(readTestMailbox()).toHaveLength(1);
    expect(readTestMailbox()[0].subject).toBe("Thử");
  });

  it("từ chối cấu hình khi địa chỉ gửi không hợp lệ", () => {
    expect(createMailer({ ...smtpEnv, SMTP_FROM: "không-phải-email" }).configured).toBe(false);
    expect(createMailer({ ...smtpEnv, SMTP_FROM: "Tên <a@example.invalid>\r\nBcc: kẻ-xấu@example.invalid" }).configured).toBe(false);
  });

  it("kiểm tra dữ liệu trước khi đưa vào hộp thư", async () => {
    const mailer = createMailer(memoryEnv);
    await expect(mailer.send({ to: "không-phải-email", subject: "Thử", text: "Nội dung" }))
      .rejects.toMatchObject({ name: "MailError", code: "MAIL_INVALID_MESSAGE" });
    await expect(mailer.send({ to: "hoc-vien@example.invalid", subject: "", text: "Nội dung" }))
      .rejects.toThrow(/tiêu đề/i);
    await expect(mailer.send({ to: "hoc-vien@example.invalid", subject: "Thử\r\nBcc: kẻ-xấu@example.invalid", text: "Nội dung" }))
      .rejects.toThrow(/tiêu đề/i);
    await expect(mailer.send({ to: "hoc-vien@example.invalid", subject: "Thử", text: "   " }))
      .rejects.toThrow(/nội dung/i);
    expect(readTestMailbox()).toEqual([]);
  });
});
