import { afterAll, beforeAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { createAuth } from "@/lib/auth/config";
import { initializeDatabase } from "@/lib/db/migrate";
import { account, session } from "@/lib/db/schema";

const client = new PGlite();
const db = drizzle(client);
const origin = "https://security-test.example.invalid";
const secret = "security-test-secret-for-isolated-database-only";
const password = "security-test-password-only";
const email = "security-test@example.invalid";
const auth = createAuth(db, { secret, baseURL: origin });

beforeAll(async () => { await initializeDatabase(db); });
afterAll(async () => { await client.close(); });

it("băm mật khẩu, bảo vệ cookie HTTPS, từ chối phiên hết hạn và giới hạn đăng nhập", async () => {
  const created = await auth.api.signUpEmail({
    headers: new Headers({ "x-roadmap-internal": secret }),
    body: { name: "Người thử", email, password },
  });
  const [credentials] = await db.select().from(account);
  expect(credentials.password).toBeTruthy();
  expect(credentials.password).not.toContain(password);

  const signIn = (candidate: string) => auth.handler(new Request(`${origin}/api/auth/sign-in/email`, {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ email, password: candidate }),
  }));
  const response = await signIn(password);
  expect(response.status).toBe(200);
  const cookie = response.headers.getSetCookie().find((value) => value.includes("session_token="));
  expect(cookie).toMatch(/(?:^|;\s*)Secure(?:;|$)/i);
  expect(cookie).toMatch(/(?:^|;\s*)HttpOnly(?:;|$)/i);
  expect(cookie).toMatch(/(?:^|;\s*)SameSite=Lax(?:;|$)/i);
  const cookieHeader = cookie!.split(";")[0];
  const current = await auth.api.getSession({ headers: new Headers({ cookie: cookieHeader }) });
  expect(current?.user.id).toBe(created.user.id);

  await db.update(session).set({ expiresAt: new Date(0) }).where(eq(session.userId, created.user.id));
  expect(await auth.api.getSession({ headers: new Headers({ cookie: cookieHeader }) })).toBeNull();

  const attempts = [];
  for (let index = 0; index < 4; index += 1) attempts.push((await signIn("incorrect-test-password")).status);
  expect(attempts).toContain(429);
  expect(attempts.every((status) => status === 401 || status === 429)).toBe(true);
});
