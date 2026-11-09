import type { MailMessage } from "./message";

export type TestMail = MailMessage & { sentAt: Date };

const mailbox: TestMail[] = [];

/** Chỉ dùng trong kiểm thử: thêm thư vào hộp thư giả lập trong bộ nhớ. */
export function deliverToTestMailbox(message: MailMessage): void {
  mailbox.push({ ...message, sentAt: new Date() });
}

/** Chỉ dùng trong kiểm thử: đọc bản sao các thư đã gửi. */
export function readTestMailbox(): TestMail[] {
  return mailbox.map((mail) => ({ ...mail }));
}

/** Chỉ dùng trong kiểm thử: xoá sạch hộp thư giả lập. */
export function clearTestMailbox(): void {
  mailbox.length = 0;
}
