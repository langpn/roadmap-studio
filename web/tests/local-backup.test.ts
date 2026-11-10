import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { backupLocalDatabase, inspectLocalDatabase, pgDataDir, restoreLocalDatabase } from "@/lib/ops/local-backup";
import { demoCatalog } from "@/lib/catalog/demo";

// Kiểm thử tấn công: mọi thư mục đều là fixture tạm, không đọc/ghi web/.data.
// Tiến trình con mô phỏng "khởi động lại ứng dụng": mỗi lần chạy là process mới.

const run = promisify(execFile);
const webRoot = process.cwd();
const fixture = path.join(webRoot, "tests", "fixtures", "local-database.ts");
const holdFixture = path.join(webRoot, "tests", "fixtures", "hold-database.ts");
const demoLessons = demoCatalog.lessonCount;
let root: string;
let liveDir: string;
let live: string;

async function phase(name: "seed" | "verify", dataDir: string): Promise<string> {
  const { stdout } = await run(process.execPath, ["--import", "tsx", fixture, name], {
    cwd: webRoot,
    env: { ...process.env, NODE_ENV: "test", PGLITE_DATA_DIR: dataDir },
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout.trim();
}

function parsed(stdout: string) {
  return JSON.parse(stdout.slice(stdout.lastIndexOf("\n") + 1)) as {
    ownerRole: string | null;
    signedInId: string;
    catalogLessons: number;
    progress: { lessons: Record<string, string>; practices: Record<string, string>; lastOpenedLessonId: string | null };
    media: { lessonId: string; embedUrl: string }[];
  };
}

/** Giữ PGlite mở trong một tiến trình riêng để kiểm tra guard "database đang mở". */
async function withDatabaseOpen<T>(body: () => Promise<T>): Promise<T> {
  const holder = run(process.execPath, ["--import", "tsx", holdFixture], {
    cwd: webRoot,
    env: { ...process.env, NODE_ENV: "test", PGLITE_DATA_DIR: liveDir },
  });
  await new Promise((resolve) => setTimeout(resolve, 3000));
  try {
    return await body();
  } finally {
    await holder;
  }
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(os.tmpdir(), "roadmap-local-db-")));
  liveDir = path.join(root, "live");
  live = await realpath(liveDir).catch(() => liveDir);
});

afterAll(async () => {
  // Giữ lại thư mục khi cần điều tra; mặc định dọn để không tích tụ bản sao thử.
  if (!process.env.KEEP_LOCAL_DB_TEST_DIR) await rm(root, { recursive: true, force: true });
});

describe("chạy local với PGlite và khởi động lại", () => {
  it("giữ tài khoản, tiến độ giả, danh mục và liên kết sau khi tiến trình cũ đóng", async () => {
    expect(await phase("seed", liveDir)).toContain("seed xong");
    expect(await realpath(liveDir)).toBe(live);
    const again = parsed(await phase("verify", liveDir));

    expect(again.ownerRole).toBe("admin");
    expect(again.signedInId).toBeTruthy();
    expect(again.catalogLessons).toBe(demoLessons);
    expect(again.progress.lessons).toMatchObject({ "90000": "completed" });
    expect(again.progress.practices).toMatchObject({ "clip-first": "in_progress" });
    expect(again.progress.lastOpenedLessonId).toBe("90000");
    expect(again.media.map((entry) => entry.lessonId)).toEqual(["90000"]);
  }, 120_000);
});

describe("guard database đang mở (fail closed)", () => {
  it("từ chối sao lưu khi còn tiến trình mở database", async () => {
    await withDatabaseOpen(async () => {
      await expect(backupLocalDatabase({ dataDir: liveDir, outDir: path.join(root, "out-open") })).rejects.toThrow(/đang được một tiến trình mở/);
    });
  }, 60_000);

  it("từ chối đếm dữ liệu khi ứng dụng đang mở database", async () => {
    await withDatabaseOpen(async () => {
      await expect(inspectLocalDatabase(liveDir)).rejects.toThrow(/đang được một tiến trình mở/);
    });
  }, 60_000);

  it("không dựa vào postmaster.pid: tệp sót lại không chặn và không nằm trong archive", async () => {
    const pidFile = path.join(pgDataDir(liveDir), "postmaster.pid");
    await writeFile(pidFile, "-42\n/pglite/data\n1\n5432\n");
    const result = await backupLocalDatabase({ dataDir: liveDir, outDir: path.join(root, "out-stale") });
    const { stdout } = await run("tar", ["-tzf", result.file]);
    expect(stdout).not.toContain("postmaster.pid");
    await rm(pidFile, { force: true });
  }, 60_000);

  it("fail closed khi không có lsof (PATH rỗng nghĩa là máy không có công cụ để kiểm tra)", async () => {
    const originalPath = process.env.PATH;
    process.env.PATH = path.join(root, "khong-co-lsof");
    try {
      await expect(backupLocalDatabase({ dataDir: liveDir, outDir: path.join(root, "out-nolsof") })).rejects.toThrow(/lsof/);
    } finally {
      process.env.PATH = originalPath;
    }
  }, 60_000);
});

describe("đường dẫn đích: không ghi vào hoặc quanh dữ liệu thật", () => {
  it("từ chối đích nằm trong thư mục dữ liệu", async () => {
    await expect(backupLocalDatabase({ dataDir: liveDir, outDir: path.join(liveDir, "backups") })).rejects.toThrow(/thư mục dữ liệu/);
  });

  it("từ chối khi lsof lỗi quét dù đối chứng tiến trình thành công", async () => {
    if (!(await stat(liveDir).catch(() => null))) await phase("seed", liveDir);
    const bin = path.join(root, "lsof-error");
    await mkdir(bin);
    const fake = path.join(bin, "lsof");
    await writeFile(fake, '#!/bin/sh\nif [ "$3" = "-p" ]; then echo "$4"; exit 0; fi\nexit 2\n');
    await chmod(fake, 0o755);
    const originalPath = process.env.PATH;
    process.env.PATH = `${bin}:${originalPath}`;
    try {
      await expect(backupLocalDatabase({ dataDir: liveDir, outDir: path.join(root, "out-lsof-error") })).rejects.toThrow(/lsof/);
    } finally {
      process.env.PATH = originalPath;
    }
  }, 60_000);

  it("từ chối đích là thư mục cha của dữ liệu (sao lưu sẽ nuốt chính dữ liệu thật)", async () => {
    // root chứa live/: chấp nhận sao lưu vào root sẽ đóng gói lẫn chính .data.
    await expect(backupLocalDatabase({ dataDir: liveDir, outDir: root })).rejects.toThrow(/thư mục cha/);
  });

  it("từ chối đích là symlink trỏ vào dữ liệu thật", async () => {
    const link = path.join(root, "link-to-live");
    await symlink(liveDir, link);
    await expect(backupLocalDatabase({ dataDir: liveDir, outDir: link })).rejects.toThrow(/thư mục dữ liệu/);
    await rm(link, { force: true });
  });

  it("từ chối phục hồi vào dữ liệu thật qua symlink", async () => {
    const archive = (await backupLocalDatabase({ dataDir: liveDir, outDir: path.join(root, "out-paths") })).file;
    const insideLive = path.join(liveDir, "restore-target");
    await expect(restoreLocalDatabase({ archive, toDir: insideLive, liveDataDir: liveDir })).rejects.toThrow(/thư mục dữ liệu/);
    const link = path.join(root, "restore-link");
    await symlink(liveDir, link);
    await expect(restoreLocalDatabase({ archive, toDir: link, liveDataDir: liveDir })).rejects.toThrow(/đã tồn tại/);
    await rm(link, { force: true });
  });

  it("từ chối phục hồi vào thư mục đã có (kể cả thư mục cha của dữ liệu thật)", async () => {
    const archive = (await backupLocalDatabase({ dataDir: liveDir, outDir: path.join(root, "out-parent") })).file;
    await expect(restoreLocalDatabase({ archive, toDir: root, liveDataDir: liveDir })).rejects.toThrow(/đã tồn tại/);
  });

  it("từ chối đích nằm dưới một symlink trỏ vào dữ liệu thật", async () => {
    // Đích chưa tồn tại nên lstat không bắt được; phải canonical phần cha có sẵn.
    const archive = (await backupLocalDatabase({ dataDir: liveDir, outDir: path.join(root, "out-sublink") })).file;
    const link = path.join(root, "sub-link");
    await symlink(liveDir, link);
    await expect(restoreLocalDatabase({ archive, toDir: path.join(link, "ben-trong"), liveDataDir: liveDir })).rejects.toThrow(/thư mục dữ liệu/);
    await rm(link, { force: true });
  });
});

describe("sao lưu: không ghi đè, checksum độc quyền", () => {
  let archive: string;

  it("tạo bản sao lưu + checksum, quyền 600, và không để lại thư mục tạm", async () => {
    const outDir = path.join(root, "backups");
    const result = await backupLocalDatabase({ dataDir: liveDir, outDir });
    archive = result.file;
    expect((await stat(archive)).mode & 0o777).toBe(0o600);
    expect(await readFile(result.sha256File, "utf8")).toContain(result.sha256);
    expect(result.bytes).toBeGreaterThan(0);
    const leftovers = (await readdir(outDir)).filter((entry) => entry.startsWith(".roadmap-backup-"));
    expect(leftovers).toEqual([]);
  }, 60_000);

  it("không ghi đè khi bản sao cùng tên đã có, và giữ nguyên nội dung cũ", async () => {
    const now = new Date("2026-11-10T00:00:00.000Z");
    const outDir = path.join(root, "no-clobber");
    const first = await backupLocalDatabase({ dataDir: liveDir, outDir, now });
    const content = await readFile(first.file);
    await expect(backupLocalDatabase({ dataDir: liveDir, outDir, now })).rejects.toThrow(/EEXIST|đã tồn tại/);
    expect(await readFile(first.file)).toEqual(content);
    expect((await readdir(outDir)).filter((entry) => entry.startsWith(".roadmap-backup-"))).toEqual([]);
  }, 60_000);

  it("giữ checksum có sẵn khi chỉ tên checksum bị trùng", async () => {
    if (!(await stat(liveDir).catch(() => null))) await phase("seed", liveDir);
    const now = new Date("2026-11-10T00:00:00.000Z");
    const outDir = path.join(root, "checksum-collision");
    await mkdir(outDir);
    const checksum = path.join(outDir, "roadmap-pglite-20261110T000000Z.tar.gz.sha256");
    await writeFile(checksum, "dữ liệu có sẵn");
    await expect(backupLocalDatabase({ dataDir: liveDir, outDir, now })).rejects.toThrow(/EEXIST/);
    expect(await readFile(checksum, "utf8")).toBe("dữ liệu có sẵn");
  }, 60_000);
});

describe("archive không tin cậy", () => {
  let goodArchive: string;

  beforeAll(async () => {
    goodArchive = (await backupLocalDatabase({ dataDir: liveDir, outDir: path.join(root, "good") })).file;
  }, 60_000);

  // BSD tar tự chuẩn hóa tên nên archive tấn công phải dựng bằng tarfile (Python).
  const evilScript = path.join(webRoot, "tests", "fixtures", "evil-archive.py");
  // Checksum đúng để archive tấn công đi qua bước toàn vẹn và chạm bước kiểm nội dung.
  async function sign(file: string): Promise<string> {
    const digest = createHash("sha256").update(await readFile(file)).digest("hex");
    await writeFile(`${file}.sha256`, `${digest}  ${path.basename(file)}\n`);
    return file;
  }
  async function evil(caseName: string): Promise<string> {
    const file = path.join(root, `evil-${caseName}.tar.gz`);
    await run("python3", [evilScript, file, caseName]);
    return sign(file);
  }

  /** Mỗi ca: phải ném lỗi đúng lý do và không để lại đích hay thư mục tạm. */
  async function expectRejected(caseName: string, pattern: RegExp): Promise<void> {
    const archive = await evil(caseName);
    const target = path.join(root, `target-${caseName}`);
    await expect(restoreLocalDatabase({ archive, toDir: target, liveDataDir: liveDir })).rejects.toThrow(pattern);
    expect(await stat(target).catch(() => null)).toBeNull();
    expect((await readdir(root)).filter((entry) => entry.startsWith(".roadmap-restore-"))).toEqual([]);
  }

  it("từ chối đường dẫn tuyệt đối", () => expectRejected("absolute", /tuyệt đối/), 60_000);
  it("từ chối đường dẫn đi ngược ..", () => expectRejected("dotdot", /đi ngược/), 60_000);
  it("từ chối symlink trong archive", () => expectRejected("symlink", /không phải tệp\/thư mục thường/), 60_000);
  it("từ chối hardlink trong archive", () => expectRejected("hardlink", /không phải tệp\/thư mục thường/), 60_000);
  it("từ chối thiết bị trong archive", () => expectRejected("device", /không phải tệp\/thư mục thường/), 60_000);
  it("từ chối mục lạ ngoài postgres/ và auth-secret", () => expectRejected("foreign", /mục lạ/), 60_000);
  it("từ chối mục con dưới auth-secret", () => expectRejected("nested-secret", /mục lạ/), 60_000);
  it("từ chối archive rỗng", () => expectRejected("empty", /rỗng/), 60_000);
  it("từ chối tên chứa dấu gạch chéo ngược", () => expectRejected("backslash", /dấu/), 60_000);
  it("từ chối archive không có postgres/PG_VERSION", () => expectRejected("no-db", /PG_VERSION/), 60_000);

  it("từ chối checksum sai", async () => {
    const copy = path.join(root, "tampered.tar.gz");
    await writeFile(copy, await readFile(goodArchive));
    await writeFile(`${copy}.sha256`, `${"0".repeat(64)}  tampered.tar.gz\n`);
    await expect(restoreLocalDatabase({ archive: copy, toDir: path.join(root, "t8"), liveDataDir: liveDir })).rejects.toThrow(/Checksum/);
  }, 60_000);

  it("từ chối khi thiếu tệp checksum (không coi là đã xác minh)", async () => {
    const copy = path.join(root, "no-checksum.tar.gz");
    await writeFile(copy, await readFile(goodArchive));
    await expect(restoreLocalDatabase({ archive: copy, toDir: path.join(root, "t8b"), liveDataDir: liveDir })).rejects.toThrow(/checksum/);
  }, 60_000);

  it("từ chối archive là thư mục, hoặc thiếu thư mục cha của đích", async () => {
    await expect(restoreLocalDatabase({ archive: path.dirname(goodArchive), toDir: path.join(root, "t9"), liveDataDir: liveDir })).rejects.toThrow(/phải là tệp/);
    await expect(restoreLocalDatabase({ archive: goodArchive, toDir: path.join(root, "khong-co-cha", "x"), liveDataDir: liveDir })).rejects.toThrow(/Thư mục cha/);
  }, 60_000);
});

describe("phục hồi: không xóa thư mục người khác", () => {
  let archive: string;

  beforeAll(async () => {
    archive = (await backupLocalDatabase({ dataDir: liveDir, outDir: path.join(root, "restore-src") })).file;
  }, 60_000);

  it("phục hồi vào đích mới rồi đăng nhập lại, đọc đủ dữ liệu", async () => {
    const restored = path.join(root, "restored");
    await restoreLocalDatabase({ archive, toDir: restored, liveDataDir: liveDir });
    const result = parsed(await phase("verify", restored));
    expect(result.ownerRole).toBe("admin");
    expect(result.catalogLessons).toBe(demoLessons);
    expect(result.progress.lessons).toMatchObject({ "90000": "completed" });
    expect(result.progress.practices).toMatchObject({ "clip-first": "in_progress" });
    expect(result.media).toHaveLength(1);
  }, 120_000);

  it("từ chối đích đã tồn tại, dù rỗng, và giữ nguyên nội dung của người dùng", async () => {
    const dir = path.join(root, "co-san");
    await mkdir(dir);
    await writeFile(path.join(dir, "ghi-chu.txt"), "của tôi");
    await expect(restoreLocalDatabase({ archive, toDir: dir, liveDataDir: liveDir })).rejects.toThrow(/đã tồn tại/);
    expect(await readFile(path.join(dir, "ghi-chu.txt"), "utf8")).toBe("của tôi");
  }, 60_000);

  it("không xóa dữ liệu không do mình tạo khi gặp lỗi giữa chừng", async () => {
    // Archive có postgres/ đúng nhưng chứa thêm entry lạ ở cấp 2 → bị chặn trước khi
    // tạo bất cứ thứ gì. Chứng minh không có thư mục tạm hay đích nào bị bỏ lại.
    const evil = path.join(root, "midway.tar.gz");
    const dir = await mkdtemp(path.join(root, "midway-"));
    await mkdir(path.join(dir, "postgres"), { recursive: true });
    await writeFile(path.join(dir, "postgres", "PG_VERSION"), "17\n");
    await run("tar", ["-czf", evil, "-C", dir, "postgres"]);
    // Chèn mục lạ bằng cách thêm vào gzip mới để mô phỏng archive trộn.
    const mixedDir = await mkdtemp(path.join(root, "mixed-"));
    await mkdir(path.join(mixedDir, "postgres"), { recursive: true });
    await writeFile(path.join(mixedDir, "postgres", "PG_VERSION"), "17\n");
    await writeFile(path.join(mixedDir, "la.txt"), "không phải ta tạo");
    const mixed = path.join(root, "mixed.tar.gz");
    await run("tar", ["-czf", mixed, "-C", mixedDir, "postgres", "la.txt"]);
    await writeFile(`${mixed}.sha256`, `${createHash("sha256").update(await readFile(mixed)).digest("hex")}  mixed.tar.gz\n`);

    const target = path.join(root, "khong-bi-xoa");
    await expect(restoreLocalDatabase({ archive: mixed, toDir: target, liveDataDir: liveDir })).rejects.toThrow(/mục lạ/);
    expect(await stat(target).catch(() => null)).toBeNull();
    expect((await readdir(root)).filter((entry) => entry.startsWith(".roadmap-restore-"))).toEqual([]);
    expect(await readFile(path.join(mixedDir, "la.txt"), "utf8")).toBe("không phải ta tạo");
  }, 60_000);

  it("đếm được danh mục, tiến độ và quyền sau migration (12.3)", async () => {
    const restored = path.join(root, "restored");
    const before = await inspectLocalDatabase(restored);
    const after = await inspectLocalDatabase(restored, { migrate: true });
    expect(after).toEqual(before);
    expect(after).toMatchObject({
      users: 1, admins: 1, catalogCourses: demoCatalog.courses.length, catalogLessons: demoLessons,
      lessonProgress: 1, practiceProgress: 1, mediaLinks: 1, catalogHistory: 1,
    });
  }, 60_000);
});

describe("CLI theo môi trường và không đóng gói bí mật môi trường", () => {
  const cli = path.join(webRoot, "scripts", "local-db.ts");

  function cliEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
    return { ...process.env, NODE_ENV: "test", BETTER_AUTH_SECRET: "", ...extra };
  }

  it("--data mặc định theo PGLITE_DATA_DIR, không phải web/.data", async () => {
    const { stdout } = await run(process.execPath, ["--import", "tsx", cli, "inspect"], {
      cwd: webRoot,
      env: cliEnv({ PGLITE_DATA_DIR: liveDir }),
    });
    const summary = JSON.parse(stdout.trim().split("\n").at(-1)!) as { users: number };
    expect(summary.users).toBe(1);
  }, 60_000);

  it("báo lỗi thay vì âm thầm đọc web/.data khi PGLITE_DATA_DIR trống", async () => {
    // web/.data đang bị server 3001 giữ; nếu CLI lén đọc nó thì guard sẽ chặn với
    // thông báo khác. Ở đây chỉ cần chắc nó không im lặng thành công.
    const result = await run(process.execPath, ["--import", "tsx", cli, "inspect"], {
      cwd: webRoot,
      env: cliEnv({ PGLITE_DATA_DIR: "" }),
    }).then(({ stdout }) => stdout, (error: { stdout?: string }) => error.stdout ?? "");
    expect(result).not.toContain('"users"');
  }, 60_000);

  it("archive chứa auth-secret của thư mục dữ liệu nhưng không chứa BETTER_AUTH_SECRET", async () => {
    // Fixture truyền secret trực tiếp nên không tự sinh tệp; tạo tệp như ứng dụng thật sẽ có.
    const secretInFile = "khoa-phien-trong-thu-muc-du-lieu-khong-phai-bi-mat-that";
    await writeFile(path.join(liveDir, "auth-secret"), `${secretInFile}\n`, { mode: 0o600 });
    const secretFromEnv = "bia-dat-trong-moi-truong-khong-duoc-vao-archive";
    const outDir = path.join(root, "env-secret");
    await run(process.execPath, ["--import", "tsx", cli, "backup", "--data", liveDir, "--out", outDir], {
      cwd: webRoot,
      env: cliEnv({ PGLITE_DATA_DIR: liveDir, BETTER_AUTH_SECRET: secretFromEnv }),
    });
    // Đọc từ đĩa thay vì parse log: log chỉ để người đọc, không phải hợp đồng.
    const archives = (await readdir(outDir)).filter((entry) => entry.endsWith(".tar.gz"));
    expect(archives).toHaveLength(1);
    const archive = path.join(outDir, archives[0]);

    const { stdout: listing } = await run("tar", ["-tzf", archive]);
    expect(listing).toContain("postgres/");
    expect(listing.split("\n")).toContain("auth-secret");
    expect(listing).not.toContain(".env");
    expect(listing).not.toContain("postmaster.pid");

    // Không giải nén ra đĩa: đọc nội dung nén và tìm chuỗi secret.
    const { stdout: raw } = await run("gzip", ["-dc", archive], { maxBuffer: 64 * 1024 * 1024, encoding: "buffer" });
    const tarBytes = Buffer.from(raw);
    expect(tarBytes.includes(Buffer.from(secretFromEnv))).toBe(false);
    // Đối chứng dương: chính khóa trong tệp thì có, nếu không test sẽ vô nghĩa.
    expect(tarBytes.includes(Buffer.from(secretInFile))).toBe(true);
  }, 120_000);
});
