import { isValidSender } from "./message";

export type MailConfig =
  | { kind: "memory" }
  | { kind: "smtp"; host: string; port: number; secure: boolean; from: string; auth?: { user: string; pass: string } }
  | { kind: "unconfigured" };

const isNonEmpty = (value: string | undefined): value is string => Boolean(value && value.trim().length > 0);

function parsePort(value: string | undefined): number | null {
  if (!isNonEmpty(value)) return null;
  if (!/^\d{1,5}$/.test(value.trim())) return null;
  const port = Number(value.trim());
  return Number.isInteger(port) && port >= 1 && port <= 65535 ? port : null;
}

function parseSecure(value: string | undefined, port: number): boolean | null {
  if (!isNonEmpty(value)) return port === 465;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  return null;
}

/**
 * Đọc cấu hình thư từ biến môi trường.
 * Hộp thư giả lập chỉ được chọn khi đang chạy test và bật rõ MAIL_TRANSPORT=memory.
 * Tiến trình thật đang ở production thì không bao giờ dùng hộp thư giả lập,
 * kể cả khi đối số env bị truyền sai.
 */
export function readMailConfig(env: NodeJS.ProcessEnv): MailConfig {
  const isTestRuntime = process.env.NODE_ENV === "test";
  if (isTestRuntime && env.NODE_ENV === "test" && env.MAIL_TRANSPORT === "memory") return { kind: "memory" };

  const host = env.SMTP_HOST?.trim();
  const from = env.SMTP_FROM?.trim();
  const port = parsePort(env.SMTP_PORT);
  if (!isNonEmpty(host) || /\s/.test(host) || host.length > 253) return { kind: "unconfigured" };
  if (!isNonEmpty(from) || !isValidSender(from)) return { kind: "unconfigured" };
  if (port === null) return { kind: "unconfigured" };

  const secure = parseSecure(env.SMTP_SECURE, port);
  if (secure === null) return { kind: "unconfigured" };

  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASSWORD;
  const hasUser = isNonEmpty(user);
  const hasPassword = isNonEmpty(pass);
  if (hasUser !== hasPassword) return { kind: "unconfigured" };

  return {
    kind: "smtp",
    host,
    port,
    secure,
    from,
    ...(hasUser && hasPassword ? { auth: { user, pass } } : {}),
  };
}
