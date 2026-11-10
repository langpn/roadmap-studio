import path from "node:path";
import { backupLocalDatabase, inspectLocalDatabase, restoreLocalDatabase } from "../src/lib/ops/local-backup";

// Quy trình sao lưu/phục hồi database PGlite cục bộ. Không in nội dung dữ liệu,
// không in giá trị bí mật, không tự chọn thư mục dữ liệu thật khi chưa được chỉ định.

function value(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

/** Cùng quy tắc với `src/lib/db/index.ts`: tôn trọng PGLITE_DATA_DIR của ứng dụng. */
function defaultDataDir(): string {
  return path.resolve(process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".data"));
}

function usage(): void {
  console.log(`Cách dùng: node --import tsx scripts/local-db.ts <lệnh> [tùy chọn]

  backup  --data DIR --out DIR     Sao lưu khi database đã đóng (tar.gz + sha256, không ghi đè)
  restore --archive FILE --to DIR  Tạo database mới từ bản sao, ngoài dữ liệu thật
  inspect --data DIR [--migrate]   Đếm tài khoản, danh mục, tiến độ; --migrate chạy migration

--data mặc định lấy PGLITE_DATA_DIR của môi trường, không có thì web/.data. Nếu
ứng dụng đang chạy với PGLITE_DATA_DIR khác, phải trỏ --data đúng thư mục đó.
--to phải là đường dẫn chưa tồn tại. --live-data đổi thư mục dữ liệu thật cần
bảo vệ (mặc định cũng theo PGLITE_DATA_DIR hoặc web/.data).`);
}

async function main(): Promise<void> {
  // `pnpm run x -- backup` chuyển nguyên dấu `--`; bỏ nó để cả hai cách gọi đều chạy.
  const args = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === "--"));
  const [command, ...rest] = args;
  const dataDir = path.resolve(value(rest, "--data") ?? defaultDataDir());

  if (command === "backup") {
    const outDir = value(rest, "--out");
    if (!outDir) throw new Error("Thiếu --out.");
    const result = await backupLocalDatabase({ dataDir, outDir });
    console.log(`Đã sao lưu ${result.bytes} byte tới ${result.file}`);
    console.log(`Checksum: ${result.sha256File}`);
    // Nhắc lại phạm vi: archive chứa băm mật khẩu và tiến độ, không chứa secret môi trường.
    console.log("Lưu ý: archive chứa dữ liệu tài khoản và tiến độ; giữ quyền 600, không chia sẻ.");
    return;
  }
  if (command === "restore") {
    const archive = value(rest, "--archive");
    const toDir = value(rest, "--to");
    if (!archive || !toDir) throw new Error("Thiếu --archive hoặc --to.");
    const liveDataDir = path.resolve(value(rest, "--live-data") ?? defaultDataDir());
    const result = await restoreLocalDatabase({ archive, toDir, liveDataDir });
    console.log(`Đã phục hồi vào ${result.toDir}. Đây là bản thử; dữ liệu thật không bị ghi đè.`);
    console.log("Khóa phiên trong archive chỉ dùng được nếu môi trường thử dùng đúng auth-secret đã sao lưu (hoặc BETTER_AUTH_SECRET cũ).");
    return;
  }
  if (command === "inspect") {
    const summary = await inspectLocalDatabase(dataDir, { migrate: rest.includes("--migrate") });
    console.log(JSON.stringify(summary));
    return;
  }
  usage();
  if (command) throw new Error(`Lệnh không hợp lệ: ${command}`);
}

main().catch((error: unknown) => {
  console.error(`Lỗi: ${error instanceof Error ? error.message : "không xác định"}`);
  process.exitCode = 1;
});
