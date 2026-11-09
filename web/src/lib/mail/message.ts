const EMAIL_PATTERN = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export const MAX_SUBJECT_LENGTH = 200;
export const MAX_TEXT_LENGTH = 100_000;

export type MailMessage = { to: string; subject: string; text: string };

export class MailError extends Error {
  constructor(
    message: string,
    readonly code: "MAIL_NOT_CONFIGURED" | "MAIL_INVALID_MESSAGE" | "MAIL_DELIVERY_FAILED",
  ) {
    super(message);
    this.name = "MailError";
  }
}

export function isValidEmail(value: string): boolean {
  if (value.length === 0 || value.length > 254) return false;
  const at = value.lastIndexOf("@");
  if (at < 1 || at > value.length - 2) return false;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  if (local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) return false;
  return EMAIL_PATTERN.test(value);
}

export function isValidSender(value: string): boolean {
  if (value.length === 0 || value.length > 320 || CONTROL_CHARACTERS.test(value)) return false;
  const bracketed = value.match(/^([^<>]*)<([^<>]+)>$/);
  if (bracketed) return isValidEmail(bracketed[2].trim());
  return isValidEmail(value);
}

function normalizeMessage(input: MailMessage): MailMessage {
  if (!input || typeof input !== "object") {
    throw new MailError("Thiếu nội dung email.", "MAIL_INVALID_MESSAGE");
  }
  const to = typeof input.to === "string" ? input.to.trim() : "";
  if (!isValidEmail(to)) {
    throw new MailError("Email người nhận không hợp lệ.", "MAIL_INVALID_MESSAGE");
  }
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  if (
    subject.length === 0 ||
    subject.length > MAX_SUBJECT_LENGTH ||
    CONTROL_CHARACTERS.test(subject)
  ) {
    throw new MailError("Tiêu đề email không hợp lệ.", "MAIL_INVALID_MESSAGE");
  }
  if (typeof input.text !== "string" || input.text.trim().length === 0) {
    throw new MailError("Nội dung email không được để trống.", "MAIL_INVALID_MESSAGE");
  }
  if (input.text.length > MAX_TEXT_LENGTH) {
    throw new MailError("Nội dung email quá dài.", "MAIL_INVALID_MESSAGE");
  }
  return { to, subject, text: input.text };
}

export { normalizeMessage };
