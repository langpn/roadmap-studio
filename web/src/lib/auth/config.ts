import type { PgliteDatabase } from "drizzle-orm/pglite";
import { createHash, timingSafeEqual } from "node:crypto";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@/lib/db/schema";
import { getMailer, type Mailer } from "@/lib/mail";

function sameSecret(value: string | null, secret: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(digest(value ?? ""), digest(secret));
}

export function createAuth(db: PgliteDatabase, options: { secret: string; baseURL: string; mailer?: Mailer }) {
  const mailer = options.mailer ?? getMailer();
  const actionLink = (path: string, token: string) => `${new URL(path, options.baseURL).href}#token=${encodeURIComponent(token)}`;
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 3600,
      sendResetPassword: async ({ user, token }) => {
        void mailer.send({
          to: user.email,
          subject: "Đặt lại mật khẩu Đường dựng",
          text: `Mở liên kết sau trong một giờ để đặt lại mật khẩu:\n${actionLink("/dat-lai-mat-khau", token)}`,
        }).catch(() => {});
      },
    },
    emailVerification: {
      sendOnSignUp: mailer.configured,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, token }) => {
        void mailer.send({
          to: user.email,
          subject: "Xác minh email Đường dựng",
          text: `Mở liên kết sau trong một giờ để xác minh email:\n${actionLink("/xac-minh-email", token)}`,
        }).catch(() => {});
      },
    },
    user: { additionalFields: { role: { type: "string", defaultValue: "user", input: false } } },
    rateLimit: { enabled: true, window: 60, max: 20 },
    advanced: { useSecureCookies: options.baseURL.startsWith("https://") },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email" && !sameSecret(ctx.headers?.get("x-roadmap-internal") ?? null, options.secret)) {
          throw new APIError("FORBIDDEN", { message: "Cần lời mời để tạo tài khoản." });
        }
      }),
    },
  });
}
