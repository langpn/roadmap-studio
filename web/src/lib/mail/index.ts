import { readMailConfig } from "./config";
import { deliverToTestMailbox } from "./memory";
import { MailError, normalizeMessage, type MailMessage } from "./message";

export type Mailer = {
  /** true khi đã có đủ cấu hình để gửi thư (SMTP hoặc hộp thư giả lập trong test). */
  configured: boolean;
  send(message: MailMessage): Promise<void>;
};

const SMTP_TIMEOUT_MS = 15_000;

/**
 * Tạo bộ gửi thư từ biến môi trường.
 *
 * - Có đủ SMTP_HOST, SMTP_PORT, SMTP_FROM: gửi qua SMTP bằng nodemailer.
 * - NODE_ENV=test và MAIL_TRANSPORT=memory: chỉ lưu vào hộp thư giả lập trong bộ nhớ.
 * - Thiếu cấu hình: configured=false và send() từ chối, không bao giờ gửi thật.
 *
 * Không ghi log nội dung thư, mật khẩu hay liên kết có chữ ký.
 */
export function createMailer(env: NodeJS.ProcessEnv = process.env): Mailer {
  const config = readMailConfig(env);

  if (config.kind === "unconfigured") {
    return {
      configured: false,
      async send() {
        throw new MailError(
          "Dịch vụ email chưa được cấu hình. Hãy đặt SMTP_HOST, SMTP_PORT và SMTP_FROM.",
          "MAIL_NOT_CONFIGURED",
        );
      },
    };
  }

  if (config.kind === "memory") {
    return {
      configured: true,
      async send(input) {
        deliverToTestMailbox(normalizeMessage(input));
      },
    };
  }

  let transporter: Promise<import("nodemailer").Transporter> | undefined;
  const getTransporter = () => {
    transporter ??= import("nodemailer").then(({ createTransport }) => createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.auth ? { auth: config.auth } : {}),
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    }));
    return transporter;
  };

  return {
    configured: true,
    async send(input) {
      const message = normalizeMessage(input);
      try {
        const transport = await getTransporter();
        await transport.sendMail({
          from: config.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
        });
      } catch {
        // Không gắn lỗi gốc để tránh lộ chi tiết kết nối/xác thực vào log của ứng dụng.
        throw new MailError(
          "Không gửi được email. Hãy kiểm tra cấu hình SMTP và nhà cung cấp dịch vụ.",
          "MAIL_DELIVERY_FAILED",
        );
      }
    },
  };
}

let sharedMailer: Mailer | undefined;

/**
 * Bộ gửi thư dùng chung cho toàn ứng dụng, tạo một lần từ process.env.
 * Dùng hàm này trong luồng Better Auth để không tạo transporter mới mỗi lần gửi.
 */
export function getMailer(): Mailer {
  sharedMailer ??= createMailer(process.env);
  return sharedMailer;
}

export { MailError } from "./message";
export type { MailMessage } from "./message";
export { clearTestMailbox, readTestMailbox } from "./memory";
export type { TestMail } from "./memory";
