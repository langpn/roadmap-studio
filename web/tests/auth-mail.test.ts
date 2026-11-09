import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { createAuth } from "@/lib/auth/config";
import { initializeDatabase } from "@/lib/db/migrate";
import { user, verification } from "@/lib/db/schema";
import { clearTestMailbox, createMailer, readTestMailbox } from "@/lib/mail";

const client = new PGlite();
const db = drizzle(client);
const secret = "test-secret-for-an-isolated-test-only-1234567890";
const auth = createAuth(db, {
  secret,
  baseURL: "http://localhost:3000",
  mailer: createMailer({ NODE_ENV: "test", MAIL_TRANSPORT: "memory" }),
});

beforeAll(async () => {
  await initializeDatabase(db);
  await auth.api.signUpEmail({
    headers: new Headers({ "x-roadmap-internal": secret }),
    body: { name: "Thử", email: "mail-test@example.invalid", password: "test-password-123" },
  });
});
beforeEach(() => clearTestMailbox());
afterAll(async () => { await client.close(); });

function tokenFromMail(): string {
  const text = readTestMailbox()[0]?.text ?? "";
  const link = text.match(/https?:\/\/\S+/)?.[0];
  if (!link) throw new Error("Không có liên kết trong hộp thư giả.");
  return new URLSearchParams(new URL(link).hash.slice(1)).get("token") ?? "";
}

describe("xác minh và khôi phục tài khoản bằng hộp thư giả", () => {
  it("xác minh email bằng liên kết tạm thời", async () => {
    await auth.api.sendVerificationEmail({ body: { email: "mail-test@example.invalid" } });
    expect(readTestMailbox()).toHaveLength(1);
    const token = tokenFromMail();
    expect(token.length).toBeGreaterThan(10);
    await auth.api.verifyEmail({ query: { token } });
    const [account] = await db.select().from(user).where(eq(user.email, "mail-test@example.invalid"));
    expect(account.emailVerified).toBe(true);
  });

  it("từ chối mã xác minh email đã hết hạn", async () => {
    await db.update(user).set({ emailVerified: false }).where(eq(user.email, "mail-test@example.invalid"));
    await auth.api.sendVerificationEmail({ body: { email: "mail-test@example.invalid" } });
    const token = tokenFromMail();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.now() + 2 * 60 * 60 * 1000);
      await expect(auth.api.verifyEmail({ query: { token } })).rejects.toThrow();
    } finally { vi.useRealTimers(); }
  });

  it("trả phản hồi giống nhau, đặt lại mật khẩu một lần và thu hồi phiên cũ", async () => {
    const login = await auth.api.signInEmail({ returnHeaders: true, body: { email: "mail-test@example.invalid", password: "test-password-123" } });
    const cookies = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
    const known = await auth.api.requestPasswordReset({ body: { email: "mail-test@example.invalid" } });
    const token = tokenFromMail();
    clearTestMailbox();
    const unknown = await auth.api.requestPasswordReset({ body: { email: "unknown@example.invalid" } });
    expect(unknown).toEqual(known);
    expect(readTestMailbox()).toHaveLength(0);
    await auth.api.resetPassword({ body: { token, newPassword: "{{SECRET_tr45fs3t}}" } });
    expect(await auth.api.getSession({ headers: new Headers({ cookie: cookies }) })).toBeNull();
    await expect(auth.api.resetPassword({ body: { token, newPassword: "{{SECRET_tr45fs3t}}" } })).rejects.toThrow();
    await expect(auth.api.signInEmail({ body: { email: "mail-test@example.invalid", password: "{{SECRET_tr45fs3t}}" } })).resolves.toBeTruthy();
  });

  it("từ chối liên kết đặt lại hết hạn", async () => {
    await auth.api.requestPasswordReset({ body: { email: "mail-test@example.invalid" } });
    const token = tokenFromMail();
    await db.update(verification).set({ expiresAt: new Date(0) }).where(eq(verification.identifier, `reset-password:${token}`));
    await expect(auth.api.resetPassword({ body: { token, newPassword: "{{SECRET_tr45fs3t}}" } })).rejects.toThrow();
  });
});
