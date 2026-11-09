import type { PgliteDatabase } from "drizzle-orm/pglite";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { invitation, user } from "@/lib/db/schema";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createInvitation(db: PgliteDatabase, userId: string): Promise<string> {
  const [owner] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId)).limit(1);
  if (owner?.role !== "admin") throw new Error("Chỉ người quản trị mới tạo được lời mời.");
  const token = randomBytes(32).toString("base64url");
  await db.insert(invitation).values({
    hash: hashToken(token), createdBy: userId, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  return token;
}

export async function claimInvitation(db: PgliteDatabase, token: string): Promise<Date | null> {
  if (token.length < 32 || token.length > 128) return null;
  const now = new Date();
  const [claimed] = await db.update(invitation).set({ usedAt: now }).where(and(
    eq(invitation.hash, hashToken(token)), isNull(invitation.usedAt), gt(invitation.expiresAt, now),
  )).returning({ usedAt: invitation.usedAt });
  return claimed?.usedAt ?? null;
}

export async function releaseInvitation(db: PgliteDatabase, token: string, claimedAt: Date): Promise<void> {
  await db.update(invitation).set({ usedAt: null }).where(and(eq(invitation.hash, hashToken(token)), eq(invitation.usedAt, claimedAt)));
}
