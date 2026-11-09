import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDatabase } from "@/lib/db";
import { createAuth } from "./config";

const globalAuth = globalThis as typeof globalThis & { roadmapAuth?: Promise<ReturnType<typeof createAuth>> };

export async function getAuthSecret(): Promise<string> {
  if (process.env.BETTER_AUTH_SECRET) {
    if (process.env.BETTER_AUTH_SECRET.length < 32) throw new Error("BETTER_AUTH_SECRET phải có ít nhất 32 ký tự.");
    return process.env.BETTER_AUTH_SECRET;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Cần cấu hình BETTER_AUTH_SECRET khi triển khai.");
  const dir = path.resolve(process.cwd(), ".data");
  const file = path.join(dir, "auth-secret");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  try {
    await writeFile(file, randomBytes(48).toString("base64url"), { flag: "wx", mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  return (await readFile(file, "utf8")).trim();
}

export function getAuth(): Promise<ReturnType<typeof createAuth>> {
  globalAuth.roadmapAuth ??= Promise.all([getDatabase(), getAuthSecret()]).then(([db, secret]) => createAuth(db, {
    secret,
    baseURL: process.env.BETTER_AUTH_URL || "http://127.0.0.1:3000",
  }));
  return globalAuth.roadmapAuth;
}
