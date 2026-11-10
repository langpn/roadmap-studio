import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { constants } from "node:fs";
import { access, chmod, copyFile, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { initializeDatabase } from "@/lib/db/migrate";

const run = promisify(execFile);

/** Mục duy nhất được phép có trong một bản sao lưu hợp lệ. */
const ALLOWED_ROOT_ENTRIES = new Set(["postgres", "auth-secret"]);
/** Chặn archive rác hoặc archive giải nén phình to trước khi ghi ra đĩa. */
const MAX_ARCHIVE_ENTRIES = 200_000;

/** Dữ liệu PGlite nằm trong `<dataDir>/postgres`; `auth-secret` đi kèm ở thư mục cha. */
export function pgDataDir(dataDir: string): string {
  return path.join(path.resolve(dataDir), "postgres");
}

async function exists(target: string): Promise<boolean> {
  try { await access(target); return true; } catch { return false; }
}

async function sha256(file: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

/**
 * Đường dẫn thật: `realpath` phần tồn tại gần nhất rồi nối phần chưa tồn tại.
 * Nhờ vậy một symlink trỏ vào dữ liệu thật bị phát hiện trước khi tạo/ghi.
 */
async function canonical(target: string): Promise<string> {
  const parts: string[] = [];
  let current = path.resolve(target);
  for (;;) {
    try {
      return path.join(await realpath(current), ...parts.reverse());
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(target);
      parts.push(path.basename(current));
      current = parent;
    }
  }
}

function sameOrInside(child: string, parent: string): boolean {
  return child === parent || child.startsWith(`${parent}${path.sep}`);
}

/** Bảo vệ dữ liệu thật theo cả hai chiều: không trùng, không nằm trong, không chứa. */
function assertOutsideLiveData(candidate: string, live: string, what: string): void {
  if (sameOrInside(candidate, live)) throw new Error(`${what} không được trùng hoặc nằm trong thư mục dữ liệu thật.`);
  if (sameOrInside(live, candidate)) throw new Error(`${what} không được là thư mục cha của dữ liệu thật.`);
}

async function lsofPids(args: string[]): Promise<{ pids: string[]; spawnFailed: boolean }> {
  try {
    const { stdout } = await run("lsof", args);
    return { pids: stdout.split("\n").map((line) => line.trim()).filter(Boolean), spawnFailed: false };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; code?: string | number };
    // macOS: lsof vẫn in kết quả ra stdout dù thoát mã 1 vì cảnh báo quyền.
    if (failure.code !== 1) return { pids: [], spawnFailed: true };
    return { pids: (failure.stdout ?? "").split("\n").map((line) => line.trim()).filter(Boolean), spawnFailed: false };
  }
}

/**
 * PGlite 0.5.15 không khóa thư mục: tiến trình thứ hai vẫn mở và ghi được cùng dữ
 * liệu, nên phải hỏi hệ điều hành. `postmaster.pid` không dùng được (pid luôn
 * `-42` và tệp còn lại sau `kill`). Khi không chứng minh được database đã đóng,
 * hàm này ném lỗi thay vì cho qua: thà chặn nhầm còn hơn sao lưu dữ liệu đang ghi.
 */
async function assertDatabaseClosed(dataDir: string): Promise<void> {
  const pgDir = pgDataDir(dataDir);
  if (!(await exists(path.join(pgDir, "PG_VERSION")))) throw new Error(`Không thấy database PGlite tại ${pgDir}.`);

  const scan = await lsofPids(["-nP", "-t", "+D", pgDir]);
  if (scan.spawnFailed) throw new Error("Lệnh lsof không chạy được hoặc gặp lỗi; không xác nhận được database đã đóng.");
  if (scan.pids.length) throw new Error("Database đang được một tiến trình mở. Hãy dừng máy chủ rồi chạy lại.");

  // Đối chứng dương: lsof phải nhìn thấy chính tiến trình này. Nếu không, kết quả
  // rỗng ở trên không đáng tin (lsof hỏng, bị chặn quyền, hoặc không đọc được thư mục).
  const control = await lsofPids(["-nP", "-t", "-p", String(process.pid)]);
  if (!control.pids.includes(String(process.pid))) throw new Error("lsof không trả về tiến trình hiện tại; không xác nhận được database đã đóng nên dừng lại.");
}

export type LocalBackup = { file: string; sha256File: string; sha256: string; bytes: number };

/** Sao lưu khi database đã đóng: archive PGDATA + `auth-secret`, kèm checksum, không ghi đè. */
export async function backupLocalDatabase(options: { dataDir: string; outDir: string; now?: Date }): Promise<LocalBackup> {
  const dataDir = path.resolve(options.dataDir);
  const live = await canonical(dataDir);
  const outDir = path.resolve(options.outDir);
  await assertDatabaseClosed(dataDir);

  // Kiểm tra trước khi tạo thư mục, rồi kiểm lại sau khi tạo để bắt symlink vừa tráo.
  assertOutsideLiveData(await canonical(outDir), live, "Thư mục đích");
  await mkdir(outDir, { recursive: true, mode: 0o700 });
  assertOutsideLiveData(await realpath(outDir), live, "Thư mục đích");

  const entries = ["postgres"];
  if (await exists(path.join(dataDir, "auth-secret"))) entries.push("auth-secret");
  const name = `roadmap-pglite-${stamp(options.now ?? new Date())}.tar.gz`;
  const file = path.join(outDir, name);
  const sha256File = `${file}.sha256`;

  // mkdtemp cấp một thư mục độc quyền: mọi thứ trong đó chắc chắn do lần chạy này tạo.
  const staging = await mkdtemp(path.join(outDir, ".roadmap-backup-"));
  try {
    const archiveInStaging = path.join(staging, name);
    // postmaster.pid là tệp runtime: không đưa vào bản sao để lần mở sau không thấy dấu hiệu cũ.
    await run("tar", ["-czf", archiveInStaging, "-C", dataDir, "--exclude", "postgres/postmaster.pid", ...entries]);
    if (!(await stat(archiveInStaging)).size) throw new Error("Bản sao lưu rỗng.");
    await chmod(archiveInStaging, 0o600);

    const digest = await sha256(archiveInStaging);
    const shaInStaging = path.join(staging, `${name}.sha256`);
    await writeFile(shaInStaging, `${digest}  ${name}\n`, { flag: "wx", mode: 0o600 });

    // Xuất bản bằng copy độc quyền: tên đã tồn tại thì thất bại, không ghi đè ai.
    await copyFile(archiveInStaging, file, constants.COPYFILE_EXCL);
    try {
      await copyFile(shaInStaging, sha256File, constants.COPYFILE_EXCL);
    } catch (error) {
      // Không để lại nửa cặp tệp: bản .tar.gz không có checksum thì không dùng được.
      await rm(file, { force: true });
      throw error;
    }
    return { file, sha256File, sha256: digest, bytes: (await stat(file)).size };
  } finally {
    // Chỉ xóa thư mục do mkdtemp tạo; không đụng thư mục đích của người dùng.
    await rm(staging, { recursive: true, force: true });
  }
}

function safeEntryName(raw: string): string {
  if (!raw || raw.includes("\0")) throw new Error("Tệp lưu trữ có tên không hợp lệ.");
  if (raw.startsWith("/") || /^[A-Za-z]:[\\/]/.test(raw)) throw new Error(`Tệp lưu trữ chứa đường dẫn tuyệt đối: ${raw}`);
  if (raw.includes("\\")) throw new Error(`Tệp lưu trữ chứa dấu \\ trong tên: ${raw}`);
  const segments = raw.replace(/\/$/, "").split("/").filter((segment) => segment !== "" && segment !== ".");
  if (!segments.length) throw new Error("Tệp lưu trữ có mục rỗng.");
  if (segments.some((segment) => segment === "..")) throw new Error(`Tệp lưu trữ chứa đường dẫn đi ngược: ${raw}`);
  if (!ALLOWED_ROOT_ENTRIES.has(segments[0])) throw new Error(`Tệp lưu trữ chứa mục lạ: ${raw}`);
  if (segments[0] === "auth-secret" && segments.length !== 1) throw new Error(`Tệp lưu trữ có mục lạ dưới auth-secret: ${raw}`);
  return segments[0];
}

/**
 * Kiểm tra archive trước khi giải nén: chỉ `postgres/` và `auth-secret`, không
 * đường dẫn tuyệt đối hay `..`, không symlink/hardlink hay loại tệp khác. `tar -t`
 * chỉ đọc danh sách nên chưa ghi gì ra đĩa.
 */
async function assertSafeArchive(archive: string): Promise<number> {
  const { stdout: names } = await run("tar", ["-tzf", archive], { maxBuffer: 32 * 1024 * 1024 });
  const list = names.split("\n").filter(Boolean);
  if (!list.length) throw new Error("Tệp lưu trữ rỗng.");
  if (list.length > MAX_ARCHIVE_ENTRIES) throw new Error("Tệp lưu trữ có quá nhiều mục.");

  // Dòng -tv bắt đầu bằng loại mục: '-' tệp thường, 'd' thư mục. 'l'/'h' bị chặn.
  const { stdout: types } = await run("tar", ["-tvzf", archive], { maxBuffer: 32 * 1024 * 1024 });
  const typeLines = types.split("\n").filter(Boolean);
  if (typeLines.length !== list.length) throw new Error("Không đọc được đầy đủ danh sách mục của tệp lưu trữ.");
  for (const line of typeLines) {
    const kind = line[0];
    if (kind !== "-" && kind !== "d") throw new Error(`Tệp lưu trữ chứa mục không phải tệp/thư mục thường (${kind}).`);
  }

  for (const raw of list) safeEntryName(raw);
  return list.length;
}

/**
 * Phục hồi vào thư mục chưa tồn tại. Từ chối mọi đích đã có (kể cả rỗng) để không
 * bao giờ xóa hay trộn vào thư mục của người dùng, và từ chối mọi đích trùng,
 * nằm trong hoặc chứa thư mục dữ liệu thật (kể cả qua symlink).
 */
export async function restoreLocalDatabase(options: { archive: string; toDir: string; liveDataDir?: string }): Promise<{ toDir: string }> {
  const archive = path.resolve(options.archive);
  const toDir = path.resolve(options.toDir);
  const live = await canonical(options.liveDataDir ?? path.join(process.cwd(), ".data"));

  if (!(await exists(archive))) throw new Error(`Không thấy tệp sao lưu: ${archive}`);
  if ((await stat(archive)).isDirectory()) throw new Error("--archive phải là tệp, không phải thư mục.");
  // lstat để bắt cả symlink hỏng, thứ mà access() coi như không tồn tại.
  const occupied = await lstat(toDir).then(() => true).catch(() => false);
  if (occupied) throw new Error("Thư mục đích đã tồn tại. Hãy chọn đường dẫn mới; không ghi đè hay xóa thư mục sẵn có.");
  const parent = path.dirname(toDir);
  if (!(await exists(parent))) throw new Error(`Thư mục cha của đích phải tồn tại: ${parent}`);
  if (!(await stat(parent)).isDirectory()) throw new Error(`Thư mục cha của đích không phải thư mục: ${parent}`);
  assertOutsideLiveData(await canonical(toDir), live, "Thư mục đích");

  // Checksum là bắt buộc: thiếu tệp .sha256 nghĩa là chưa xác minh được toàn vẹn.
  const checksumFile = `${archive}.sha256`;
  if (!(await exists(checksumFile))) throw new Error(`Thiếu tệp checksum ${checksumFile}; không phục hồi khi chưa xác minh toàn vẹn.`);
  const expected = (await readFile(checksumFile, "utf8")).trim().split(/\s+/)[0];
  if (!/^[0-9a-f]{64}$/.test(expected ?? "")) throw new Error("Tệp checksum không đúng định dạng SHA-256.");
  if (expected !== await sha256(archive)) throw new Error("Checksum không khớp; không phục hồi.");

  await assertSafeArchive(archive);

  const staging = await mkdtemp(path.join(parent, ".roadmap-restore-"));
  try {
    assertOutsideLiveData(await realpath(staging), live, "Thư mục tạm khi phục hồi");
    await run("tar", ["-xzf", archive, "-C", staging, "--no-same-owner", "--no-same-permissions"]);
    if (!(await exists(path.join(pgDataDir(staging), "PG_VERSION")))) {
      throw new Error("Tệp lưu trữ không chứa database PGlite (thiếu postgres/PG_VERSION).");
    }
    // postmaster.pid là trạng thái runtime (pid luôn là -42); bản sao cũ có thể còn tệp này.
    await rm(path.join(pgDataDir(staging), "postmaster.pid"), { force: true });

    // mkdir không recursive: nếu ai đó vừa tạo đích, lệnh thất bại và ta không xóa gì.
    await mkdir(toDir, { mode: 0o700 });
    try {
      await rename(path.join(staging, "postgres"), path.join(toDir, "postgres"));
      if (await exists(path.join(staging, "auth-secret"))) {
        await rename(path.join(staging, "auth-secret"), path.join(toDir, "auth-secret"));
      }
    } catch (error) {
      // Chỉ xóa thư mục đích khi chính lời gọi này tạo được nó.
      await rm(toDir, { recursive: true, force: true });
      throw error;
    }
    return { toDir };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export type LocalDatabaseSummary = {
  users: number;
  admins: number;
  catalogCourses: number;
  catalogLessons: number;
  lessonProgress: number;
  practiceProgress: number;
  mediaLinks: number;
  catalogHistory: number;
};

/** Mở database để đếm dữ liệu; chỉ chạy migration khi được yêu cầu. */
export async function inspectLocalDatabase(dataDir: string, options: { migrate?: boolean } = {}): Promise<LocalDatabaseSummary> {
  const dataDirResolved = path.resolve(dataDir);
  await assertDatabaseClosed(dataDirResolved);
  const client = new PGlite(pgDataDir(dataDirResolved));
  try {
    if (options.migrate) await initializeDatabase(drizzle(client));
    const count = async (query: string) => Number((await client.query<{ n: number }>(query)).rows[0].n);
    const [snapshot] = (await client.query<{ content: string }>("select content from catalog_snapshot where id = 'active'")).rows;
    const catalog = snapshot ? JSON.parse(snapshot.content) as { courses: unknown[]; lessonCount: number } : null;
    return {
      users: await count('select count(*)::int as n from "user"'),
      admins: await count(`select count(*)::int as n from "user" where role = 'admin'`),
      catalogCourses: catalog?.courses.length ?? 0,
      catalogLessons: catalog?.lessonCount ?? 0,
      lessonProgress: await count("select count(*)::int as n from lesson_progress"),
      practiceProgress: await count("select count(*)::int as n from practice_progress"),
      mediaLinks: await count("select count(*)::int as n from lesson_media"),
      catalogHistory: await count("select count(*)::int as n from catalog_history"),
    };
  } finally {
    await client.close();
  }
}
