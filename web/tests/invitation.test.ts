import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { initializeDatabase } from "@/lib/db/migrate";
import { invitation, user } from "@/lib/db/schema";
import { claimInvitation, createInvitation } from "@/lib/auth/invitations";

const client = new PGlite();
const db = drizzle(client);
beforeAll(async () => {
  await initializeDatabase(db);
  await db.insert(user).values([
    { id: "admin", name: "Admin", email: "admin@example.invalid", role: "admin" },
    { id: "learner", name: "Learner", email: "learner@example.invalid" },
  ]);
});
afterAll(async () => { await client.close(); });

describe("lời mời tài khoản", () => {
  it("chỉ người quản trị tạo được lời mời và chỉ lưu bản băm", async () => {
    await expect(createInvitation(db, "learner")).rejects.toThrow();
    const token = await createInvitation(db, "admin");
    const rows = await db.select().from(invitation);
    expect(rows).toHaveLength(1);
    expect(rows[0].hash).not.toContain(token);
  });

  it("một lời mời chỉ được sử dụng một lần", async () => {
    const token = await createInvitation(db, "admin");
    const claims = await Promise.all([claimInvitation(db, token), claimInvitation(db, token)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await claimInvitation(db, "not-a-real-invitation")).toBeNull();
  });

  it("từ chối lời mời hết hạn", async () => {
    const token = await createInvitation(db, "admin");
    const hash = createHash("sha256").update(token).digest("hex");
    await db.update(invitation).set({ expiresAt: new Date(0) }).where(eq(invitation.hash, hash));
    expect(await claimInvitation(db, token)).toBeNull();
  });
});
