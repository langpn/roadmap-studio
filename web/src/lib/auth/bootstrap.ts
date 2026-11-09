import type { PgliteDatabase } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { account, setupGuard, user } from "@/lib/db/schema";
import type { createAuth } from "./config";

export class SetupUnavailableError extends Error {
  constructor(message = "Hệ thống đã có tài khoản hoặc đang được thiết lập.") {
    super(message);
    this.name = "SetupUnavailableError";
  }
}

export async function bootstrapFirstAdmin(
  db: PgliteDatabase,
  auth: ReturnType<typeof createAuth>,
  secret: string,
  details: { name: string; email: string; password: string },
): Promise<void> {
  const existing = await db.select({ id: user.id }).from(user).limit(1);
  if (existing.length) throw new SetupUnavailableError();

  // setup_guard has a fixed primary key: only one caller may hold it, even across processes.
  const guard = await db.insert(setupGuard).values({ id: "first-admin" }).onConflictDoNothing().returning();
  if (!guard.length) throw new SetupUnavailableError("Đang có tiến trình thiết lập tài khoản.");

  let createdId: string;
  try {
    const result = await auth.api.signUpEmail({ headers: new Headers({ "x-roadmap-internal": secret }), body: details });
    createdId = result.user.id;
  } catch (error) {
    // Sign-up can report an error after the account row is already written (session or mail hooks).
    // Promote only that same account, so an invitation-created user can never gain admin here.
    const requested = details.email.trim().toLowerCase();
    const created = await db.select({ id: user.id, email: user.email }).from(user).limit(2);
    const ours = created.length === 1 && created[0].email.toLowerCase() === requested ? created[0].id : null;
    if (!ours) {
      // Keep the guard closed when any account exists; setup cannot reopen for a second admin.
      if (!created.length) await db.delete(setupGuard).where(eq(setupGuard.id, "first-admin"));
      if (created.length) throw new SetupUnavailableError();
      throw error;
    }
    // A user row without credentials could never sign in: remove it and let the owner retry cleanly.
    const credentials = await db.select({ id: account.id }).from(account).where(eq(account.userId, ours)).limit(1);
    if (!credentials.length) {
      await db.delete(user).where(eq(user.id, ours));
      await db.delete(setupGuard).where(eq(setupGuard.id, "first-admin"));
      throw error;
    }
    createdId = ours;
  }

  try {
    await db.update(user).set({ role: "admin" }).where(eq(user.id, createdId));
  } catch {
    try {
      await db.update(user).set({ role: "admin" }).where(eq(user.id, createdId));
    } catch {
      // Promotion failed twice: remove the half-made account and release setup so the owner can retry.
      try {
        await db.delete(user).where(eq(user.id, createdId));
        await db.delete(setupGuard).where(eq(setupGuard.id, "first-admin"));
      } catch {
        // Keep the guard closed rather than risk opening a second admin.
      }
      throw new Error("Không nâng được quyền quản trị cho tài khoản đầu tiên.");
    }
  }
}
