import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { initializeDatabase } from "@/lib/db/migrate";
import { user as userTable } from "@/lib/db/schema";
import { claimInvitation, createInvitation } from "@/lib/auth/invitations";
import { authClient, signIn, signOut, useSession } from "@/lib/auth/client";

const client = new PGlite();
const db = drizzle(client);

beforeAll(async () => {
  await initializeDatabase(db);
  await db.insert(userTable).values([
    { id: "admin-user", name: "Quản trị viên", email: "admin@duongdung.local", role: "admin" },
    { id: "learner-user", name: "Học viên A", email: "learner@duongdung.local", role: "user" },
  ]);
});

afterAll(async () => {
  await client.close();
});

describe("Auth Client và Trang tài khoản", () => {
  it("khởi tạo authClient và xuất đủ các hàm xác thực cần thiết", () => {
    expect(authClient).toBeDefined();
    expect(typeof signIn).toBe("function");
    expect(typeof signIn.email).toBe("function");
    expect(typeof signOut).toBe("function");
    expect(typeof useSession).toBe("function");
  });

  it("phân biệt rõ quyền admin và user thường khi truy vấn database", async () => {
    const [adminRow] = await db
      .select({ role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, "admin-user"))
      .limit(1);

    const [learnerRow] = await db
      .select({ role: userTable.role })
      .from(userTable)
      .where(eq(userTable.id, "learner-user"))
      .limit(1);

    expect(adminRow?.role).toBe("admin");
    expect(learnerRow?.role).toBe("user");
  });

  it("quản trị viên tạo được mã mời dùng 1 lần và kiểm tra claim", async () => {
    const token = await createInvitation(db, "admin-user");
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThanOrEqual(32);

    // Học viên không có quyền tạo
    await expect(createInvitation(db, "learner-user")).rejects.toThrow();

    // Claim lần 1 thành công
    const claimedAt = await claimInvitation(db, token);
    expect(claimedAt).not.toBeNull();

    // Claim lần 2 thất bại vì mã dùng 1 lần
    const secondClaim = await claimInvitation(db, token);
    expect(secondClaim).toBeNull();
  });
});
