import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { initializeDatabase } from "@/lib/db/migrate";
import { createAuth } from "@/lib/auth/config";
import { account } from "@/lib/db/schema";

const client = new PGlite();
const db = drizzle(client);
const secret = "test-secret-for-an-isolated-test-only-1234567890";
const auth = createAuth(db, { secret, baseURL: "http://localhost:3000" });

beforeAll(async () => { await initializeDatabase(db); });
afterAll(async () => { await client.close(); });

describe("đăng ký được kiểm soát", () => {
  it("từ chối đăng ký không đi qua luồng thiết lập hoặc lời mời", async () => {
    await expect(auth.api.signUpEmail({ body: { name: "Test", email: "blocked@example.invalid", password: "test-password-123" } })).rejects.toThrow();
  });

  it("cho phép tạo tài khoản từ luồng nội bộ rồi đăng nhập với mật khẩu đúng", async () => {
    const headers = new Headers({ "x-roadmap-internal": secret });
    await auth.api.signUpEmail({ headers, body: { name: "A", email: "a@example.invalid", password: "test-password-123" } });
    const [stored] = await db.select().from(account);
    expect(stored.password).toBeTruthy();
    expect(stored.password).not.toBe("test-password-123");
    const result = await auth.api.signInEmail({ body: { email: "a@example.invalid", password: "test-password-123" } });
    expect(result.user.email).toBe("a@example.invalid");
    await expect(auth.api.signInEmail({ body: { email: "a@example.invalid", password: "wrong-password-123" } })).rejects.toThrow();
  });
});
