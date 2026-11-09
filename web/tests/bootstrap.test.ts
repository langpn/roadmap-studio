import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import { initializeDatabase } from "@/lib/db/migrate";
import { setupGuard, user, account } from "@/lib/db/schema";
import { createAuth } from "@/lib/auth/config";
import { bootstrapFirstAdmin, SetupUnavailableError } from "@/lib/auth/bootstrap";

const client = new PGlite();
const db = drizzle(client);
const secret = "test-bootstrap-secret-0123456789abcdef0123456789abcdef";
const password = "correct-horse-battery-staple";
const auth = createAuth(db, { secret, baseURL: "http://localhost:3000" });

beforeAll(async () => { await initializeDatabase(db); });
beforeEach(async () => { await db.execute(sql.raw('TRUNCATE TABLE "user", setup_guard CASCADE')); });
afterAll(async () => { await client.close(); });

describe("bootstrapFirstAdmin", () => {
  it("tạo quản trị viên đầu tiên khi database trống", async () => {
    await bootstrapFirstAdmin(db, auth, secret, { name: "Chủ máy", email: "owner@example.invalid", password });
    const [owner] = await db.select().from(user).where(eq(user.email, "owner@example.invalid"));
    expect(owner.role).toBe("admin");
    expect(await db.select().from(setupGuard)).toHaveLength(1);
  });

  it("từ chối tạo quản trị viên thứ hai", async () => {
    await bootstrapFirstAdmin(db, auth, secret, { name: "Chủ máy", email: "owner@example.invalid", password });
    await expect(
      bootstrapFirstAdmin(db, auth, secret, { name: "Khác", email: "other@example.invalid", password }),
    ).rejects.toBeInstanceOf(SetupUnavailableError);
    const rows = await db.select().from(user);
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("admin");
  });

  it("chỉ một trong hai lần gọi đồng thời tạo được tài khoản", async () => {
    const results = await Promise.allSettled([
      bootstrapFirstAdmin(db, auth, secret, { name: "Người một", email: "one@example.invalid", password }),
      bootstrapFirstAdmin(db, auth, secret, { name: "Người hai", email: "two@example.invalid", password }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect(rejected[0].status === "rejected" && rejected[0].reason).toBeInstanceOf(SetupUnavailableError);

    const rows = await db.select().from(user);
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("admin");
  });

  it("giải phóng khóa để thử lại khi tạo tài khoản thất bại", async () => {
    await expect(
      bootstrapFirstAdmin(db, auth, secret, { name: "Lỗi", email: "khong-phai-email", password }),
    ).rejects.toThrow();
    expect(await db.select().from(setupGuard)).toHaveLength(0);
    expect(await db.select().from(user)).toHaveLength(0);

    await bootstrapFirstAdmin(db, auth, secret, { name: "Chủ máy", email: "owner@example.invalid", password });
    const [owner] = await db.select().from(user);
    expect(owner.role).toBe("admin");
  });

  it("không nâng quyền tài khoản đã tồn tại", async () => {
    await db.insert(user).values({ id: "existing", name: "Người cũ", email: "existing@example.invalid" });
    await expect(
      bootstrapFirstAdmin(db, auth, secret, { name: "Chủ máy", email: "owner@example.invalid", password }),
    ).rejects.toBeInstanceOf(SetupUnavailableError);
    const [existing] = await db.select().from(user).where(eq(user.id, "existing"));
    expect(existing.role).toBe("user");
  });

  it("vẫn nâng quyền khi lần cập nhật đầu thất bại tạm thời", async () => {
    let failures = 1;
    const flaky = new Proxy(db, {
      get(target, property, receiver) {
        if (property !== "update") return Reflect.get(target, property, receiver);
        return (...args: unknown[]) => {
          if (failures > 0) {
            failures -= 1;
            throw new Error("mất kết nối tạm thời");
          }
          return Reflect.apply(target.update as (...values: unknown[]) => unknown, target, args);
        };
      },
    });
    await bootstrapFirstAdmin(flaky as typeof db, auth, secret, { name: "Chủ máy", email: "owner@example.invalid", password });
    const [owner] = await db.select().from(user);
    expect(owner.role).toBe("admin");
    expect(await db.select().from(setupGuard)).toHaveLength(1);
  });

  it("hoàn tất nâng quyền khi tài khoản đã tạo nhưng đăng ký báo lỗi", async () => {
    const partialAuth = {
      api: {
        signUpEmail: async () => {
          await db.insert(user).values({ id: "partial", name: "Dở dang", email: "partial@example.invalid" });
          await db.insert(account).values({ id: "partial-credential", accountId: "partial", providerId: "credential", userId: "partial", password: "gia-ma-khong-dung-duoc" });
          throw new Error("lỗi sau khi tạo tài khoản");
        },
      },
    } as unknown as typeof auth;
    await bootstrapFirstAdmin(db, partialAuth, secret, { name: "Dở dang", email: "partial@example.invalid", password });
    const [partial] = await db.select().from(user);
    expect(partial.role).toBe("admin");
    expect(await db.select().from(setupGuard)).toHaveLength(1);
    await expect(
      bootstrapFirstAdmin(db, auth, secret, { name: "Kẻ khác", email: "attacker@example.invalid", password }),
    ).rejects.toBeInstanceOf(SetupUnavailableError);
  });

  it("dọn tài khoản dở dang không có mật khẩu để chủ máy thử lại", async () => {
    const brokenAuth = {
      api: {
        signUpEmail: async () => {
          await db.insert(user).values({ id: "broken", name: "Dở dang", email: "broken@example.invalid" });
          throw new Error("ghi tài khoản chưa xong");
        },
      },
    } as unknown as typeof auth;
    await expect(
      bootstrapFirstAdmin(db, brokenAuth, secret, { name: "Dở dang", email: "broken@example.invalid", password }),
    ).rejects.toThrow("ghi tài khoản chưa xong");
    expect(await db.select().from(user)).toHaveLength(0);
    expect(await db.select().from(setupGuard)).toHaveLength(0);

    await bootstrapFirstAdmin(db, auth, secret, { name: "Chủ máy", email: "owner@example.invalid", password });
    const [owner] = await db.select().from(user);
    expect(owner.role).toBe("admin");
  });

  it("không nâng quyền khi có nhiều tài khoản xuất hiện bất thường", async () => {
    const racingAuth = {
      api: {
        signUpEmail: async () => {
          await db.insert(user).values({ id: "raced", name: "Thứ nhất", email: "raced@example.invalid" });
          await db.insert(user).values({ id: "other", name: "Thứ hai", email: "other@example.invalid" });
          throw new Error("dữ liệu bất thường");
        },
      },
    } as unknown as typeof auth;
    await expect(
      bootstrapFirstAdmin(db, racingAuth, secret, { name: "Đầu tiên", email: "first@example.invalid", password }),
    ).rejects.toBeInstanceOf(SetupUnavailableError);
    const rows = await db.select().from(user);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.role === "user")).toBe(true);
  });

  it("không nâng quyền cho tài khoản được tạo bằng lời mời khi đăng ký thiết lập lỗi", async () => {
    const invitedAuth = {
      api: {
        signUpEmail: async () => {
          await db.insert(user).values({ id: "invited", name: "Người được mời", email: "invited@example.invalid" });
          throw new Error("email xác minh gửi lỗi");
        },
      },
    } as unknown as typeof auth;
    await expect(
      bootstrapFirstAdmin(db, invitedAuth, secret, { name: "Kẻ mạo danh", email: "impostor@example.invalid", password }),
    ).rejects.toBeInstanceOf(SetupUnavailableError);
    const [invited] = await db.select().from(user);
    expect(invited.role).toBe("user");
    expect(await db.select().from(setupGuard)).toHaveLength(1);
  });
});
